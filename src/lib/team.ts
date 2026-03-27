/**
 * Agent Team Orchestrator
 *
 * Coordinates multiple specialized AI agents to generate baby naming recommendations.
 * Uses a three-round process: foundation analysis, creative analysis, and aggregation.
 *
 * @module team
 */

import {
  SharedContext,
  UserInput,
  NameScheme,
  AgentOutput,
  BaziData,
  HomophoneData,
  PoetryData,
  HistoryData,
  EnglishData,
  Constraints,
} from "../types";
import {
  runAgent,
  initializeProviders,
  BAZI_AGENT,
  HOMOPHONE_AGENT,
  POETRY_AGENT,
  HISTORY_AGENT,
  ENGLISH_AGENT,
  AGGREGATOR_AGENT,
  FAST_NAMING_AGENT,
  type LLMProvider,
} from "./agents";
import { buildConstraints, isPremiumUser } from "./utils";

/**
 * Configuration options for the Agent Team
 */
export interface AgentTeamOptions {
  /** API key(s) for accessing AI models (supports single key or multiple provider keys) */
  apiKey: string | {
    geminiApiKey?: string;
    zhipuApiKey?: string;
  };
  /** Optional custom runAgent function for testing (dependency injection) */
  runAgentFn?: typeof runAgent;
  /** Optional flag to run in degraded mode (poetry agent only) */
  degradedMode?: boolean;
  fastMode?: boolean;
  /** Preferred LLM provider (default: 'gemini') */
  defaultProvider?: LLMProvider;
}

/**
 * Agent Team class that orchestrates multiple AI agents
 *
 * The generation process follows a three-round pipeline:
 * 1. Foundation Analysis (Bazi + Homophone check) - runs in parallel
 * 2. Creative Analysis (Poetry + History + English) - runs in parallel
 * 3. Aggregation - combines all results into final recommendations
 *
 * @example
 * ```typescript
 * const team = new AgentTeam({ apiKey: "your-api-key" });
 * const context = { sessionId: "123", userInput: input };
 * const names = await team.generate(context);
 * ```
 */
export class AgentTeam {
  private apiKey: string | { geminiApiKey?: string; zhipuApiKey?: string };
  private runAgentFn: typeof runAgent;
  private degradedMode: boolean;
  private fastMode: boolean;
  private initialized = false;
  private primaryApiKey: string;

  constructor(options: AgentTeamOptions) {
    this.apiKey = options.apiKey;
    this.runAgentFn = options.runAgentFn || runAgent;
    this.degradedMode = options.degradedMode || false;
    this.fastMode = options.fastMode || false;

    // Determine primary API key for backward compatibility
    if (typeof options.apiKey === 'string') {
      this.primaryApiKey = options.apiKey;
    } else {
      this.primaryApiKey = options.apiKey.geminiApiKey || options.apiKey.zhipuApiKey || '';
    }

    // Initialize providers if not already done
    if (!this.initialized) {
      const geminiKey = typeof options.apiKey === 'string' ? options.apiKey : options.apiKey.geminiApiKey;
      const zhipuKey = typeof options.apiKey === 'object' ? options.apiKey.zhipuApiKey : undefined;

      if (geminiKey || zhipuKey) {
        initializeProviders({
          geminiApiKey: geminiKey,
          zhipuApiKey: zhipuKey,
          defaultProvider: options.defaultProvider || 'gemini',
        });
        this.initialized = true;
      }
    }
  }

