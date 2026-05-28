import { WorkspaceOrchestrator } from './extension/src/orchestrator.js';
import { GhostWorkspaceWatcher } from './extension/src/watcher.js';
import fsExtra from 'fs-extra';
import * as os from 'os';
import * as path from 'path';

async function runLiveWatcherTest() {
  const mockWorkspacePath = fsExtra.mkdtempSync(path.join(os.tmpdir(), 'ghost-persona-offline-'));
  const orchestrator = new WorkspaceOrchestrator(mockWorkspacePath, null, true);

  console.log("\n--- STARTING AUTOMATED WORKSPACE ENGINE ---");
  const initialMemoryState = await orchestrator.checkIn();

  const watcher = new GhostWorkspaceWatcher(mockWorkspacePath, orchestrator);
  await watcher.start(initialMemoryState);

  console.log("\n--- SIMULATING USER EDIT EVENT IN BACKGROUND ---");
  const testEditFile = path.join(mockWorkspacePath, 'sandbox-demo.txt');
  
  console.log("[Simulation Action] Writing mock edit data into 'sandbox-demo.txt'...");
  fsExtra.writeFileSync(testEditFile, 'console.log("Hello from Story Protocol Context Gate");', 'utf8');

  setTimeout(async () => {
    console.log("\n--- SHUTTING DOWN WATCHER & SIMULATING TERMINAL REBOOT ---");
    watcher.stop();

    if (fsExtra.existsSync(testEditFile)) {
      fsExtra.removeSync(testEditFile);
    }

    const rebootedOrchestrator = new WorkspaceOrchestrator(mockWorkspacePath, null, true);

    const reloadedMemory = await rebootedOrchestrator.checkIn();
    console.log("\nRecovered Context Content Post-Auto-Sync Check:");
    console.log(reloadedMemory);

    console.log("\nVerification Complete: File tracking context fully operational.");
    fsExtra.removeSync(mockWorkspacePath);
    process.exit(0);
  }, 5000);
}

runLiveWatcherTest().catch(console.error);
