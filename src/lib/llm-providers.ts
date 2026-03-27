/**
 * LLM Provider Abstraction Layer
 *
 * Provides a unified interface for multiple LLM providers (Gemini, Zhipu AI, etc.)
 * with automatic fallback support.
 *
 * @module llm-providers
 */

/**
 * Supported LLM providers
 */
export type LLMProvider = 'gemini' | 'zhipu';

/**
 * Common interface for all LLM providers
 */
export interface LLMResponse {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * Provider configuration
 */
export interface ProviderConfig {
  name: LLMProvider;
  apiKey: string;
  baseURL?: string;
  timeout?: number;
}

/**
 * Request options for chat completion
 */
export interface ChatCompletionOptions {
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  maxTokens?: number;
  responseMimeType?: 'text' | 'application/json';
  responseJsonSchema?: Record<string, unknown>;
}

/**
 * Abstract base class for LLM providers
 */
export abstract class LLMProviderBase {
  protected apiKey: string;
  protected baseURL: string;
  protected timeout: number;

  constructor(config: ProviderConfig) {
    this.apiKey = config.apiKey;
    this.baseURL = config.baseURL || this.getDefaultBaseURL();
    this.timeout = config.timeout || 30000;
  }

  abstract getDefaultBaseURL(): string;
  abstract generateContent(options: ChatCompletionOptions): Promise<LLMResponse>;
  abstract getProviderName(): string;

  /**
   * Create a timeout signal for fetch requests
   */
  protected createTimeoutSignal(): AbortSignal {
    return AbortSignal.timeout(this.timeout);
  }

  /**
   * Parse JSON response with error handling
   */
  protected parseJSON(content: string, context: string): unknown {
    try {
      return JSON.parse(content);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Invalid JSON';
      throw new Error(`${context} JSON parse failed: ${errorMessage}`);
    }
  }
}

/**
 * Gemini API Provider
 */
export class GeminiProvider extends LLMProviderBase {
  getDefaultBaseURL(): string {
    return 'https://generativelanguage.googleapis.com/v1beta/models';
  }

  getProviderName(): string {
    return 'Gemini';
  }

  async generateContent(options: ChatCompletionOptions): Promise<LLMResponse> {
    const isFastNaming = options.maxTokens === 30000;
    const modelName = isFastNaming ? 'gemini-2.0-flash' : 'gemini-2.5-flash';
    const modelUrl = `${this.baseURL}/${modelName}:generateContent?key=${this.apiKey}`;

    const responseJsonSchema = options.responseJsonSchema;

    const requestBody = JSON.stringify({
      contents: options.messages.map(msg => ({
        parts: [{ text: msg.content }]
      })),
      generationConfig: {
        temperature: options.temperature || 0.5,
        maxOutputTokens: options.maxTokens || 4096,
        responseMimeType: options.responseMimeType || 'text/plain',
        ...(responseJsonSchema ? { responseJsonSchema } : {}),
      },
    });

    const response = await fetch(modelUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: requestBody,
      signal: this.createTimeoutSignal(),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      const isPermissionError = response.status === 403 || response.status === 401;
      const errorCode = isPermissionError ? 'PERMISSION_DENIED' : 'API_ERROR';
      const error = new Error(`Gemini API error: ${response.status} - ${errorBody}`);
      (error as Error & { code?: string }).code = errorCode;
      throw error;
    }

    const geminiResponse = await response.json() as {
      candidates?: Array<{
        content?: {
          parts?: Array<{ text: string }>;
        };
      }>;
    };

    const content = geminiResponse.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!content) {
      throw new Error('Gemini: No content generated');
    }

    return {
      content,
      model: modelName,
    };
  }
}

/**
 * Zhipu AI (BigModel.cn) Provider
 *
 * Compatible with OpenAI API format
 * Base URL: https://open.bigmodel.cn/api/paas/v4/chat/completions
 */
export class ZhipuProvider extends LLMProviderBase {
  getDefaultBaseURL(): string {
    return 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
  }

  getProviderName(): string {
    return 'ZhipuAI';
  }

