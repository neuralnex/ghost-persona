import { GhostContextInjector, LLMMessage } from './extension/src/injector.js';

async function runInjectionSimulation() {
  console.log("[Simulation] Booting IDE Agent Chat Window session...");

  const mockRecoveredWorkspaceState = {
    sessionLogs: [
      '[File Modified] contracts/RemixVault.sol updated at 11:45:02 PM',
      '[File Modified] test/Vault.ts updated at 11:47:15 PM',
      '[File Modified] package.json updated at 11:51:30 PM'
    ],
    dynamicPrompts: [
      'Act as an expert EVM Smart Contract Security Engineer.',
      'Prioritize gas efficiency metrics across all recommendations.'
    ]
  };

  const injector = new GhostContextInjector(5);

  const userChatHistory: LLMMessage[] = [
    {
      role: 'system',
      content: 'You are an advanced programming assistant integrated into the user\'s text editor.'
    },
    {
      role: 'user',
      content: 'Can you help me write a deployment script for the main contract I am working on right now?'
    }
  ];

  console.log("\nChat Payload State *BEFORE* Ghost Injection Loop:");
  console.log(JSON.stringify(userChatHistory, null, 2));

  const compiledPipelinePayload = injector.injectIntoPromptPipeline(
    [...userChatHistory],
    mockRecoveredWorkspaceState
  );

  console.log("\nTransformed Chat Payload State *AFTER* Ghost Injection Loop:");
  console.log(JSON.stringify(compiledPipelinePayload, null, 2));

  console.log("\nContext Injection Layer fully integrated and validated.");
}

runInjectionSimulation();
