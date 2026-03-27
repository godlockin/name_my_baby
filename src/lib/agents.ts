/**
 * Base Agent module for running AI agents via LLM providers
 *
 * Provides a generic agent runner that executes prompts with structured JSON output.
 * Supports multiple LLM providers (Gemini, Zhipu AI) with automatic fallback.
 * Each agent has a specific persona and system prompt for its domain expertise.
 *
 * @module agents
 */

import { AgentOutput, Constraints } from "../types";
import { ProviderManager, GeminiProvider, ZhipuProvider, type LLMProvider } from "./llm-providers";

// Re-export LLMProvider type for use by consumers
export type { LLMProvider };

const NAME_SCHEMES_RESPONSE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["nameSchemes", "summary"],
  properties: {
    nameSchemes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "chineseName",
          "coreMeaning",
          "baziAnalysis",
          "homophoneCheck",
          "poetryReference",
          "historyReference",
          "englishEtymology",
        ],
        properties: {
          chineseName: { type: "string" },
          englishName: { type: "string" },
          coreMeaning: { type: "string" },
          baziAnalysis: { type: "string" },
          homophoneCheck: {
            type: "object",
            additionalProperties: false,
            required: ["mandarin", "overall"],
            properties: {
              mandarin: { type: "string" },
              dialects: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["dialect", "risk", "note"],
                  properties: {
                    dialect: { type: "string" },
                    risk: { type: "string" },
                    note: { type: "string" },
                  },
                },
              },
              english: { type: "string" },
              overall: { type: "string" },
            },
          },
          poetryReference: {
            type: "object",
            additionalProperties: false,
            required: ["level", "source", "explanation"],
            properties: {
              level: { type: "string" },
              source: { type: "string" },
              explanation: { type: "string" },
            },
          },
          historyReference: {
            type: "object",
            additionalProperties: false,
            required: ["source", "explanation"],
            properties: {
              source: { type: "string" },
              explanation: { type: "string" },
            },
          },
          englishEtymology: {
            type: "object",
            additionalProperties: false,
            required: ["etymology", "originalMeaning", "relationToChinese"],
            properties: {
              etymology: { type: "string" },
              originalMeaning: { type: "string" },
              relationToChinese: { type: "string" },
            },
          },
          targetChildIndex: { type: "number" },
          gender: { type: "string", enum: ["male", "female"] },
          isPremium: { type: "boolean" },
        },
      },
    },
    summary: { type: "string" },
  },
} as const;

/**
 * Agent configuration defining persona and behavior
 */
export interface AgentConfig {
  /** Agent display name */
  name: string;
  /** Agent persona description (tone, style) */
  persona: string;
  /** System prompt that defines the agent's task and output format */
  systemPrompt: string;
}

/**
 * Options for running an agent
 */
export interface AgentRunOptions {
  /** Context to include in the prompt (e.g., user input) */
  context: string;
  /** Optional constraints for the agent to follow */
  constraints?: Constraints;
}

/**
 * Extended options for running an agent with provider selection
 */
export interface AgentRunOptionsWithProvider extends AgentRunOptions {
  /** Preferred LLM provider (optional, uses default if not specified) */
  provider?: LLMProvider;
}

/**
 * Global provider manager instance (initialized on first use)
 */
let globalProviderManager: ProviderManager | null = null;

/**
 * Initialize the global provider manager with available API keys
 * Call this once at application startup
 */
export function initializeProviders(options: {
  geminiApiKey?: string;
  zhipuApiKey?: string;
  defaultProvider?: LLMProvider;
}): void {
  const configs: Array<{ name: LLMProvider; apiKey: string }> = [];

  // Add providers in priority order (first is default)
  const defaultProvider = options.defaultProvider || 'gemini';

  if (defaultProvider === 'gemini') {
    if (options.geminiApiKey) {
      configs.push({ name: 'gemini', apiKey: options.geminiApiKey });
    }
    if (options.zhipuApiKey) {
      configs.push({ name: 'zhipu', apiKey: options.zhipuApiKey });
    }
  } else {
    if (options.zhipuApiKey) {
      configs.push({ name: 'zhipu', apiKey: options.zhipuApiKey });
    }
    if (options.geminiApiKey) {
      configs.push({ name: 'gemini', apiKey: options.geminiApiKey });
    }
  }

  if (configs.length === 0) {
    throw new Error('At least one API key must be provided');
  }

  globalProviderManager = new ProviderManager(
    configs.map(config => ({
      name: config.name,
      apiKey: config.apiKey,
      timeout: 60000, // 60 second timeout
    }))
  );

  console.log(`[Providers] Initialized with ${configs.length} providers: ${configs.map(c => c.name).join(', ')}`);
}

