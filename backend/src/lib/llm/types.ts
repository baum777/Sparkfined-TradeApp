export type LlmProvider = 'deepseek' | 'openai' | 'grok';

export type LlmRole = 'system' | 'user' | 'assistant';

export interface LlmMessage {
  role: LlmRole;
  content: string;
}

export interface LlmUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface ProviderCallOptions {
  requestId: string;
  timeoutMs: number;
  maxRetries?: number;
  model: string;
  messages: LlmMessage[];
  temperature?: number;
  maxTokens?: number;
  jsonOnly?: boolean;
}

export interface ProviderResult {
  provider: LlmProvider;
  requestId: string;
  model: string;
  text: string;
  latencyMs: number;
  usage?: LlmUsage;
}

