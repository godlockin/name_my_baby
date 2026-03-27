/**
 * Cloudflare Pages Functions - API Entry Point
 *
 * Provides RESTful API for baby naming service with:
 * - Invite code verification and management
 * - Name generation via AI agent team
 * - Session-based job status tracking
 * - User history retrieval
 *
 * @module api
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import { AgentTeam } from "../../src/lib/team";
import { generateInviteCode, generateSessionId, validateInput } from "../../src/lib/utils";
import { UserInput, InviteCodeRecord, UserSessionRecord, ApiError } from "../../src/types";
import type { PagesFunction } from "@cloudflare/workers-types";

/**
 * Environment bindings for Cloudflare Pages Functions
 */
interface Env {
  /** D1 Database binding */
  DB: D1Database;
  /** R2 Bucket binding for storage */
  BUCKET: R2Bucket;
  /** Gemini API Key */
  GEMINI_API_KEY: string;
  /** Optional: Zhipu AI (BigModel.cn) API Key */
  ZHIPU_API_KEY?: string;
  /** Optional: Admin API key for protected routes */
  API_SECRET?: string;
  /** Optional: Backdoor invite codes (comma-separated) */
  BACKDOOR_INVITE_CODES?: string;
  /** Optional: Feature flags */
  ENABLE_RATE_LIMIT?: string;
  /** Rate limit: requests per minute per IP */
  RATE_LIMIT_MAX?: string;
  /** Optional: Default LLM provider ('gemini' or 'zhipu') */
  DEFAULT_LLM_PROVIDER?: string;
}

/**
 * Rate limiter state stored in memory (per-instance)
 * For production, consider using Durable Objects or KV storage
 */