/**
 * Get the global provider manager (initializes with default if not already initialized)
 */
function getProviderManager(apiKey: string): ProviderManager {
  if (!globalProviderManager) {
    // Fallback: initialize with Gemini only for backward compatibility
    globalProviderManager = new ProviderManager([{
      name: 'gemini',
      apiKey,
      timeout: 60000,
    }]);
  }
  return globalProviderManager;
}

/**
 * Runs an agent with the given configuration and options
 *
 * @param config - Agent configuration (name, persona, system prompt)
 * @param options - Run options (context, constraints)
 * @param apiKey - API key (used for default provider if provider manager not initialized)
 * @returns AgentOutput with status and data
 *
 * @example
 * ```typescript
 * const result = await runAgent<BaziData>(BAZI_AGENT, { context: userInput }, apiKey);
 * if (result.status === "success") {
 *   console.log(result.data.eightChars);
 * }
 * ```
 */
export async function runAgent<T>(
  config: AgentConfig,
  options: AgentRunOptions,
  apiKey: string
): Promise<AgentOutput<T>> {
  return runAgentWithProvider<T>(config, options, apiKey);
}

/**
 * Runs an agent using the LLM provider manager with automatic fallback
 *
 * @param config - Agent configuration (name, persona, system prompt)
 * @param options - Run options with optional provider selection
 * @param apiKey - Default API key (used if provider manager not initialized)
 * @returns AgentOutput with status and data
 */
export async function runAgentWithProvider<T>(
  config: AgentConfig,
  options: AgentRunOptionsWithProvider,
  apiKey: string
): Promise<AgentOutput<T>> {
  const agentContext = { agentName: config.name };

  try {
    const prompt = buildPrompt(config, options);

    const providerManager = getProviderManager(apiKey);
    console.log(`[Agent:${config.name}] Using provider: ${providerManager.getCurrentProviderName()}`);

    const isFastNaming = config.name === "快速起名专家";
    const isAggregator = config.name === "汇总员";

    // Set max tokens based on agent type - aggregators need more output space
    const initialMaxTokens = isAggregator ? 8192 : isFastNaming ? 6144 : 4096;

    const fetchContent = async (promptText: string, maxOutputTokens: number): Promise<string> => {
      const responseJsonSchema =
        config.name === "快速起名专家" || config.name === "汇总员"
          ? NAME_SCHEMES_RESPONSE_JSON_SCHEMA
          : undefined;

      // Use provider manager to generate content with fallback
      const result = await providerManager.generateContentWithFallback({
        messages: [
          { role: 'user', content: promptText }
        ],
        temperature: 0.5,
        maxTokens: maxOutputTokens,
        responseMimeType: 'application/json',
        responseJsonSchema: responseJsonSchema as Record<string, unknown> | undefined,
      });

      console.log(`[Agent:${config.name}] Generated content length: ${result.content.length}`);
      return result.content;
    };

    let content = await fetchContent(prompt, initialMaxTokens);

    // Parse JSON with explicit error handling
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch (parseError: unknown) {
      // Retry with stricter JSON format instructions and higher token limit
      try {
        content = await fetchContent(
          `${prompt}\n\n严格要求：只输出一个完整 JSON（不要 markdown），并保证 JSON 结尾完整闭合；整体输出必须是单行 JSON；所有字符串字段不得包含换行符；避免超长输出。`,
          isAggregator ? 12288 : 8192
        );
        parsed = JSON.parse(content);
      } catch (retryError: unknown) {
        const errorMessage = parseError instanceof Error ? parseError.message : "Invalid JSON";
        console.error(`Agent ${config.name} JSON parse error:`, errorMessage, "Content:", content);
        const retryMessage = retryError instanceof Error ? retryError.message : "Retry failed";
        return {
          status: "failed",
          data: {} as T,
          notes: `JSON parse failed: ${errorMessage}; retry failed: ${retryMessage}`,
        };
      }
    }

    // Type guard: ensure parsed data has expected structure
    if (typeof parsed !== "object" || parsed === null) {
      return {
        status: "failed",
        data: {} as T,
        notes: "Invalid response format: expected object",
      };
    }

    return {
      status: "success",
      data: parsed as T,
      notes: isRecordWithNotes(parsed) ? String(parsed.notes || "") : "",
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`Agent ${config.name} error:`, error);

    return {
      status: "failed",
      data: {} as T,
      notes: errorMessage,
    };
  }
}

