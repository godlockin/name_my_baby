/**
 * Base Agent module for running AI agents via Gemini API
 *
 * Provides a generic agent runner that executes prompts with structured JSON output.
 * Each agent has a specific persona and system prompt for its domain expertise.
 *
 * @module agents
 */

import { AgentOutput, Constraints, BaziData, HomophoneData, PoetryData, HistoryData } from "../types";

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
 * Gemini API response structure
 */
interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text: string;
      }>;
    };
  }>;
}

/**
 * Structured error with context for Gemini API failures
 */
interface GeminiApiError extends Error {
  code?: string;
  status?: number;
}

/**
 * Creates a Gemini API error with context
 */
function createGeminiError(message: string, status?: number): GeminiApiError {
  const error = new Error(message) as GeminiApiError;
  error.status = status;
  return error;
}

/**
 * Runs an agent with the given configuration and options
 *
 * @param config - Agent configuration (name, persona, system prompt)
 * @param options - Run options (context, constraints)
 * @param apiKey - Gemini API key
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
  const agentContext = { agentName: config.name };

  try {
    const prompt = buildPrompt(config, options);

    console.log(`[Agent:${config.name}] Starting HTTPS request to Gemini API...`);

    const requestBody = JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: prompt,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 32768,
        responseMimeType: "application/json",
      },
    });

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: requestBody,
        // Add signal for timeout handling
        signal: AbortSignal.timeout(60000), // 60 second timeout
      }
    );

    console.log(`[Agent:${config.name}] Response status: ${response.status}`);

    if (!response.ok) {
      // Try to get error details from response
      const errorBody = await response.text();
      console.error(`[Agent:${config.name}] Gemini API error body:`, errorBody);
      throw createGeminiError(`Gemini API error: ${response.status} - ${errorBody}`, response.status);
    }

    const geminiResponse = await response.json() as GeminiResponse;
    const content = geminiResponse.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!content) {
      return {
        status: "failed",
        data: {} as T,
        notes: "No content generated",
      };
    }

    // Parse JSON with explicit error handling
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch (parseError: unknown) {
      const errorMessage = parseError instanceof Error ? parseError.message : "Invalid JSON";
      console.error(`Agent ${config.name} JSON parse error:`, errorMessage, "Content:", content);
      return {
        status: "failed",
        data: {} as T,
        notes: `JSON parse failed: ${errorMessage}`,
      };
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
- 输出 JSON 格式：
  {
    "eightChars": "八字排盘结果",
    "fiveElements": "五行分布",
    "weakElements": ["弱五行 1", "弱五行 2"],
    "strongElements": ["强五行 1"],
    "recommendedRadicals": ["建议的偏旁 1", "建议的偏旁 2"],
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

输出 JSON 格式：
{
  "forbiddenChars": ["忌讳字 1", "忌讳字 2"],
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

输出 JSON 格式：
{
  "candidateChars": [
    {
      "char": "字",
      "source": "poetry",
      "level": "确凿出处",
      "original": "原句",
      "meaning": "寓意",
      "radicals": ["偏旁"],
      "gender": "male"
    }
  ],
  "notes": "古诗词专家的简短评语"
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

输出 JSON 格式：
{
  "candidateChars": [
    {
      "char": "字",
      "source": "history",
      "meaning": "寓意",
      "historicalNote": "历史典故说明"
    }
  ],
  "notes": "历史学家的简短评语"
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

输出 JSON 格式：
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
  "notes": "英文专家的简短评语"
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
2. 典籍偏好：
   - 男性名字：优先出自四书五经（论语、孟子、大学、中庸、诗经、尚书、礼记、周易、春秋）
   - 女性名字：优先出自诗经（不必须，可灵活选择）
3. 每个方案必须包含 agentNotes 字段，用于在「专家组综合考量」中展示

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
        "bazi": "八字分析师的简短评语",
        "homophone": "谐音梗专家的简短评语",
        "poetry": "古诗词专家的简短评语",
        "history": "历史学家的简短评语"
      },
      "isPremium": false
    }
  ],
  "summary": "汇总员的总结评语"
}`
};