  async generateContent(options: ChatCompletionOptions): Promise<LLMResponse> {
    const modelName = options.maxTokens === 30000 ? 'glm-4-flash' : 'glm-4-air';

    // Build messages array for Zhipu API
    const messages = options.messages.map(msg => ({
      role: msg.role,
      content: msg.content,
    }));

    // Add JSON format instruction if needed
    if (options.responseMimeType === 'application/json') {
      const jsonInstruction = '\n\n请严格按照 JSON 格式输出，不要包含任何 Markdown 格式，不要添加额外解释。';
      const lastMessage = messages[messages.length - 1];
      if (lastMessage) {
        lastMessage.content += jsonInstruction;
      }
    }

    const requestBody = JSON.stringify({
      model: modelName,
      messages,
      temperature: options.temperature || 0.5,
      max_tokens: options.maxTokens || 4096,
      stream: false,
    });

    const response = await fetch(this.baseURL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: requestBody,
      signal: this.createTimeoutSignal(),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      const isPermissionError = response.status === 403 || response.status === 401;
      const errorCode = isPermissionError ? 'PERMISSION_DENIED' : 'API_ERROR';
      const error = new Error(`Zhipu AI API error: ${response.status} - ${errorBody}`);
      (error as Error & { code?: string }).code = errorCode;
      throw error;
    }

    const zhipuResponse = await response.json() as {
      choices?: Array<{
        message?: {
          content: string;
        };
      }>;
      usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
      };
    };

    const content = zhipuResponse.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('Zhipu AI: No content generated');
    }

    return {
      content,
      model: modelName,
      usage: zhipuResponse.usage ? {
        promptTokens: zhipuResponse.usage.prompt_tokens,
        completionTokens: zhipuResponse.usage.completion_tokens,
        totalTokens: zhipuResponse.usage.total_tokens,
      } : undefined,
    };
  }
}

/**
 * Provider factory - creates the appropriate provider based on config
 */
export function createProvider(config: ProviderConfig): LLMProviderBase {
  switch (config.name) {
    case 'zhipu':
      return new ZhipuProvider(config);
    case 'gemini':
    default:
      return new GeminiProvider(config);
  }
}

/**
 * Provider manager with automatic fallback support
 */
export class ProviderManager {
  private providers: LLMProviderBase[] = [];
  private currentProviderIndex = 0;

  constructor(configs: ProviderConfig[]) {
    this.providers = configs.map(config => createProvider(config));
  }

  /**
   * Get the current provider
   */
  getCurrentProvider(): LLMProviderBase {
    return this.providers[this.currentProviderIndex];
  }

  /**
   * Get the current provider name
   */
  getCurrentProviderName(): string {
    return this.providers[this.currentProviderIndex].getProviderName();
  }

  /**
   * Generate content with automatic fallback
   * Tries current provider, then falls back to next available provider on failure
   * Permission errors (403/401) cause immediate switch to next provider
   */
  async generateContentWithFallback(options: ChatCompletionOptions): Promise<LLMResponse> {
    const errors: Error[] = [];

    for (let i = 0; i < this.providers.length; i++) {
      const providerIndex = (this.currentProviderIndex + i) % this.providers.length;
      const provider = this.providers[providerIndex];

      try {
        console.log(`[ProviderManager] Trying provider: ${provider.getProviderName()}`);
        const result = await provider.generateContent(options);

        // Success - update current provider to this one for next call
        this.currentProviderIndex = providerIndex;
        console.log(`[ProviderManager] Success with provider: ${provider.getProviderName()}`);

        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const errorCode = error instanceof Error && 'code' in error ? (error as Error & { code?: string }).code : undefined;

        console.warn(`[ProviderManager] Provider ${provider.getProviderName()} failed: ${errorMessage}`);
        errors.push(error instanceof Error ? error : new Error(errorMessage));

        // If this is a permission error, skip to next provider immediately
        if (errorCode === 'PERMISSION_DENIED') {
          console.warn(`[ProviderManager] Permission denied, skipping to next provider`);
          continue;
        }
      }
    }

    // All providers failed
    throw new Error(`All LLM providers failed. Last error: ${errors[errors.length - 1]?.message}`);
  }

  /**
   * Manually switch to a specific provider
   */
  switchProvider(name: LLMProvider): void {
    const index = this.providers.findIndex(p => p.getProviderName().toLowerCase().includes(name));
    if (index === -1) {
      throw new Error(`Provider ${name} not found`);
    }
    this.currentProviderIndex = index;
    console.log(`[ProviderManager] Switched to provider: ${this.providers[index].getProviderName()}`);
  }
}
