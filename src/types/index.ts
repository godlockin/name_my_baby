// Shared types for the entire application

// ============================================================================
// User Input
// ============================================================================

export interface UserInput {
  fatherName: string;
  motherName: string;
  children: ChildInfo[];
  generationChar?: string;
  stylePreference?: string;
  specialRequests?: string;
  phone?: string;
  inviteCode?: string;
  deviceId?: string;
  surnameChoice?: "father" | "mother"; // 随父姓或随母姓
}

export interface ChildInfo {
  id: string;
  name?: string; // Optional, for reference only
  gender: "male" | "female";
  birthYear: number;    // YYYY format, e.g., 2024
  birthMonth: number;   // MM format (1-12)
  birthDay: number;     // DD format (1-31)
  birthHour: string;    // HH format (00-23)
}

// ============================================================================
// Agent System
// ============================================================================

export type AgentStatus = "success" | "failed" | "timeout";

export interface AgentOutput<T = unknown> {
  status: AgentStatus;
  data: T;
  constraints?: Constraints;
  notes: string;
}

export interface Constraints {
  mustHave?: string[]; // e.g., ['氵', '木']
  avoid?: string[]; // e.g., ['火', '默', '语']
}

// ============================================================================
// Round 1: Foundation Analysis
// ============================================================================

export interface BaziData {
  eightChars: string; // 八字排盘
  fiveElements: string; // 五行分布
  weakElements: string[]; // 弱的五行
  strongElements: string[]; // 强的五行
  recommendedRadicals: string[]; // 建议的偏旁部首
  avoidRadicals: string[]; // 忌讳的偏旁部首
  summary: string;
}

export interface HomophoneData {
  forbiddenChars: string[]; // 忌讳的字
  riskCombinations: string[]; // 有问题的组合
  riskLevel: "low" | "medium" | "high";
  summary: string;
}

// ============================================================================
// Round 2: Creative Analysis
// ============================================================================

export interface PoetryData {
  candidateChars: CandidateChar[];
}

export interface HistoryData {
  candidateChars: CandidateChar[];
}

export interface EnglishData {
  candidateNames: EnglishName[];
}

export interface CandidateChar {
  char: string;
  source: "user_specified" | "poetry" | "history";
  level?: "确凿出处" | "类似意境" | "美好寓意";
  original?: string; // 原句
  meaning: string;
  radicals?: string[];
}

export interface EnglishName {
  name: string;
  etymology: string; // 词源
  meaning: string; // 含义
  relationToChinese: string; // 与中文名的关联
  gender: "male" | "female" | "unisex";
}

// ============================================================================
// Round 3: Final Output
// ============================================================================

export interface NameScheme {
  id: string;
  chineseName: string;
  englishName?: string;
  coreMeaning: string;
  baziAnalysis: string;
  homophoneCheck: HomophoneResult;
  poetryReference?: Reference;
  historyReference?: Reference;
  englishEtymology?: EnglishEtymology;
  childrenCorrelation?: string; // For multiple children
  isPremium: boolean;
  // Extended analysis data for tree diagram display
  baziDetails?: BaziData; // 八字排盘详情
  fiveElementsDistribution?: string; // 五行分布
  agentNotes?: {
    bazi?: string; // 八字分析师注释
    homophone?: string; // 谐音梗专家注释
    poetry?: string; // 古诗词专家注释
    history?: string; // 历史学家注释
  };
  surnameSource?: "father" | "mother"; // 姓氏来源
}

export interface HomophoneResult {
  mandarin: RiskLevel;
  dialects: DialectRisk[];
  english: RiskLevel;
  overall: RiskLevel;
}

export interface DialectRisk {
  dialect: string;
  risk: RiskLevel;
  note?: string;
}

export type RiskLevel = "safe" | "medium" | "high";

export interface Reference {
  level: "确凿出处" | "类似意境" | "美好寓意";
  source?: string;
  original?: string;
  explanation: string;
}

export interface EnglishEtymology {
  etymology: string;
  originalMeaning: string;
  relationToChinese: string;
}

// ============================================================================
// Shared Context
// ============================================================================

export interface SharedContext {
  sessionId: string;
  userInput: UserInput;
  round1?: {
    baziAnalysis: AgentOutput<BaziData>;
    homophoneCheck: AgentOutput<HomophoneData>;
  };
  round2?: {
    poetry: AgentOutput<PoetryData>;
    history: AgentOutput<HistoryData>;
    english: AgentOutput<EnglishData>;
  };
  round3?: {
    finalNames: NameScheme[];
  };
}

// ============================================================================
// Database Types
// ============================================================================

export interface InviteCode {
  code: string;
  creator_device_id: string;
  creator_phone?: string;
  used_by_device_id?: string;
  used_by_phone?: string;
  status: "available" | "used" | "expired";
  created_at: number;
  used_at?: number;
  expires_at: number;
}

export interface UserSession {
  id: string;
  device_id: string;
  phone?: string;
  input_data: string; // JSON
  result_data?: string; // JSON
  invite_code_used?: string;
  is_premium: boolean;
  created_at: number;
  updated_at: number;
}

// ============================================================================
// Database Record Types (for D1 query results)
// ============================================================================

/**
 * Raw database record for invite_codes table
 */
export interface InviteCodeRecord {
  code: string;
  creator_device_id: string;
  creator_phone: string | null;
  used_by_device_id: string | null;
  used_by_phone: string | null;
  status: "available" | "used" | "expired";
  created_at: number;
  used_at: number | null;
  expires_at: number;
}

/**
 * Raw database record for user_sessions table
 */
export interface UserSessionRecord {
  id: string;
  device_id: string;
  phone: string | null;
  input_data: string;
  result_data: string | null;
  invite_code_used: string | null;
  is_premium: number; // SQLite stores boolean as integer
  created_at: number;
  updated_at: number;
}

// ============================================================================
// API Response Types
// ============================================================================

/**
 * Standard API error response
 */
export interface ApiError {
  error: string;
  code: string;
  reason?: string;
  details?: string[];
  retryAfter?: number;
}

/**
 * POST /api/generate response
 */
export interface GenerateResponse {
  sessionId: string;
  status: "processing";
  estimatedTime: number; // seconds
}

/**
 * GET /api/job/:id response
 */
export interface JobStatusResponse {
  sessionId: string;
  status: "processing" | "completed" | "failed";
  names?: NameScheme[];
  isPremium?: boolean;
  error?: string;
}

/**
 * POST /api/invite/verify response
 */
export interface InviteVerifyResponse {
  valid: boolean;
  reason?: string;
}

/**
 * POST /api/invite/use response
 */
export interface InviteUseResponse {
  valid: boolean;
  reason?: string;
  message?: string;
}

/**
 * GET /api/history response
 */
export interface HistorySession {
  id: string;
  input_data: string;
  result_data: string | null;
  invite_code_used: string | null;
  is_premium: boolean;
  created_at: number;
}

export interface HistoryResponse {
  sessions: HistorySession[];
}

// ============================================================================
// Admin API Response Types
// ============================================================================

/**
 * POST /api/admin/invite/generate response
 */
export interface AdminGenerateInviteResponse {
  codes: string[];
}

/**
 * GET /api/admin/invite/list response
 */
export interface AdminListInviteResponse {
  codes: InviteCodeRecord[];
}
