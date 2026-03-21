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
  BAZI_AGENT,
  HOMOPHONE_AGENT,
  POETRY_AGENT,
  HISTORY_AGENT,
  ENGLISH_AGENT,
  AGGREGATOR_AGENT,
} from "./agents";
import { buildConstraints, isPremiumUser } from "./utils";

/**
 * Configuration options for the Agent Team
 */
export interface AgentTeamOptions {
  /** Gemini API key for accessing AI models */
  apiKey: string;
  /** Optional custom runAgent function for testing (dependency injection) */
  runAgentFn?: typeof runAgent;
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
  private apiKey: string;
  private runAgentFn: typeof runAgent;

  constructor(options: AgentTeamOptions) {
    this.apiKey = options.apiKey;
    this.runAgentFn = options.runAgentFn || runAgent;
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

    // Update session status at start
    await this.updateSessionStatus(context.sessionId, "processing", "开始分析：八字分析师和 harmonious 专家正在并行工作...");

    // Round 1: Parallel foundation analysis
    console.log("Round 1: Running parallel foundation analysis...");
    const [baziResult, homophoneResult] = await Promise.all([
      this.runBaziAgent(userInput),
      this.runHomophoneAgent(userInput),
    ]);

    context.round1 = {
      baziAnalysis: baziResult,
      homophoneCheck: homophoneResult,
    };

    await this.updateSessionStatus(context.sessionId, "processing", "八字分析完成，正在进行古诗词和历史典故分析...");

    // Build constraints for Round 2
    const constraints = buildConstraints(baziResult, homophoneResult);

    // Round 2: Parallel creative analysis
    console.log("Round 2: Running parallel creative analysis...");
    const isPremium = isPremiumUser(context);

    const [poetryResult, historyResult, englishResult] = await Promise.all([
      this.runPoetryAgent(userInput, constraints),
      this.runHistoryAgent(userInput, constraints),
      // Only run English agent for premium users
      isPremium ? this.runEnglishAgent(userInput, constraints) : Promise.resolve(this.createEmptyEnglishResult()),
    ]);

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
  private async runBaziAgent(input: UserInput): Promise<AgentOutput<BaziData>> {
    const context = this.formatInputContext(input);
    console.log("[BaziAgent] Starting agent run with context:", context.substring(0, 100));
    const result = await this.runAgentFn<BaziData>(BAZI_AGENT, { context }, this.apiKey);
    console.log("[BaziAgent] Agent returned:", result.status);
    return result;
  }

  /**
   * Runs the homophone analysis agent
   */
  private async runHomophoneAgent(input: UserInput): Promise<AgentOutput<HomophoneData>> {
    const context = this.formatInputContext(input);
    console.log("[HomophoneAgent] Starting agent run");
    const result = await this.runAgentFn<HomophoneData>(HOMOPHONE_AGENT, { context }, this.apiKey);
    console.log("[HomophoneAgent] Agent returned:", result.status);
    return result;
  }

  /**
   * Runs the poetry analysis agent with constraints
   */
  private async runPoetryAgent(input: UserInput, constraints: Constraints): Promise<AgentOutput<PoetryData>> {
    const context = this.formatInputContext(input);
    return this.runAgentFn<PoetryData>(POETRY_AGENT, { context, constraints }, this.apiKey);
  }

  /**
   * Runs the history analysis agent with constraints
   */
  private async runHistoryAgent(input: UserInput, constraints: Constraints): Promise<AgentOutput<HistoryData>> {
    const context = this.formatInputContext(input);
    return this.runAgentFn<HistoryData>(HISTORY_AGENT, { context, constraints }, this.apiKey);
  }

  /**
   * Runs the English naming agent with constraints
   */
  private async runEnglishAgent(input: UserInput, constraints: Constraints): Promise<AgentOutput<EnglishData>> {
    const context = this.formatInputContext(input);
    return this.runAgentFn<EnglishData>(ENGLISH_AGENT, { context, constraints }, this.apiKey);
  }

  /**
   * Creates an empty English result for non-premium users
   */
  private createEmptyEnglishResult(): AgentOutput<EnglishData> {
    return {
      status: "success",
      data: { candidateNames: [] },
      notes: "English names not available for free users",
    };
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

    // Build aggregation context
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
      this.apiKey
    );

    if (result.status !== "success") {
      throw new Error(`Aggregation failed: ${result.notes}`);
    }

    // Post-process: ensure correct premium flag and limit results
    let schemes = result.data.nameSchemes || [];

    if (!isPremium) {
      // Free users get only 2 basic schemes
      schemes = schemes.slice(0, 2).map((scheme) => ({
        ...scheme,
        isPremium: false,
        englishName: undefined,
      }));
    }

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
