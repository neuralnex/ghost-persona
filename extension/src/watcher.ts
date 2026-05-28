import fsExtra from 'fs-extra';
import * as path from 'path';
import { WorkspaceOrchestrator } from './orchestrator.js';

export class GhostWorkspaceWatcher {
  private isWatching = false;
  private watchDebounceTimer: NodeJS.Timeout | null = null;
  private watcher: fsExtra.FSWatcher | null = null;
  private activeMemoryState: any = null;

  public onFlushSuccess?: () => void;

  constructor(
    private workspaceRoot: string,
    private orchestrator: WorkspaceOrchestrator
  ) {}

  async start(initialContextMemory: any): Promise<void> {
    this.activeMemoryState = initialContextMemory;
    this.isWatching = true;

    console.log(`[Watcher] Ghost Workspace Watcher initialized for: ${this.workspaceRoot}`);
    console.log('[Watcher] Monitoring directory files for modifications...');

    this.watcher = fsExtra.watch(this.workspaceRoot, { recursive: true }, (_eventType, filename) => {
      if (!filename || !this.isWatching) return;
      const normalizedFilename = filename.toString().split(path.sep).join('/');

      if (normalizedFilename === '.ghost' || normalizedFilename.startsWith('.ghost/') ||
         normalizedFilename === '.git' || normalizedFilename.startsWith('.git/')) {
        return;
      }

      const fullPath = path.join(this.workspaceRoot, normalizedFilename);

      try {
        if (!fsExtra.existsSync(fullPath) || fsExtra.statSync(fullPath).isDirectory()) {
          return;
        }
      } catch (e) {
        return;
      }

      this.handleFileChange(normalizedFilename);
    });
  }

  private handleFileChange(filename: string): void {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `[File Modified] ${filename} updated at ${timestamp}`;
    
    console.log(`[Watcher Log] ${logMessage}`);

    if (!this.activeMemoryState.sessionLogs) {
      this.activeMemoryState.sessionLogs = [];
    }
    this.activeMemoryState.sessionLogs.push(logMessage);

    if (this.watchDebounceTimer) {
      clearTimeout(this.watchDebounceTimer);
    }

    this.watchDebounceTimer = setTimeout(async () => {
      console.log('\n[Watcher Flush] Changes stabilized. Packaging auto-backup...');
      try {
        await this.orchestrator.checkOut(this.activeMemoryState);
        console.log('[Watcher Flush] Auto-backup synchronization successful.\n');
        
        if (this.onFlushSuccess) {
          this.onFlushSuccess();
        }
      } catch (error) {
        console.error('[Watcher Flush] Auto-backup routine failed:', error);
      }
    }, 3000);
  }

  stop(): void {
    this.isWatching = false;
    if (this.watchDebounceTimer) clearTimeout(this.watchDebounceTimer);
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
    console.log('[Watcher] Stopped background workspace file monitors.');
  }
}
