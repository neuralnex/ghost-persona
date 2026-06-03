export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

type GhostPromptPayload = {
  role: 'system';
  content_type: 'ghost_persona_security_context';
  content: {
    workspace_identity: {
      status: 'active';
      security_model: 'cryptographically_secured_sovereign_workspace';
    };
    persona_guidelines: string[];
    recent_workspace_modifications: Array<{
      event: string;
      file: string;
      timestamp: string;
      summary: string;
    }>;
    workspace_activity: unknown[];
    vault: {
      vault_uuid: string | null;
      cdr_vaulted_material: string;
      local_vaulted_material: string[];
      plaintext_workspace_content_sent_to_cdr: false;
    };
    assistant_instruction: string;
  };
};

export class GhostContextInjector {
  public injectIntoPromptPipeline(chatHistory: LLMMessage[], contextState: any): LLMMessage[] {
    const formattedContext = this.formatContextToMarkdown(contextState);
    if (!formattedContext) return chatHistory;

    const systemPromptIndex = chatHistory.findIndex(msg => msg.role === 'system');

    if (systemPromptIndex >= 0) {
      chatHistory[systemPromptIndex].content = `${chatHistory[systemPromptIndex].content}\n\n${formattedContext}`;
    } else {
      chatHistory.unshift({
        role: 'system',
        content: formattedContext
      });
    }

    return chatHistory;
  }

  public formatContextToMarkdown(contextState: any): string {
    if (!contextState) return '';

    return JSON.stringify(this.buildPromptPayload(contextState), null, 2);
  }

  private buildPromptPayload(contextState: any): GhostPromptPayload {
    return {
      role: 'system',
      content_type: 'ghost_persona_security_context',
      content: {
        workspace_identity: {
          status: 'active',
          security_model: 'cryptographically_secured_sovereign_workspace'
        },
        persona_guidelines: this.normalizePersonaGuidelines(contextState.dynamicPrompts),
        recent_workspace_modifications: this.normalizeSessionLogs(contextState.sessionLogs),
        workspace_activity: this.normalizeWorkspaceActivity(contextState.workspaceActivity),
        vault: {
          vault_uuid: contextState.vaultUuid ? String(contextState.vaultUuid) : null,
          cdr_vaulted_material: 'Threshold-encrypted AES workspace master key only.',
          local_vaulted_material: [
            'Encrypted workspace context payload in .ghost/context.bin.enc',
            'Vault metadata, IV, and authentication tag in .ghost/config.json',
            'Session logs, persona guidelines, and workspace activity after local AES-GCM encryption'
          ],
          plaintext_workspace_content_sent_to_cdr: false
        },
        assistant_instruction: 'Use this workspace awareness to contextualize assistance. Do not ask the user to explain edits already listed in recent_workspace_modifications.'
      }
    };
  }

  private normalizePersonaGuidelines(dynamicPrompts: unknown): string[] {
    if (!Array.isArray(dynamicPrompts)) return [];

    return dynamicPrompts
      .map(prompt => String(prompt).trim())
      .filter(Boolean);
  }

  private normalizeSessionLogs(sessionLogs: unknown): GhostPromptPayload['content']['recent_workspace_modifications'] {
    if (!Array.isArray(sessionLogs)) return [];

    return sessionLogs
      .map(log => this.parseSessionLog(String(log)))
      .filter((log): log is GhostPromptPayload['content']['recent_workspace_modifications'][number] => Boolean(log));
  }

  private normalizeWorkspaceActivity(workspaceActivity: unknown): unknown[] {
    if (!Array.isArray(workspaceActivity)) return [];

    return workspaceActivity.slice(-20);
  }

  private parseSessionLog(log: string): GhostPromptPayload['content']['recent_workspace_modifications'][number] | null {
    const trimmed = log.trim();
    if (!trimmed) return null;

    const match = /^\[(?<event>[^\]]+)\]\s+(?<file>.+?)\s+updated at\s+(?<timestamp>.+)$/i.exec(trimmed);
    if (!match?.groups) {
      return {
        event: 'Workspace Event',
        file: 'unknown',
        timestamp: '',
        summary: trimmed
      };
    }

    const event = match.groups.event.trim();
    const file = match.groups.file.trim();
    const timestamp = match.groups.timestamp.trim();

    return {
      event,
      file,
      timestamp,
      summary: trimmed
    };
  }
}