  /**
   * Executes the full three-round generation pipeline
   *
   * @param context - Shared context containing session ID and user input
   * @returns Array of name schemes with full analysis
   * @throws Error if aggregation fails
   */
  async generate(context: SharedContext): Promise<NameScheme[]> {
    const { userInput } = context;

    // If in degraded mode, only run poetry agent and generate simplified results
    if (this.degradedMode) {
      return this.generateDegradedMode(context, userInput);
    }

    if (this.fastMode) {
      return this.generateFastMode(context, userInput);
    }

    // Update session status at start
    await this.updateSessionStatus(context.sessionId, "processing", "开始分析：八字分析师和谐音梗专家正在并行工作...");

    // Round 1: Parallel foundation analysis (Bazi + Homophone)
    console.log("Round 1: Running parallel foundation analysis...");
    const [baziResult, homophoneResult] = await Promise.all([
      this.runBaziAgent(userInput),
      this.runHomophoneAgent(userInput),
    ]);

    // Handle partial failures - continue with available results
    if (baziResult.status === "failed" && homophoneResult.status === "failed") {
      console.warn("Both foundation agents failed, returning degraded results");
      // Return minimal results instead of complete failure
      return this.generateFullDegradedResults(context, userInput);
    }

    context.round1 = {
      baziAnalysis: baziResult,
      homophoneCheck: homophoneResult,
    };

    await this.updateSessionStatus(context.sessionId, "processing", "八字分析完成，正在进行古诗词/历史/英文专家分析...");

    // Build constraints for Round 2 (only if agents succeeded)
    const constraints = buildConstraints(baziResult, homophoneResult);
    const isPremium = isPremiumUser(context);

    // Round 2: Parallel creative analysis (Poetry + History + English)
    console.log("Round 2: Running parallel creative analysis...");

    let poetryResult: AgentOutput<PoetryData>;
    let historyResult: AgentOutput<HistoryData>;
    let englishResult: AgentOutput<EnglishData>;

    if (isPremium) {
      [poetryResult, historyResult, englishResult] = await Promise.all([
        this.runPoetryAgent(userInput, constraints),
        this.runHistoryAgent(userInput, constraints),
        this.runEnglishAgent(userInput, constraints),
      ]);
    } else {
      [poetryResult, historyResult] = await Promise.all([
        this.runPoetryAgent(userInput, constraints),
        this.runHistoryAgent(userInput, constraints),
      ]);
      englishResult = { status: "failed", data: { candidateNames: [] }, notes: "未启用" };
    }

    // Handle partial failures in Round 2 - continue with available results
    const hasAnyCreativeResult =
      poetryResult.status === "success" ||
      historyResult.status === "success" ||
      (isPremium && englishResult.status === "success");

    if (!hasAnyCreativeResult) {
      console.warn("All creative agents failed, returning degraded results");
      return this.generateFullDegradedResults(context, userInput);
    }

    context.round2 = {
      poetry: poetryResult,
      history: historyResult,
      english: englishResult,
    };

    await this.updateSessionStatus(context.sessionId, "processing", "专家组讨论中，正在汇总所有分析结果...");

    // Round 3: Aggregate results
    console.log("Round 3: Aggregating results...");
    const finalNames = await this.aggregateResults(context);

    context.round3 = {
      finalNames,
    };

    await this.updateSessionStatus(context.sessionId, "completed", "生成完成！");

    return finalNames;
  }

  private async generateFastMode(context: SharedContext, userInput: UserInput): Promise<NameScheme[]> {
    const isPremium = isPremiumUser(context);

    await this.updateSessionStatus(context.sessionId, "processing", "专家组讨论中，正在生成名字方案...");

    const aggregationContext = JSON.stringify({
      userInput,
      isPremium,
      fastMode: true,
    });

    const result = await this.runAgentFn<{ nameSchemes: NameScheme[] }>(
      FAST_NAMING_AGENT,
      { context: aggregationContext },
      this.primaryApiKey
    );

    if (result.status !== "success") {
      if (isPremium) {
        throw new Error(result.notes || "Aggregation agent failed");
      }
      return this.generateFullDegradedResults(context, userInput);
    }

    let schemes = result.data.nameSchemes || [];

    if (!isPremium) {
      schemes = schemes.slice(0, 2).map((scheme) => {
        const { englishName: _englishName, ...rest } = scheme;
        return {
          ...rest,
          isPremium: false,
        };
      });
    }

    await this.updateSessionStatus(context.sessionId, "completed", "生成完成！");

    return schemes;
  }