interface RateLimitState {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitState>();

/**
 * Simple in-memory rate limiter
 * @param key - Unique identifier (IP address or device ID)
 * @param maxRequests - Maximum requests allowed in window
 * @param windowMs - Time window in milliseconds
 * @returns Whether the request is allowed
 */
function checkRateLimit(key: string, maxRequests: number = 100, windowMs: number = 60000): boolean {
  const now = Date.now();
  const state = rateLimitStore.get(key);

  if (!state || now > state.resetAt) {
    // Reset window
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (state.count >= maxRequests) {
    return false;
  }

  state.count++;
  return true;
}

/**
 * Structured logger for consistent log format
 */
const logger = {
  info: (ctx: { requestId?: string; route?: string; deviceId?: string; sessionId?: string }, message: string, data?: Record<string, unknown>) => {
    console.log(JSON.stringify({
      level: "INFO",
      timestamp: new Date().toISOString(),
      requestId: ctx.requestId,
      route: ctx.route,
      message,
      ...data
    }));
  },
  error: (ctx: { requestId?: string; route?: string; deviceId?: string; sessionId?: string }, message: string, error: unknown, data?: Record<string, unknown>) => {
    const errorData = error instanceof Error
      ? { name: error.name, message: error.message, stack: error.stack }
      : { raw: error };

    console.error(JSON.stringify({
      level: "ERROR",
      timestamp: new Date().toISOString(),
      requestId: ctx.requestId,
      route: ctx.route,
      message,
      error: errorData,
      ...data
    }));
  },
  warn: (ctx: { requestId?: string; route?: string; deviceId?: string; sessionId?: string }, message: string, data?: Record<string, unknown>) => {
    console.warn(JSON.stringify({
      level: "WARN",
      timestamp: new Date().toISOString(),
      requestId: ctx.requestId,
      route: ctx.route,
      message,
      ...data
    }));
  }
};

/**
 * Generate a unique request ID for tracing
 */
function generateRequestId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Safely parse JSON with error handling
 */
function safeJsonParse<T>(input: string, fallback: T): T {
  try {
    return JSON.parse(input) as T;
  } catch {
    return fallback;
  }
}

function parseBackdoorInviteCodes(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((v) => v.trim().toUpperCase())
    .filter(Boolean);
}

function getBackdoorInviteCodes(env: Env): string[] {
  const fromBindings = parseBackdoorInviteCodes(env.BACKDOOR_INVITE_CODES);
  if (fromBindings.length > 0) return fromBindings;
  const processValue =
    typeof globalThis !== "undefined"
      ? (globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }).process?.env?.BACKDOOR_INVITE_CODES
      : undefined;
  const fromProcess = parseBackdoorInviteCodes(processValue);
  return fromProcess;
}

const MAX_GENERATION_ATTEMPTS = 3;
const GENERATION_MAX_TOTAL_MS = 10 * 60 * 1000;

type ProcessingState = {
  status: "processing";
  attemptCount?: number;
  lastAttemptAt?: number;
  nextRetryAt?: number;
  leaseUntil?: number;
  lastError?: string;
};

function parseProcessingState(value: string | null): ProcessingState | null {
  if (!value) return null;
  const parsed = safeJsonParse<unknown>(value, null);
  if (!parsed || typeof parsed !== "object") return null;
  if (!("status" in parsed) || parsed.status !== "processing") return null;
  return parsed as ProcessingState;
}

function computeBackoffMs(attempt: number): number {
  if (attempt <= 1) return 0;
  if (attempt === 2) return 10_000;
  if (attempt === 3) return 30_000;
  return 60_000;
}

async function runGenerationAttempt(params: {
  env: Env;
  sessionId: string;
  requestId: string;
}): Promise<void> {
  const { env, sessionId, requestId } = params;
  const db = env.DB;

  // Support both single API key and multi-provider configuration
  const apiKeys = {
    geminiApiKey: env.GEMINI_API_KEY,
    zhipuApiKey: env.ZHIPU_API_KEY,
  };
  const defaultProvider = (env.DEFAULT_LLM_PROVIDER as 'gemini' | 'zhipu' | undefined) || 'gemini';

  const row = await db.prepare(
    "SELECT input_data, invite_code_used, is_premium, device_id, phone, result_data, created_at FROM user_sessions WHERE id = ?"
  )
    .bind(sessionId)
    .first<{
      input_data: string | null;
      invite_code_used: string | null;
      is_premium: number;
      device_id: string | null;
      phone: string | null;
      result_data: string | null;
      created_at: number;
    }>();

  if (!row) return;

  const now = Date.now();
  if (typeof row.created_at === "number" && now - row.created_at > GENERATION_MAX_TOTAL_MS) {
    await db.prepare(
      `UPDATE user_sessions SET result_data = ?, updated_at = ? WHERE id = ?`
    )
      .bind(
        JSON.stringify({ error: "Generation timeout", status: "failed" }),
        now,
        sessionId
      )
      .run();
    return;
  }

  const existingState = parseProcessingState(row.result_data);
  const attemptCount = typeof existingState?.attemptCount === "number" ? existingState.attemptCount : 0;

  if (attemptCount >= MAX_GENERATION_ATTEMPTS) {
    await db.prepare(
      `UPDATE user_sessions SET result_data = ?, updated_at = ? WHERE id = ?`
    )
      .bind(
        JSON.stringify({ error: existingState?.lastError || "Generation failed", status: "failed" }),
        now,
        sessionId
      )
      .run();
    return;
  }

  const nextAttempt = attemptCount + 1;
  const nextRetryAt = now + computeBackoffMs(nextAttempt);

  await db.prepare(
    `UPDATE user_sessions SET result_data = ?, updated_at = ? WHERE id = ?`
  )
    .bind(
      JSON.stringify({
        status: "processing",
        attemptCount: nextAttempt,
        lastAttemptAt: now,
        nextRetryAt,
        leaseUntil: 0,
      } satisfies ProcessingState),
      now,
      sessionId
    )
    .run();

  const input = row.input_data ? safeJsonParse<UserInput>(row.input_data, null as unknown as UserInput) : null;
  if (!input) {
    await db.prepare(
      `UPDATE user_sessions SET result_data = ?, updated_at = ? WHERE id = ?`
    )
      .bind(
        JSON.stringify({ error: "Invalid input data", status: "failed" }),
        Date.now(),
        sessionId
      )
      .run();
    return;
  }

  const inviteCode = (row.invite_code_used || input.inviteCode || "").toUpperCase().trim();
  const backdoorCodes = getBackdoorInviteCodes(env);
  const isBackdoorCodeUsed = inviteCode ? backdoorCodes.includes(inviteCode) : false;

  let degradedMode = false;
  if (inviteCode && !isBackdoorCodeUsed) {
    const inviteValid = await verifyInviteCode(db, inviteCode);
    if (!inviteValid.valid) degradedMode = true;
  }

  try {
    const agentTeam = new AgentTeam({
      apiKey: apiKeys,
      degradedMode,
      fastMode: true,
      defaultProvider,
    });
    const agentContext = {
      sessionId,
      userInput: input,
    };

    logger.info({ requestId, sessionId }, "Starting agent team generation");
    const names = await Promise.race([
      agentTeam.generate(agentContext),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Upstream generation timeout")), 60_000)
      ),
    ]);

    if (!names || names.length === 0) {
      throw new Error("No names generated by agent team");
    }

    await db.prepare(
      `UPDATE user_sessions SET result_data = ?, updated_at = ? WHERE id = ?`
    )
      .bind(
        JSON.stringify(names),
        Date.now(),
        sessionId
      )
      .run();

    logger.info({ requestId, sessionId }, "Session updated with results");

    if (inviteCode && !isBackdoorCodeUsed) {
      const inviteInfo = await db.prepare(
        "SELECT is_unlimited FROM invite_codes WHERE code = ?"
      )
        .bind(inviteCode)
        .first<{ is_unlimited: number }>();

      if (inviteInfo && inviteInfo.is_unlimited !== 1) {
        await db.prepare(
          `UPDATE invite_codes SET status = 'used', used_by_device_id = ?, used_by_phone = ?, used_at = ?
           WHERE code = ?`
        )
          .bind(row.device_id || "unknown", row.phone || null, Date.now(), inviteCode)
          .run();
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown generation error";
    logger.error({ requestId, sessionId }, "Generation attempt failed", error);

    const finalAttemptCount = nextAttempt;
    const retryAt = Date.now() + computeBackoffMs(finalAttemptCount + 1);

    if (finalAttemptCount >= MAX_GENERATION_ATTEMPTS) {
      await db.prepare(
        `UPDATE user_sessions SET result_data = ?, updated_at = ? WHERE id = ?`
      )
        .bind(
          JSON.stringify({ error: errorMessage, status: "failed" }),
          Date.now(),
          sessionId
        )
        .run();
      return;
    }

    await db.prepare(
      `UPDATE user_sessions SET result_data = ?, updated_at = ? WHERE id = ?`
    )
      .bind(
        JSON.stringify({
          status: "processing",
          attemptCount: finalAttemptCount,
          lastAttemptAt: now,
          nextRetryAt: retryAt,
          leaseUntil: 0,
          lastError: errorMessage,
        } satisfies ProcessingState),
        Date.now(),
        sessionId
      )
      .run();
  }
}

const app = new Hono<{ Bindings: Env; Variables: { requestId: string } }>();

// ============================================================================
// Global Middleware
// ============================================================================

/**
 * Request logging middleware
 */
app.use("/*", async (c, next) => {
  const requestId = generateRequestId();
  c.set("requestId", requestId);

  const startTime = Date.now();
  const method = c.req.method;
  const path = c.req.path;

  logger.info({ requestId, route: `${method} ${path}` }, "Request started");

  await next();

  const duration = Date.now() - startTime;
  logger.info({ requestId, route: `${method} ${path}` }, "Request completed", {
    status: c.res.status,
    duration_ms: duration
  });
});

/**
 * CORS middleware
 */
app.use("/*", cors());

/**
 * Rate limiting middleware for non-critical endpoints
 */
app.use("/api/*", async (c, next) => {
  const clientIp = c.req.header("CF-Connecting-IP") || "unknown";
  const deviceId = c.req.header("X-Device-ID");
  const rateLimitKey = deviceId ? `device:${deviceId}` : `ip:${clientIp}`;

  const maxRequests = parseInt(c.env.RATE_LIMIT_MAX || "100", 10);

  if (!checkRateLimit(rateLimitKey, maxRequests)) {
    logger.warn({ route: c.req.path }, "Rate limit exceeded", { clientIp, deviceId });
    return c.json<ApiError>({
      error: "Rate limit exceeded",
      code: "RATE_LIMIT_EXCEEDED",
      retryAfter: 60
    }, 429);
  }

  await next();
});

// ============================================================================
// API Routes
// ============================================================================

/**
 * POST /api/generate - Submit form and generate baby names
 *
 * Creates a session, runs the AI agent team, and stores results.
 * Returns immediately with session ID for polling.
 *
 * @body {UserInput} - User input data including parent names, children info
 * @returns {GenerateResponse} - Session ID and initial status
 */
app.post("/generate", async (c) => {
  const requestId = c.get("requestId") || generateRequestId();

  try {
    const body = await c.req.json();

    // Validate request body exists and is an object
    if (!body || typeof body !== "object") {
      return c.json<ApiError>({
        error: "Invalid request body",
        code: "INVALID_BODY"
      }, 400);
    }

    const input: UserInput = body;

    // Validate input structure
    const validation = validateInput(input);
    if (!validation.valid) {
      logger.info({ requestId, route: "/api/generate" }, "Validation failed", { errors: validation.errors });
      return c.json<ApiError>({
        error: "Validation failed",
        code: "VALIDATION_ERROR",
        details: validation.errors
      }, 400);
    }

    // Check invite code if provided
    let isPremium = false;
    let inviteCodeWarning: string | undefined;
    let isBackdoorCodeUsed = false;

    if (input.inviteCode) {
      const normalizedCode = input.inviteCode.toUpperCase().trim();
      const backdoorCodes = getBackdoorInviteCodes(c.env);

      if (backdoorCodes.includes(normalizedCode)) {
        isPremium = true;
        isBackdoorCodeUsed = true;
        logger.info({ requestId, route: "/api/generate" }, "Backdoor invite code used");
      } else {
        // Check database for regular invite codes
        const inviteValid = await verifyInviteCode(c.env.DB, normalizedCode);
        if (!inviteValid.valid) {
          // Don't fail the request - just log a warning and continue as non-premium
          inviteCodeWarning = inviteValid.reason;
          logger.info({ requestId, route: "/api/generate" }, "Invalid invite code (continuing as non-premium)", {
            code: normalizedCode,
            reason: inviteValid.reason
          });
        } else {
          isPremium = true;
        }
      }
    }

    // Create session
    const sessionId = generateSessionId();
    const deviceId = body.deviceId as string | undefined;

    // Create session record FIRST (before async generation)
    // This ensures the session exists for polling even if generation fails
    await c.env.DB.prepare(
      `INSERT INTO user_sessions (id, device_id, phone, input_data, result_data, invite_code_used, is_premium, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        sessionId,
        deviceId || "unknown",
        input.phone || null,
        JSON.stringify(input),
        JSON.stringify({ status: "processing" }),
        input.inviteCode || null,
        isPremium ? 1 : 0,
        Date.now(),
        Date.now()
      )
      .run();

    logger.info({ requestId, sessionId }, "Session record created (processing state)");

    const executionCtx = (c as unknown as { executionCtx?: ExecutionContext }).executionCtx;
    if (executionCtx && typeof executionCtx.waitUntil === "function") {
      executionCtx.waitUntil(runGenerationAttempt({ env: c.env, sessionId, requestId }));
      return c.json({
        sessionId,
        status: "processing",
        isPremium
      });
    }

    await runGenerationAttempt({ env: c.env, sessionId, requestId });
    const result = await c.env.DB.prepare(
      "SELECT result_data FROM user_sessions WHERE id = ?"
    )
      .bind(sessionId)
      .first<{ result_data: string | null }>();

    const parsed = safeJsonParse<unknown>(result?.result_data || "", null);
    if (Array.isArray(parsed)) {
      return c.json({ sessionId, status: "completed", names: parsed, isPremium });
    }
    if (parsed && typeof parsed === "object" && "status" in parsed && parsed.status === "failed") {
      return c.json({ sessionId, status: "failed", error: (parsed as Record<string, unknown>)?.error || "Generation failed", isPremium });
    }
    return c.json({ sessionId, status: "processing", isPremium });
  } catch (error) {
    logger.error({ requestId }, "Generate endpoint error", error);
    return c.json<ApiError>({
      error: "Internal server error",
      code: "INTERNAL_ERROR"
    }, 500);
  }
});

/**
 * GET /api/job/:id - Get generation job status and results
 *
 * Polling endpoint for async generation results.
 * Returns processing status or completed results.
 *
 * @param id - Session ID
 * @returns {JobStatusResponse} - Job status and results if completed
 */
app.get("/job/:id", async (c) => {
  const requestId = c.get("requestId") || generateRequestId();

  try {
    const sessionId = c.req.param("id");

    // Validate session ID format
    if (!sessionId || typeof sessionId !== "string") {
      return c.json<ApiError>({
        error: "Invalid session ID",
        code: "INVALID_SESSION_ID"
      }, 400);
    }

    // Debug: Check if DB binding is available
    if (!c.env.DB) {
      console.error("DB binding not available");
      return c.json<ApiError>({
        error: "Database not configured",
        code: "DB_NOT_CONFIGURED"
      }, 500);
    }

    const result = await c.env.DB.prepare(
      "SELECT result_data, is_premium, updated_at, created_at FROM user_sessions WHERE id = ?"
    )
      .bind(sessionId)
      .first<{ result_data: string | null; is_premium: number; updated_at: number; created_at: number }>();

    if (!result) {
      logger.info({ requestId, sessionId }, "Session not found");
      return c.json<ApiError>({
        error: "Session not found",
        code: "SESSION_NOT_FOUND"
      }, 404);
    }

    let names = null;
    let hasError = false;
    let isProcessing = false;

    if (result.result_data) {
      const parsed = safeJsonParse<unknown>(result.result_data, null);
      if (parsed && typeof parsed === "object") {
        // Check for processing status
        if ("status" in parsed && parsed.status === "processing") {
          isProcessing = true;
        }
        // Check for error status
        else if ("status" in parsed && parsed.status === "failed") {
          hasError = true;
          names = parsed;
        }
        // Check for error field (legacy format)
        else if ("error" in parsed) {
          hasError = true;
          names = parsed;
        }
        // Check for completed results (array of names)
        else if (Array.isArray(parsed)) {
          names = parsed;
        }
      }
    }

    if (!names && !hasError && !isProcessing) {
      // Still processing (no result_data yet or unexpected format)
      return c.json({
        sessionId,
        status: "processing"
      });
    }

    if (isProcessing) {
      const state = parseProcessingState(result.result_data);
      const now = Date.now();
      if (typeof result.created_at === "number" && now - result.created_at > GENERATION_MAX_TOTAL_MS) {
        const errorMessage = "Generation timeout";
        await c.env.DB.prepare(
          `UPDATE user_sessions SET result_data = ?, updated_at = ? WHERE id = ?`
        )
          .bind(
            JSON.stringify({ error: errorMessage, status: "failed" }),
            now,
            sessionId
          )
          .run();
        return c.json({ sessionId, status: "failed", error: errorMessage });
      }

      const attemptCount = typeof state?.attemptCount === "number" ? state.attemptCount : 0;
      const nextRetryAt = typeof state?.nextRetryAt === "number" ? state.nextRetryAt : 0;
      const leaseUntil = typeof state?.leaseUntil === "number" ? state.leaseUntil : 0;
      if (attemptCount < MAX_GENERATION_ATTEMPTS && now >= nextRetryAt && now >= leaseUntil) {
        const leasedState: ProcessingState = {
          status: "processing",
          attemptCount,
          lastAttemptAt: state?.lastAttemptAt,
          nextRetryAt,
          leaseUntil: now + 30_000,
          lastError: state?.lastError,
        };
        await c.env.DB.prepare(
          `UPDATE user_sessions SET result_data = ?, updated_at = ? WHERE id = ?`
        )
          .bind(JSON.stringify(leasedState), now, sessionId)
          .run();

        const executionCtx = (c as unknown as { executionCtx?: ExecutionContext }).executionCtx;
        if (executionCtx && typeof executionCtx.waitUntil === "function") {
          executionCtx.waitUntil(runGenerationAttempt({ env: c.env, sessionId, requestId }));
        }
      }

      return c.json({
        sessionId,
        status: "processing"
      });
    }

    if (hasError) {
      return c.json({
        sessionId,
        status: "failed",
        error: (names as Record<string, unknown>)?.error || "Generation failed"
      });
    }

    logger.info({ requestId, sessionId }, "Job completed successfully");
    return c.json({
      sessionId,
      status: "completed",
      names,
      isPremium: !!result.is_premium
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Job status error details:", errorMessage);
    logger.error({ requestId }, "Job status error", error);
    return c.json<ApiError>({
      error: `Internal server error: ${errorMessage}`,
      code: "INTERNAL_ERROR"
    }, 500);
  }
});

/**
 * POST /api/invite/verify - Verify an invite code
 *
 * Validates invite code availability and eligibility.
 * Does not reserve or consume the code.
 *
 * @body {string} code - The invite code to verify
 * @returns {InviteVerifyResponse} - Validation result
 */
app.post("/invite/verify", async (c) => {
  const requestId = c.get("requestId") || generateRequestId();

  try {
    const body = await c.req.json();
    const code = body?.code;

    if (!code || typeof code !== "string") {
      return c.json<ApiError>({
        error: "Invalid code format",
        code: "INVALID_CODE_FORMAT"
      }, 400);
    }

    const normalizedCode = code.toUpperCase().trim();
    const backdoorCodes = getBackdoorInviteCodes(c.env);
    if (backdoorCodes.includes(normalizedCode)) {
      return c.json({ valid: true });
    }
    const result = await verifyInviteCode(c.env.DB, normalizedCode);

    logger.info({ requestId }, "Invite code verification", {
      code: normalizedCode,
      valid: result.valid
    });

    return c.json(result);
  } catch (error) {
    logger.error({ requestId }, "Invite verify error", error);
    return c.json<ApiError>({
      error: "Internal server error",
      code: "INTERNAL_ERROR"
    }, 500);
  }
});

/**
 * POST /api/invite/use - Reserve an invite code for use
 *
 * Validates and temporarily reserves an invite code.
 * The code is fully consumed when /api/generate completes.
 *
 * @body {string} code - Invite code
 * @body {string} deviceId - Device identifier
 * @body {string} [phone] - Optional phone number
 * @returns {InviteUseResponse} - Reservation confirmation
 */
app.post("/invite/use", async (c) => {
  const requestId = c.get("requestId") || generateRequestId();

  try {
    const body = await c.req.json();
    const { code, deviceId, phone } = body as {
      code?: unknown;
      deviceId?: unknown;
      phone?: unknown;
    };

    if (!code || typeof code !== "string") {
      return c.json<ApiError>({
        error: "Invite code is required",
        code: "MISSING_CODE"
      }, 400);
    }

    if (!deviceId || typeof deviceId !== "string") {
      return c.json<ApiError>({
        error: "Device ID is required",
        code: "MISSING_DEVICE_ID"
      }, 400);
    }

    const normalizedCode = code.toUpperCase().trim();
    const backdoorCodes = getBackdoorInviteCodes(c.env);
    if (backdoorCodes.includes(normalizedCode)) {
      return c.json({ valid: true, message: "邀请码验证通过" });
    }

    // Check if code exists
    const existing = await c.env.DB.prepare(
      "SELECT code, status, expires_at FROM invite_codes WHERE code = ?"
    )
      .bind(normalizedCode)
      .first<{ code: string; status: string; expires_at: number }>();

    if (!existing) {
      logger.info({ requestId }, "Invite code not found", { code: normalizedCode });
      return c.json({ valid: false, reason: "邀请码不存在" });
    }

    if (existing.status === "used") {
      logger.info({ requestId }, "Invite code already used", { code: normalizedCode });
      return c.json({ valid: false, reason: "此邀请码已使用" });
    }

    if (existing.expires_at < Date.now()) {
      logger.info({ requestId }, "Invite code expired", {
        code: normalizedCode,
        expiresAt: existing.expires_at
      });
      return c.json({ valid: false, reason: "邀请码已过期" });
    }

    logger.info({ requestId }, "Invite code validated", { code: normalizedCode });
    return c.json({ valid: true, message: "邀请码验证通过" });
  } catch (error) {
    logger.error({ requestId }, "Invite use error", error);
    return c.json<ApiError>({
      error: "Internal server error",
      code: "INTERNAL_ERROR"
    }, 500);
  }
});

/**
 * GET /api/history - Get user's generation history
 *
 * Retrieves up to 10 most recent sessions for a device.
 *
 * @query {string} deviceId - Device identifier
 * @returns {HistoryResponse} - List of user sessions
 */
app.get("/history", async (c) => {
  const requestId = c.get("requestId") || generateRequestId();

  try {
    const deviceId = c.req.query("deviceId");

    if (!deviceId || typeof deviceId !== "string") {
      return c.json<ApiError>({
        error: "Missing or invalid deviceId",
        code: "MISSING_DEVICE_ID"
      }, 400);
    }

    const sessions = await c.env.DB.prepare(
      `SELECT id, input_data, result_data, invite_code_used, is_premium, created_at
       FROM user_sessions
       WHERE device_id = ?
       ORDER BY created_at DESC
       LIMIT 10`
    )
      .bind(deviceId)
      .all<{
        id: string;
        input_data: string;
        result_data: string | null;
        invite_code_used: string | null;
        is_premium: number;
        created_at: number;
      }>();

    logger.info({ requestId, deviceId }, "History retrieved", {
      count: sessions.results?.length || 0
    });

    return c.json({
      sessions: (sessions.results || []).map(s => ({
        ...s,
        is_premium: !!s.is_premium
      }))
    });
  } catch (error) {
    logger.error({ requestId }, "History error", error);
    return c.json<ApiError>({
      error: "Internal server error",
      code: "INTERNAL_ERROR"
    }, 500);
  }
});

// ============================================================================
// Admin Routes (require authentication in production)
// ============================================================================

/**
 * POST /api/admin/invite/generate - Generate new invite codes
 *
 * Creates one or more invite codes with 30-day expiration.
 * Requires API_SECRET authentication in production.
 *
 * @body {number} [count=1] - Number of codes to generate
 * @body {string} [creatorDeviceId] - Creator device ID
 * @body {string} [creatorPhone] - Creator phone number
 * @body {boolean} [isUnlimited=false] - Whether to create unlimited use codes
 * @returns {AdminGenerateInviteResponse} - Generated codes
 */
app.post("/admin/invite/generate", async (c) => {
  const requestId = (c.get("requestId") as string) || generateRequestId();

  try {
    // Basic authentication check (should use proper auth in production)
    const apiSecret = c.env.API_SECRET;
    if (apiSecret) {
      const authHeader = c.req.header("Authorization");
      if (!authHeader || !authHeader.startsWith("Bearer ") || authHeader.slice(7) !== apiSecret) {
        logger.warn({ requestId }, "Unauthorized admin access attempt");
        return c.json<ApiError>({
          error: "Unauthorized",
          code: "UNAUTHORIZED"
        }, 401);
      }
    }

    const body = await c.req.json();
    const count = typeof body.count === "number" ? body.count : 1;
    const creatorDeviceId = body.creatorDeviceId as string | undefined;
    const creatorPhone = body.creatorPhone as string | undefined;
    const isUnlimited = body.isUnlimited === true;

    // Validate count
    if (count < 1 || count > 100) {
      return c.json<ApiError>({
        error: "Count must be between 1 and 100",
        code: "INVALID_COUNT"
      }, 400);
    }

    const codes: string[] = [];
    const now = Date.now();
    // Unlimited codes never expire, regular codes expire in 30 days
    const expiresAt = isUnlimited ? 9999999999999 : now + 30 * 24 * 60 * 60 * 1000;

    // Use transaction-like pattern for batch insert
    for (let i = 0; i < count; i++) {
      const code = generateInviteCode();
      codes.push(code);

      await c.env.DB.prepare(
        `INSERT INTO invite_codes (code, creator_device_id, creator_phone, status, is_unlimited, created_at, expires_at)
         VALUES (?, ?, ?, 'available', ?, ?, ?)`
      )
        .bind(code, creatorDeviceId || "admin", creatorPhone || null, isUnlimited ? 1 : 0, now, expiresAt)
        .run();
    }

    logger.info({ requestId }, "Admin generated invite codes", {
      count: codes.length,
      creatorDeviceId: creatorDeviceId || "admin"
    });

    return c.json({ codes });
  } catch (error) {
    logger.error({ requestId }, "Admin generate invite error", error);
    return c.json<ApiError>({
      error: "Internal server error",
      code: "INTERNAL_ERROR"
    }, 500);
  }
});

/**
 * GET /api/admin/invite/list - List all invite codes
 *
 * Returns invite codes with optional status filtering.
 * Requires API_SECRET authentication in production.
 *
 * @query {string} [status] - Filter by status (available|used|expired)
 * @returns {AdminListInviteResponse} - List of invite codes
 */
app.get("/admin/invite/list", async (c) => {
  const requestId = (c.get("requestId") as string) || generateRequestId();

  try {
    // Basic authentication check
    const apiSecret = c.env.API_SECRET;
    if (apiSecret) {
      const authHeader = c.req.header("Authorization");
      if (!authHeader || !authHeader.startsWith("Bearer ") || authHeader.slice(7) !== apiSecret) {
        logger.warn({ requestId }, "Unauthorized admin access attempt");
        return c.json<ApiError>({
          error: "Unauthorized",
          code: "UNAUTHORIZED"
        }, 401);
      }
    }

    const status = c.req.query("status");

    // Validate status parameter
    if (status && !["available", "used", "expired"].includes(status)) {
      return c.json<ApiError>({
        error: "Invalid status value",
        code: "INVALID_STATUS"
      }, 400);
    }

    let query = `
      SELECT code, creator_device_id, creator_phone, used_by_device_id, used_by_phone,
             status, created_at, used_at, expires_at
      FROM invite_codes
    `;
    const params: string[] = [];

    if (status) {
      query += " WHERE status = ?";
      params.push(status);
    }

    query += " ORDER BY created_at DESC LIMIT 100";

    const result = await c.env.DB.prepare(query)
      .bind(...params)
      .all();

    logger.info({ requestId }, "Admin listed invite codes", {
      count: result.results?.length || 0,
      status: status || "all"
    });

    return c.json({ codes: result.results || [] });
  } catch (error) {
    logger.error({ requestId }, "Admin list invite error", error);
    return c.json<ApiError>({
      error: "Internal server error",
      code: "INTERNAL_ERROR"
    }, 500);
  }
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Verifies an invite code's validity
 *
 * @param db - D1 Database instance
 * @param code - Invite code to verify (should be normalized to uppercase)
 * @returns Validation result with reason if invalid
 */
async function verifyInviteCode(
  db: D1Database,
  code: string
): Promise<{ valid: boolean; reason?: string }> {
  const result = await db.prepare(
    "SELECT code, status, expires_at, is_unlimited FROM invite_codes WHERE code = ?"
  )
    .bind(code)
    .first<{ code: string; status: string; expires_at: number; is_unlimited: number }>();

  if (!result) {
    return { valid: false, reason: "邀请码不存在" };
  }

  // Unlimited codes never expire and can be used multiple times
  if (result.is_unlimited === 1) {
    return { valid: true };
  }

  if (result.status === "used") {
    return { valid: false, reason: "此邀请码已使用" };
  }

  if (result.expires_at < Date.now()) {
    return { valid: false, reason: "邀请码已过期" };
  }

  return { valid: true };
}

// Export handler for Cloudflare Pages Functions
// Hono's app.fetch works directly with Request/Response
export const onRequest: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);

  // Strip /api prefix for Hono routing
  const path = url.pathname.replace(/^\/api/, '');
  const newUrl = new URL(path + url.search, url.origin);

  // Create a new request with the modified URL
  const modifiedRequest = new Request(newUrl, {
    method: context.request.method,
    headers: context.request.headers,
    body: context.request.body,
  });

  // Pass env and execution context to Hono
  const executionCtx = {
    waitUntil: (promise: Promise<unknown>) => context.waitUntil(promise),
    passThroughOnException: () => context.passThroughOnException(),
    props: {},
  };
  return app.fetch(modifiedRequest, context.env, executionCtx as unknown as ExecutionContext);
};