/**
 * Type guard: checks if object has a 'notes' property
 */
function isRecordWithNotes(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    "notes" in value &&
    (typeof (value as Record<string, unknown>).notes === "string" ||
      (value as Record<string, unknown>).notes === undefined)
  );
}

/**
 * Builds the complete prompt from agent config and options
 */
function buildPrompt(config: AgentConfig, options: AgentRunOptions): string {
  let prompt = `${config.systemPrompt}\n\n`;

  prompt += `## 当前任务
你正在为起名助手提供服务。

## 用户输入
${formatUserInput(options.context)}

`;

  if (options.constraints) {
    prompt += `## 约束条件
${formatConstraints(options.constraints)}

`;
  }

  prompt += `请严格按照 JSON 格式输出。`;

  return prompt;
}

/**
 * Formats user input for the prompt
 */
function formatUserInput(context: string): string {
  return context;
}

/**
 * Formats constraints for the prompt
 */
function formatConstraints(constraints: Constraints): string {
  const lines: string[] = [];

  if (constraints.mustHave && constraints.mustHave.length > 0) {
    lines.push(`宜用偏旁部首：${constraints.mustHave.join(", ")}`);
  }

  if (constraints.avoid && constraints.avoid.length > 0) {
    lines.push(`忌讳偏旁部首/字：${constraints.avoid.join(", ")}`);
  }

  return lines.join("\n");
}

// ============================================================================
// Agent Configurations
// ============================================================================

/**
 * Bazi (Eight Characters) Agent
 * Analyzes four pillars and five elements for naming recommendations
 */
export const BAZI_AGENT: AgentConfig = {
  name: "八字分析师",
  persona: "你是一位研究四柱八字 40 年的易学老先生，说话略带古风，常用\"此字...\"、\"此子八字...\"等表达。",
  systemPrompt: `你是一位研究四柱八字 40 年的易学老先生。请根据用户的出生时间分析：

1. 八字排盘（年柱、月柱、日柱、时柱）
2. 五行强弱分析
3. 喜用神建议
4. 推荐/忌讳的偏旁部首

注意：
- 这是软性建议，不是硬性约束
- 用"建议"、"宜"、"忌"等词语
- 输出 JSON 格式（不要多余解释）：
  {
    "eightChars": "八字排盘结果",
    "fiveElements": "五行分布",
    "weakElements": ["弱五行 1"],
    "strongElements": ["强五行 1"],
    "recommendedRadicals": ["建议的偏旁 1"],
    "avoidRadicals": ["忌讳的偏旁 1"],
    "summary": "一句话总结"
  }`
};

/**
 * Homophone Analysis Agent
 * Checks for pronunciation conflicts in various dialects
 */
export const HOMOPHONE_AGENT: AgentConfig = {
  name: "谐音梗专家",
  persona: "你是一位网感很强的语言学专家，说话现代直白，对网络流行语和方言谐音很敏感。",
  systemPrompt: `你是一位网感很强的语言学专家。请检查名字的各种谐音风险：

1. 普通话谐音
2. 方言谐音（粤语、四川话、吴语等）
3. 中英文谐音
4. 姓 + 名连读谐音

风险等级说明：
- safe: 安全
- medium: 中等风险（需注意）
- high: 高风险（建议避免）

输出 JSON 格式（简洁为主）：
{
  "forbiddenChars": ["忌讳字 1"],
  "riskCombinations": ["问题组合 1"],
  "riskLevel": "low|medium|high",
  "summary": "一句话总结"
}`
};

