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
import type { PagesFunctionHandler } from "@cloudflare/workers-types";

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
  /** Optional: Admin API key for protected routes */
  API_SECRET?: string;
  /** Optional: Feature flags */
  ENABLE_RATE_LIMIT?: string;
  /** Rate limit: requests per minute per IP */
  RATE_LIMIT_MAX?: string;
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
  info: (ctx: { requestId?: string; route?: string; deviceId?: string }, message: string, data?: Record<string, unknown>) => {
    console.log(JSON.stringify({
      level: "INFO",
      timestamp: new Date().toISOString(),
      requestId: ctx.requestId,
      route: ctx.route,
      message,
      ...data
    }));
  },
  error: (ctx: { requestId?: string; route?: string; deviceId?: string }, message: string, error: unknown, data?: Record<string, unknown>) => {
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
  warn: (ctx: { requestId?: string; route?: string; deviceId?: string }, message: string, data?: Record<string, unknown>) => {
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

const app = new Hono<{ Bindings: Env }>();

// ============================================================================
// Global Middleware
// ============================================================================

/**
 * Request logging middleware
 */
app.use("/*", async (c, next) => {
  const requestId = generateRequestId();
  c.set("requestId", requestId as never);

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
  const requestId = (c.get("requestId") as string) || generateRequestId();

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
    if (input.inviteCode) {
      const inviteValid = await verifyInviteCode(c.env.DB, input.inviteCode);
      if (!inviteValid.valid) {
        logger.info({ requestId, route: "/api/generate" }, "Invalid invite code", {
          code: input.inviteCode,
          reason: inviteValid.reason
        });
        return c.json<ApiError>({
          error: "Invalid invite code",
          code: "INVALID_INVITE_CODE",
          reason: inviteValid.reason
        }, 400);
      }
      isPremium = true;
    }

    // Create session
    const sessionId = generateSessionId();
    const deviceId = body.deviceId as string | undefined;

    // Run agent team asynchronously
    const generationPromise = (async () => {
      const agentTeam = new AgentTeam({ apiKey: c.env.GEMINI_API_KEY });
      const context = {
        sessionId,
        userInput: input,
      };

      try {
        logger.info({ requestId, sessionId }, "Starting agent team generation");
        const names = await agentTeam.generate(context);

        // Validate generated names
        if (!names || names.length === 0) {
          throw new Error("No names generated by agent team");
        }

        // Save to database
        const dbResult = await c.env.DB.prepare(
          `INSERT INTO user_sessions (id, device_id, phone, input_data, result_data, invite_code_used, is_premium, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
          .bind(
            sessionId,
            deviceId || "unknown",
            input.phone || null,
            JSON.stringify(input),
            JSON.stringify(names),
            input.inviteCode || null,
            isPremium ? 1 : 0,
            Date.now(),
            Date.now()
          )
          .run();

        logger.info({ requestId, sessionId }, "Database insert completed", {
          rowsAffected: dbResult.meta?.rows_written || 0
        });

        // Mark invite code as used
        if (input.inviteCode) {
          await c.env.DB.prepare(
            `UPDATE invite_codes SET status = 'used', used_by_device_id = ?, used_by_phone = ?, used_at = ?
             WHERE code = ?`
          )
            .bind(deviceId || "unknown", input.phone || null, Date.now(), input.inviteCode)
            .run();

          logger.info({ requestId, sessionId }, "Invite code marked as used", {
            code: input.inviteCode
          });
        }

        return { success: true, names };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown generation error";
        logger.error({ requestId, sessionId }, "Generation failed", error);

        // Record failure in database
        try {
          await c.env.DB.prepare(
            `INSERT INTO user_sessions (id, device_id, phone, input_data, result_data, is_premium, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
          )
            .bind(
              sessionId,
              deviceId || "unknown",
              input.phone || null,
              JSON.stringify(input),
              JSON.stringify({ error: errorMessage }),
              isPremium ? 1 : 0,
              Date.now(),
              Date.now()
            )
            .run();
        } catch (dbError) {
          logger.error({ requestId, sessionId }, "Failed to record generation failure", dbError);
        }

        return { success: false, error: errorMessage };
      }
    })();

    // Fire and forget - don't await
    generationPromise.catch((err) => {
      logger.error({ requestId }, "Unhandled generation promise error", err);
    });

    // Return session ID for polling immediately
    return c.json({
      sessionId,
      status: "processing",
      estimatedTime: 30 // seconds
    });
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
  const requestId = (c.get("requestId") as string) || generateRequestId();

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
      "SELECT result_data, is_premium FROM user_sessions WHERE id = ?"
    )
      .bind(sessionId)
      .first<{ result_data: string | null; is_premium: number }>();

    if (!result) {
      logger.info({ requestId, sessionId }, "Session not found");
      return c.json<ApiError>({
        error: "Session not found",
        code: "SESSION_NOT_FOUND"
      }, 404);
    }

    let names = null;
    let hasError = false;

    if (result.result_data) {
      const parsed = safeJsonParse<unknown>(result.result_data, null);
      if (parsed && typeof parsed === "object" && "error" in parsed) {
        hasError = true;
      } else if (Array.isArray(parsed)) {
        names = parsed;
      }
    }

    if (!names && !hasError) {
      // Still processing
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
  const requestId = (c.get("requestId") as string) || generateRequestId();

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
  const requestId = (c.get("requestId") as string) || generateRequestId();

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
  const requestId = (c.get("requestId") as string) || generateRequestId();

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

    // Validate count
    if (count < 1 || count > 100) {
      return c.json<ApiError>({
        error: "Count must be between 1 and 100",
        code: "INVALID_COUNT"
      }, 400);
    }

    const codes: string[] = [];
    const now = Date.now();
    const expiresAt = now + 30 * 24 * 60 * 60 * 1000; // 30 days

    // Use transaction-like pattern for batch insert
    for (let i = 0; i < count; i++) {
      const code = generateInviteCode();
      codes.push(code);

      await c.env.DB.prepare(
        `INSERT INTO invite_codes (code, creator_device_id, creator_phone, status, created_at, expires_at)
         VALUES (?, ?, ?, 'available', ?, ?)`
      )
        .bind(code, creatorDeviceId || "admin", creatorPhone || null, now, expiresAt)
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
    "SELECT code, status, expires_at FROM invite_codes WHERE code = ?"
  )
    .bind(code)
    .first<{ code: string; status: string; expires_at: number }>();

  if (!result) {
    return { valid: false, reason: "邀请码不存在" };
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
export const onRequest: PagesFunctionHandler<Env> = async (context) => {
  const url = new URL(context.request.url);

  // Strip /api prefix for Hono routing
  const path = url.pathname.replace(/^\/api/, '');
  const newUrl = new URL(path + url.search, url.origin);

  // Create a new request with the modified URL
  const modifiedRequest = new Request(newUrl, {
    method: context.request.method,
    headers: context.request.headers,
    body: context.request.body,
    duplex: 'half',
  });

  // Pass env and execution context to Hono
  return app.fetch(modifiedRequest, context.env, {
    waitUntil: (promise: Promise<unknown>) => context.waitUntil(promise),
    passThroughOnException: () => context.passThroughOnException(),
  });
};