  /**
   * Degraded mode: only run poetry agent and generate simplified results
   * This is used when invite code is invalid but we still want to provide service
   */
  private async generateDegradedMode(context: SharedContext, userInput: UserInput): Promise<NameScheme[]> {
    console.log("[DegradedMode] Running poetry agent only...");

    await this.updateSessionStatus(context.sessionId, "processing", "古诗词专家正在分析...");

    // Only run poetry agent
    const poetryResult = await this.runPoetryAgent(userInput, { mustHave: [], avoid: [] });

    if (poetryResult.status !== "success") {
      console.warn("[DegradedMode] Poetry agent failed, returning minimal results");
      return this.generateFullDegradedResults(context, userInput);
    }

    context.round2 = {
      poetry: poetryResult,
      history: { status: "failed", data: { candidateChars: [] }, notes: "未启用" },
      english: { status: "failed", data: { candidateNames: [] }, notes: "未启用" },
    };

    await this.updateSessionStatus(context.sessionId, "processing", "正在生成名字方案...");

    // Generate simplified aggregation
    const finalNames = await this.aggregateDegradedResults(context);

    context.round3 = {
      finalNames,
    };

    await this.updateSessionStatus(context.sessionId, "completed", "生成完成（简化版）");

    return finalNames;
  }

  /**
   * Generates full degraded results when all agents fail
   * This ensures users get something instead of complete failure
   */
  private async generateFullDegradedResults(context: SharedContext, userInput: UserInput): Promise<NameScheme[]> {
    console.log("[DegradedMode] Generating minimal results...");

    // Create minimal name schemes based on user input only
    const surname = userInput.surnameChoice === "mother" ? userInput.motherName.charAt(0) : userInput.fatherName.charAt(0);
    const childGender = userInput.children[0]?.gender || "male";

    // Simple fallback names (this is a last resort)
    const fallbackNames: NameScheme[] = [
      {
        id: `fallback-1-${context.sessionId}`,
        chineseName: surname + (childGender === "male" ? "文" : "雅"),
        englishName: childGender === "male" ? "Alex" : "Anna",
        coreMeaning: "基于基本信息生成的名字",
        baziAnalysis: "八字分析暂缺",
        homophoneCheck: {
          mandarin: "safe",
          dialects: [],
          english: "safe",
          overall: "safe"
        },
        isPremium: false
      },
      {
        id: `fallback-2-${context.sessionId}`,
        chineseName: surname + (childGender === "male" ? "俊" : "美"),
        englishName: childGender === "male" ? "Ben" : "Bella",
        coreMeaning: "基于基本信息生成的名字",
        baziAnalysis: "八字分析暂缺",
        homophoneCheck: {
          mandarin: "safe",
          dialects: [],
          english: "safe",
          overall: "safe"
        },
        isPremium: false
      }
    ];

    await this.updateSessionStatus(context.sessionId, "completed", "生成完成（简化版）");

    return fallbackNames;
  }

  /**
   * Updates session status in database
   */
  private async updateSessionStatus(sessionId: string, status: string, message: string): Promise<void> {
    try {
      // This would need the DB binding - for now just log
      console.log(`[Session:${sessionId}] Status: ${status} - ${message}`);
    } catch (e) {
      console.error("Failed to update session status:", e);
    }
  }

  /**
   * Runs the Bazi (Eight Characters) analysis agent
   */
  private runBaziAgent(input: UserInput): Promise<AgentOutput<BaziData>> {
    const context = this.formatInputContext(input);
    console.log("[BaziAgent] Starting agent run with context:", context.substring(0, 100));
    return this.runAgentFn<BaziData>(BAZI_AGENT, { context }, this.primaryApiKey);
  }

  /**
   * Runs the homophone analysis agent
   */
  private runHomophoneAgent(input: UserInput): Promise<AgentOutput<HomophoneData>> {
    const context = this.formatInputContext(input);
    console.log("[HomophoneAgent] Starting agent run");
    return this.runAgentFn<HomophoneData>(HOMOPHONE_AGENT, { context }, this.primaryApiKey);
  }

  /**
   * Runs the poetry analysis agent with constraints
   */
  private runPoetryAgent(input: UserInput, constraints: Constraints): Promise<AgentOutput<PoetryData>> {
    const context = this.formatInputContext(input);
    return this.runAgentFn<PoetryData>(POETRY_AGENT, { context, constraints }, this.primaryApiKey);
  }