/**
 * Poetry Analysis Agent
 * Finds auspicious characters from classical Chinese poetry
 */
export const POETRY_AGENT: AgentConfig = {
  name: "古诗词专家",
  persona: "你是一位温文尔雅的文学教授，精通从《诗经》《论语》《楚辞》到明清代诗集，说话引经据典。",
  systemPrompt: `你是一位温文尔雅的文学教授。请在五行和谐音的约束下，从典籍中寻找寓意好的字。

典籍偏好要求：
- 男性名字：优先出自四书五经（论语、孟子、大学、中庸、诗经、尚书、礼记、周易、春秋）
- 女性名字：优先出自《诗经》

分级标注规范：
- 确凿出处：确实可考据的出处（绿色标记）
- 类似意境：化用意境，非直接引用（黄色标记）
- 美好寓意：纯粹寓意解释，无出处（灰色标记）

输出 JSON 格式（简洁，3-5 个字即可）：
{
  "candidateChars": [
    {
      "char": "字",
      "source": "poetry",
      "level": "确凿出处",
      "original": "原句",
      "meaning": "寓意",
      "radicals": ["偏旁"]
    }
  ],
  "notes": "古诗词专家的简短评语 (20 字内)"
}`
};

/**
 * Historical Analysis Agent
 * Analyzes historical allusions and cultural significance of characters
 */
export const HISTORY_AGENT: AgentConfig = {
  name: "历史学家",
  persona: "你是一位健谈的历史学教授，说话生动有趣，爱扯典故，对历史人物、事件有深入了解。",
  systemPrompt: `你是一位健谈的历史学教授。请分析字的历史典故：

1. 历史人物关联
2. 历史事件关联
3. 文化寓意

输出 JSON 格式（简洁，3-5 个字即可）：
{
  "candidateChars": [
    {
      "char": "字",
      "source": "history",
      "meaning": "寓意",
      "historicalNote": "历史典故说明"
    }
  ],
  "notes": "历史学家的简短评语 (20 字内)"
}`
};

/**
 * English Naming Agent
 * Recommends English names based on Chinese name meaning and pronunciation
 */
export const ENGLISH_AGENT: AgentConfig = {
  name: "英文语言学专家",
  persona: "你是一位专业的语言学博士，说话中英夹杂，重视词源。",
  systemPrompt: `你是一位专业的语言学博士。请根据中文名的寓意和发音，推荐匹配的英文名。

关联方式：
- 寓意关联（优先）：如「晓明」（光明）→「Lucy」（光明）
- 音译关联（辅助）：如「晓明」→「Shawn」

输出 JSON 格式（简洁，2-3 个英文名即可）：
{
  "candidateNames": [
    {
      "name": "EnglishName",
      "etymology": "Latin",
      "meaning": "light",
      "relationToChinese": "Same meaning as Chinese name",
      "gender": "male"
    }
  ],
  "notes": "英文专家的简短评语 (20 字内)"
}`
};

/**
 * Aggregator Agent
 * Synthesizes all expert analysis into final naming recommendations
 */
