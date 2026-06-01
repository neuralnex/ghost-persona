import fsExtra from 'fs-extra';
import * as path from 'path';

export interface LocalMetadata {
  vaultUuid: string;
  iv: string;
  tag: string;
}

export class GhostStorageManager {
  private ghostDir: string;
  private configPath: string;
  private containerPath: string;

  constructor(workspaceRoot: string) {
    this.ghostDir = path.join(workspaceRoot, '.ghost');
    this.configPath = path.join(this.ghostDir, 'config.json');
    this.containerPath = path.join(this.ghostDir, 'context.bin.enc');
  }

  public ensureGhostStructure(): void {
    fsExtra.ensureDirSync(this.ghostDir);
  }

  public saveMetadata(meta: LocalMetadata): void {
    fsExtra.writeJsonSync(this.configPath, meta, { spaces: 2 });
  }

  public readMetadata(): LocalMetadata | null {
    if (!fsExtra.existsSync(this.configPath)) return null;
    return fsExtra.readJsonSync(this.configPath);
  }

  public saveEncryptedContainer(ciphertextHex: string): void {
    fsExtra.writeFileSync(this.containerPath, ciphertextHex, 'utf8');
  }

  public readEncryptedContainer(): string {
    if (!fsExtra.existsSync(this.containerPath)) return '';
    return fsExtra.readFileSync(this.containerPath, 'utf8');
  }
}
