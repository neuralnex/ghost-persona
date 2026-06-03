import * as fs from 'fs';
import * as path from 'path';

type LineChange = {
  line: number;
  before: string | null;
  after: string | null;
};

type WorkspaceActivity = {
  file: string;
  event: 'file_created' | 'file_modified' | 'file_deleted';
  first_seen: string;
  last_seen: string;
  event_count: number;
  active_focus: boolean;
  change_summary: string;
  changed_lines: LineChange[];
  context: {
    extension: string;
    file_type: string;
    workspace_relative_path: string;
    content_captured: boolean;
    capture_reason: string;
  };
};

export class GhostWorkspaceWatcher {
  public onFlushSuccess?: () => void;
  private watcher: fs.FSWatcher | null = null;
  private flushTimer: NodeJS.Timeout | null = null;
  private snapshots = new Map<string, string[] | null>();
  private activeContext: any = null;
  private readonly maxCapturedBytes = 256 * 1024;
  private readonly ignoredSegments = new Set(['.ghost', 'node_modules', '.git', 'dist', '.npm-cache']);

  constructor(
    private readonly workspaceRoot: string,
    private readonly orchestrator: any,
    private readonly debounceMs: number
  ) {}

  public async start(activeContextMemory: any): Promise<void> {
    this.activeContext = activeContextMemory;
    this.activeContext.sessionLogs = this.activeContext.sessionLogs ?? [];
    this.activeContext.workspaceActivity = this.activeContext.workspaceActivity ?? [];

    this.seedSnapshots(this.workspaceRoot);

    console.log(`[Watcher] Ghost Workspace Watcher initialized for: ${this.workspaceRoot}`);
    console.log(`[Watcher] Monitoring directory files for modifications...`);

    this.watcher = fs.watch(this.workspaceRoot, { recursive: true }, (_eventType, filename) => {
      if (!filename) return;

      const relativePath = this.normalizeRelativePath(String(filename));
      if (this.shouldIgnore(relativePath)) return;

      this.recordFileActivity(relativePath);
      this.scheduleFlush();
    });
  }

  public stop(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    this.watcher?.close();
    this.watcher = null;
  }

  private recordFileActivity(relativePath: string): void {
    const absolutePath = path.join(this.workspaceRoot, relativePath);
    const previousLines = this.snapshots.get(relativePath) ?? null;
    const nextLines = this.readTextLines(absolutePath);
    const now = new Date().toLocaleTimeString();
    const exists = fs.existsSync(absolutePath);
    const event = !exists ? 'file_deleted' : previousLines === null ? 'file_created' : 'file_modified';
    const changedLines = this.diffLines(previousLines, nextLines);
    const eventLabel = event === 'file_deleted' ? 'File Deleted' : event === 'file_created' ? 'File Created' : 'File Modified';
    const legacyLog = `[${eventLabel}] ${relativePath} updated at ${now}`;

    console.log(`[Watcher Log] ${legacyLog}`);

    this.activeContext.sessionLogs = this.activeContext.sessionLogs ?? [];
    this.activeContext.sessionLogs.push(legacyLog);

    this.activeContext.workspaceActivity = this.activeContext.workspaceActivity ?? [];
    this.upsertWorkspaceActivity({
      file: relativePath,
      event,
      first_seen: now,
      last_seen: now,
      event_count: 1,
      active_focus: true,
      change_summary: this.summarizeChange(relativePath, event, changedLines),
      changed_lines: changedLines.slice(0, 12),
      context: {
        extension: path.extname(relativePath) || '(none)',
        file_type: this.describeFileType(relativePath),
        workspace_relative_path: relativePath,
        content_captured: Boolean(nextLines || previousLines),
        capture_reason: this.captureReason(absolutePath, nextLines)
      }
    });

    if (exists) {
      this.snapshots.set(relativePath, nextLines);
    } else {
      this.snapshots.delete(relativePath);
    }
  }

  private upsertWorkspaceActivity(next: WorkspaceActivity): void {
    for (const activity of this.activeContext.workspaceActivity as WorkspaceActivity[]) {
      activity.active_focus = false;
    }

    const existing = (this.activeContext.workspaceActivity as WorkspaceActivity[])
      .find(activity => activity.file === next.file && activity.event === next.event);

    if (existing) {
      existing.last_seen = next.last_seen;
      existing.event_count += 1;
      existing.active_focus = true;
      existing.change_summary = next.change_summary;
      existing.changed_lines = next.changed_lines;
      existing.context = next.context;
      return;
    }

    this.activeContext.workspaceActivity.push(next);
  }

