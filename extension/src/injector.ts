export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export class GhostContextInjector {
  constructor(private maxLogEntries: number = 10) {}

  public formatContextToMarkdown(contextState: any): string {
    if (!contextState) return '';

    const logs = contextState.sessionLogs || [];
    const prompts = contextState.dynamicPrompts || [];

    const recentLogs = logs.slice(-this.maxLogEntries);

    let markdownBlock = `\n--- GHOST PERSONA SECURITY CONTEXT ACTIVE ---\n`;
    markdownBlock += `The user is working inside a cryptographically secured sovereign workspace identity.\n\n`;

    if (prompts.length > 0) {
      markdownBlock += `### Active Persona Guidelines:\n`;
      prompts.forEach((p: string) => {
        markdownBlock += `- ${p}\n`;
      });
      markdownBlock += `\n`;
    }

    if (recentLogs.length > 0) {
      markdownBlock += `### Recent Workspace Modifications (Chronological Order):\n`;
      recentLogs.forEach((log: string) => {
        markdownBlock += `${log}\n`;
      });
    } else {
      markdownBlock += `*No recent workspace file modifications recorded in this session environment yet.*\n`;
    }

    markdownBlock += `\nUse this spatial awareness to contextualize your assistance. Do not ask the user to explain what they just edited; you already see it.\n`;
    markdownBlock += `--- END GHOST CONTEXT ---\n`;

    return markdownBlock;
  }

  public injectIntoPromptPipeline(chatHistory: LLMMessage[], contextState: any): LLMMessage[] {
    const formattedContext = this.formatContextToMarkdown(contextState);
    if (!formattedContext) return chatHistory;

    const systemPromptIndex = chatHistory.findIndex(msg => msg.role === 'system');

    if (systemPromptIndex !== -1) {
      chatHistory[systemPromptIndex].content = `${chatHistory[systemPromptIndex].content}\n${formattedContext}`;
    } else {
      chatHistory.unshift({
        role: 'system',
        content: formattedContext
      });
    }

    return chatHistory;
  }
}