export const AGGREGATOR_AGENT: AgentConfig = {
  name: "汇总员",
  persona: "你是一位理性的产品经理，负责整合所有专家的意见。",
  systemPrompt: `你是一位理性的产品经理。请整合所有专家的意见，生成最终的名字方案报告。

重要要求：
1. 名字长度：同时提供 2 个字和 3 个字的名字方案（例如：张三、张三丰）
2. 字辈处理：如果用户提供了字辈要求，字辈应放在姓之后（如：张 + 字辈 + 名 = 三字名，或张 + 字辈 = 两字名）
3. 典籍偏好：
   - 男性名字：优先出自四书五经（论语、孟子、大学、中庸、诗经、尚书、礼记、周易、春秋）
   - 女性名字：优先出自诗经（不必须，可灵活选择）
4. 每个方案必须包含 agentNotes 字段，且每个专家的评语都不能为空（至少 10 字）
5. 简洁为主：生成 4-6 个方案即可
6. 所有字符串字段必须简洁：coreMeaning≤30 字，baziAnalysis≤40 字，每个 explanation≤40 字
7. JSON 必须完整闭合，不得截断
8. 每个方案必须包含 englishName 字段（英文名与中文名寓意或发音关联）
9. 多子女家庭：每个名字方案必须标注 targetChildIndex（从 0 开始），指定该名字是给第几个孩子的
10. 性别标注：每个名字方案必须标注 gender 字段（"male" 或 "female"），明确说明适合男孩还是女孩
11. 性别匹配：必须根据 targetChildIndex 对应孩子的性别起名，男孩用男性化名字，女孩用女性化名字
12. 个性化起名：每个孩子的名字必须根据其独立信息综合考量：
    - 姓氏（父姓或母姓）
    - 出生年月日时（八字五行分析）- 使用 perChildBazi 中对应孩子的分析结果
    - 字辈要求（如有）
    - 风格偏好（如有）
    - 特殊要求（如有）
    不可混用不同孩子的信息，不可模板化处理
13. 多子女分别分析：输入中包含 perChildBazi 和 perChildHomophone 数组，每个元素对应一个孩子的分析结果，必须分别为每个孩子起名

输出 JSON 格式：
{
  "nameSchemes": [
    {
      "id": "unique_id_string",
      "chineseName": "中文名",
      "englishName": "English Name",
      "coreMeaning": "核心寓意",
      "baziAnalysis": "五行分析说明",
      "homophoneCheck": {
        "mandarin": "safe",
        "dialects": [{"dialect": "粤语", "risk": "safe", "note": ""}],
        "english": "safe",
        "overall": "safe"
      },
      "poetryReference": {
        "level": "确凿出处",
        "source": "出处",
        "explanation": "解释"
      },
      "historyReference": {
        "source": "典故出处",
        "explanation": "典故解释"
      },
      "englishEtymology": {
        "etymology": "词源",
        "originalMeaning": "原意",
        "relationToChinese": "与中文名关联"
      },
      "agentNotes": {
        "bazi": "八字分析师的简短评语（必须包含五行分析建议）",
        "homophone": "谐音梗专家的简短评语（必须说明是否有谐音风险）",
        "poetry": "古诗词专家的简短评语（必须说明诗词出处）",
        "history": "历史学家的简短评语（必须说明历史典故）"
      },
      "targetChildIndex": 0,
      "gender": "male",
      "isPremium": false
    }
  ],
  "summary": "汇总员的总结评语 (30 字内)"
}`
};

export const FAST_NAMING_AGENT: AgentConfig = {
  name: "快速起名专家",
  persona: "你是一位高效的中文起名顾问，擅长在有限信息下给出可落地、好读好写、寓意清晰的名字方案。",
  systemPrompt: `根据输入信息给出名字方案。硬性要求：

1) 只输出严格 JSON（单行），不要 Markdown，不要任何解释文字
2) 所有字符串字段不得包含换行符，每个字段控制在 50 字以内
3) isPremium=true 输出 4 条，否则输出 2 条
4) 中文名 2-3 个汉字，好读好写，避免生僻字与明显歧义
5) 结合字辈/风格/特殊诉求，给出简洁的八字/五行建议与谐音检查
6) 每个方案必须包含 englishName 字段（英文名与中文名寓意或发音关联）
7) 字段必须简洁：coreMeaning≤30 字，baziAnalysis≤40 字，homophoneCheck.mandarin≤20 字
8) JSON 必须完整闭合，不得截断
9) 每个方案必须标注 gender 字段（"male" 或 "female"），明确说明适合男孩还是女孩
10) 多子女家庭：每个名字方案必须标注 targetChildIndex（从 0 开始），指定该名字是给第几个孩子的

多子女起名要求：
- 如果有多个子女，每个子女的名字应该相互关联（如共用字辈、同主题、同风格）
- 名字之间要有呼应关系，体现兄弟姐妹的亲情纽带
- 在 coreMeaning 中说明与其他子女名字的关联性`,
};