  private scheduleFlush(): void {
    if (this.flushTimer) clearTimeout(this.flushTimer);

    this.flushTimer = setTimeout(async () => {
      try {
        await this.orchestrator.checkOut(this.activeContext);
        this.onFlushSuccess?.();
      } catch (error) {
        console.error('[Watcher] Failed to flush Ghost Persona context:', error);
      }
    }, this.debounceMs);
  }

  private seedSnapshots(directory: string): void {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolutePath = path.join(directory, entry.name);
      const relativePath = this.normalizeRelativePath(path.relative(this.workspaceRoot, absolutePath));
      if (this.shouldIgnore(relativePath)) continue;

      if (entry.isDirectory()) {
        this.seedSnapshots(absolutePath);
      } else if (entry.isFile()) {
        this.snapshots.set(relativePath, this.readTextLines(absolutePath));
      }
    }
  }

  private readTextLines(absolutePath: string): string[] | null {
    try {
      if (!fs.existsSync(absolutePath)) return null;
      const stat = fs.statSync(absolutePath);
      if (!stat.isFile()) return null;
      if (stat.size > this.maxCapturedBytes) return null;

      const buffer = fs.readFileSync(absolutePath);
      if (buffer.includes(0)) return null;

      return buffer.toString('utf8').split(/\r?\n/);
    } catch {
      return null;
    }
  }

  private diffLines(before: string[] | null, after: string[] | null): LineChange[] {
    if (!before && !after) return [];

    const previous = before ?? [];
    const next = after ?? [];
    const max = Math.max(previous.length, next.length);
    const changes: LineChange[] = [];

    for (let index = 0; index < max; index++) {
      const beforeLine = previous[index];
      const afterLine = next[index];
      if (beforeLine === afterLine) continue;

      changes.push({
        line: index + 1,
        before: beforeLine === undefined ? null : this.truncate(beforeLine),
        after: afterLine === undefined ? null : this.truncate(afterLine)
      });

      if (changes.length >= 24) break;
    }

    return changes;
  }

  private summarizeChange(relativePath: string, event: WorkspaceActivity['event'], changedLines: LineChange[]): string {
    if (event === 'file_deleted') return `${relativePath} was deleted.`;
    if (event === 'file_created') return `${relativePath} was created with ${changedLines.length} captured changed line(s).`;
    if (changedLines.length === 0) return `${relativePath} was modified, but no text line diff was captured.`;

    const lineList = changedLines.slice(0, 5).map(change => change.line).join(', ');
    return `${relativePath} was modified at line(s) ${lineList}${changedLines.length > 5 ? ' and more' : ''}.`;
  }

  private captureReason(absolutePath: string, lines: string[] | null): string {
    if (lines) return 'small_utf8_text_file';
    if (!fs.existsSync(absolutePath)) return 'file_deleted_or_unavailable';
    return 'content_not_captured_binary_large_or_unreadable';
  }

  private describeFileType(relativePath: string): string {
    const extension = path.extname(relativePath).replace('.', '').toLowerCase();
    if (!extension) return 'plain';

    const known: Record<string, string> = {
      js: 'javascript',
      jsx: 'javascript_react',
      ts: 'typescript',
      tsx: 'typescript_react',
      json: 'json',
      md: 'markdown',
      txt: 'text',
      css: 'css',
      html: 'html',
      py: 'python'
    };

    return known[extension] ?? extension;
  }

  private normalizeRelativePath(relativePath: string): string {
    return relativePath.replace(/\\/g, '/');
  }

  private shouldIgnore(relativePath: string): boolean {
    const segments = this.normalizeRelativePath(relativePath).split('/');
    return segments.some(segment => this.ignoredSegments.has(segment));
  }

  private truncate(value: string): string {
    const singleLine = value.replace(/\s+/g, ' ').trim();
    return singleLine.length > 240 ? `${singleLine.slice(0, 237)}...` : singleLine;
  }
}