  /**
   * Runs the history analysis agent with constraints
   */
  private runHistoryAgent(input: UserInput, constraints: Constraints): Promise<AgentOutput<HistoryData>> {
    const context = this.formatInputContext(input);
    return this.runAgentFn<HistoryData>(HISTORY_AGENT, { context, constraints }, this.primaryApiKey);
  }

  /**
   * Runs the English naming agent with constraints
   */
  private runEnglishAgent(input: UserInput, constraints: Constraints): Promise<AgentOutput<EnglishData>> {
    const context = this.formatInputContext(input);
    return this.runAgentFn<EnglishData>(ENGLISH_AGENT, { context, constraints }, this.primaryApiKey);
  }

  /**
   * Aggregates all agent results into final name recommendations
   *
   * @param context - Context with all round results
   * @returns Processed array of name schemes
   * @throws Error if required round results are missing or aggregation fails
   */
  private async aggregateResults(context: SharedContext): Promise<NameScheme[]> {
    const { userInput, round1, round2 } = context;

    if (!round1 || !round2) {
      throw new Error("Missing round results for aggregation");
    }

    const isPremium = isPremiumUser(context);

    // Build aggregation context - include gender info for典籍偏好
    const aggregationContext = JSON.stringify({
      userInput,
      bazi: round1.baziAnalysis,
      homophone: round1.homophoneCheck,
      poetry: round2.poetry,
      history: round2.history,
      english: round2.english,
      isPremium,
    });

    const result = await this.runAgentFn<{ nameSchemes: NameScheme[] }>(
      AGGREGATOR_AGENT,
      { context: aggregationContext },
      this.primaryApiKey
    );

    if (result.status !== "success") {
      throw new Error(`Aggregation failed: ${result.notes}`);
    }

    // Post-process: limit results for free users but KEEP english names
    let schemes = result.data.nameSchemes || [];

    if (!isPremium) {
      schemes = schemes.slice(0, 2).map((scheme) => {
        const { englishName: _englishName, ...rest } = scheme;
        return {
          ...rest,
          isPremium: false,
        };
      });
    }

    return schemes;
  }

  /**
   * Aggregates results in degraded mode (poetry agent only)
   * Uses a simplified prompt to generate names based on poetry candidates
   */
  private async aggregateDegradedResults(context: SharedContext): Promise<NameScheme[]> {
    const { userInput, round2 } = context;

    const poetryData = round2?.poetry?.data as PoetryData | undefined;
    const candidateChars = poetryData?.candidateChars || [];

    if (candidateChars.length === 0) {
      return this.generateFullDegradedResults(context, userInput);
    }

    // Build simplified aggregation context for degraded mode
    const aggregationContext = JSON.stringify({
      userInput,
      poetry: round2?.poetry,
      degradedMode: true,
    });

    const result = await this.runAgentFn<{ nameSchemes: NameScheme[] }>(
      AGGREGATOR_AGENT,
      { context: aggregationContext },
      this.primaryApiKey
    );

    if (result.status !== "success") {
      return this.generateFullDegradedResults(context, userInput);
    }

    let schemes = result.data.nameSchemes || [];

    // Limit to 2 schemes for degraded mode
    schemes = schemes.slice(0, 2).map((scheme) => ({
      ...scheme,
      isPremium: false,
    }));

    return schemes;
  }

  /**
   * Formats user input into a context string for agent prompts
   */
  private formatInputContext(input: UserInput): string {
    const childrenInfo = input.children
      .map(
        (child, index) =>
          `子女${index + 1}: ${child.gender === "male" ? "男" : "女"}, 出生时间：${child.birthYear}年${child.birthMonth}月${child.birthDay}日${child.birthHour}时`
      )
      .join("\n");

    return `父亲姓名：${input.fatherName}
母亲姓名：${input.motherName}
${childrenInfo}
字辈要求：${input.generationChar || "无"}
风格偏好：${input.stylePreference || "无"}
特殊要求：${input.specialRequests || "无"}`;
  }
}
