// Cloudflare Worker Entry Point

import { Hono } from "hono";
import { cors } from "hono/cors";
import { AgentTeam } from "./agents/team";
import { generateInviteCode, generateSessionId, validateInput } from "./utils";
import { UserInput, InviteCode, UserSession } from "./types";

interface Env {
  DB: D1Database;
  BUCKET: R2Bucket;
  GEMINI_API_KEY: string;
}

const app = new Hono<{ Bindings: Env }>();

// Middleware
app.use("/*", cors());

// ============================================================================
// API Routes
// ============================================================================

// POST /api/generate - Submit form and generate names
app.post("/api/generate", async (c) => {
  try {
    const body = await c.req.json();
    const input: UserInput = body;

    // Validate input
    const validation = validateInput(input);
    if (!validation.valid) {
      return c.json({ error: "Validation failed", errors: validation.errors }, 400);
    }

    // Check invite code if provided
    let isPremium = false;
    if (input.inviteCode) {
      const inviteValid = await verifyInviteCode(c.env.DB, input.inviteCode);
      if (!inviteValid.valid) {
        return c.json({ error: "Invalid invite code", reason: inviteValid.reason }, 400);
      }
      isPremium = true;
    }

    // Create session
    const sessionId = generateSessionId();

    // Run agent team
    const agentTeam = new AgentTeam({ apiKey: c.env.GEMINI_API_KEY });
    const context = {
      sessionId,
      userInput: input,
    };

    // Start async generation (fire and update later)
    const generationPromise = (async () => {
      try {
        const names = await agentTeam.generate(context);

        // Save to database
        await c.env.DB.prepare(
          `INSERT INTO user_sessions (id, device_id, phone, input_data, result_data, invite_code_used, is_premium, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
          .bind(
            sessionId,
            body.deviceId || "unknown",
            input.phone,
            JSON.stringify(input),
            JSON.stringify(names),
            input.inviteCode,
            isPremium ? 1 : 0,
            Date.now(),
            Date.now()
          )
          .run();

        // Mark invite code as used
        if (input.inviteCode) {
          await c.env.DB.prepare(
            `UPDATE invite_codes SET status = 'used', used_by_device_id = ?, used_by_phone = ?, used_at = ?
             WHERE code = ?`
          )
            .bind(body.deviceId || "unknown", input.phone, Date.now(), input.inviteCode)
            .run();
        }

        return { success: true, names };
      } catch (error) {
        console.error("Generation error:", error);
        return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
      }
    })();

    // Return session ID for polling
    return c.json({ sessionId, status: "processing" });
  } catch (error) {
    console.error("Generate error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// GET /api/job/:id - Get generation status/result
app.get("/api/job/:id", async (c) => {
  try {
    const sessionId = c.req.param("id");

    const result = await c.env.DB.prepare(
      "SELECT result_data, is_premium FROM user_sessions WHERE id = ?"
    )
      .bind(sessionId)
      .first();

    if (!result) {
      return c.json({ error: "Session not found" }, 404);
    }

    const names = result.result_data ? JSON.parse(result.result_data) : null;

    if (!names) {
      return c.json({ sessionId, status: "processing" });
    }

    return c.json({ sessionId, status: "completed", names, isPremium: !!result.is_premium });
  } catch (error) {
    console.error("Job status error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// POST /api/invite/verify - Verify invite code
app.post("/api/invite/verify", async (c) => {
  try {
    const { code } = await c.req.json();

    if (!code || typeof code !== "string") {
      return c.json({ error: "Invalid code format" }, 400);
    }

    const result = await verifyInviteCode(c.env.DB, code.toUpperCase());

    return c.json(result);
  } catch (error) {
    console.error("Invite verify error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// POST /api/invite/use - Use invite code (reserve it)
app.post("/api/invite/use", async (c) => {
  try {
    const { code, deviceId, phone } = await c.req.json();

    if (!code || !deviceId) {
      return c.json({ error: "Missing required fields" }, 400);
    }

    const upperCode = code.toUpperCase();

    // Check if already used
    const existing = await c.env.DB.prepare(
      "SELECT * FROM invite_codes WHERE code = ?"
    )
      .bind(upperCode)
      .first();

    if (!existing) {
      return c.json({ valid: false, reason: "邀请码不存在" });
    }

    if (existing.status === "used") {
      return c.json({ valid: false, reason: "此邀请码已使用" });
    }

    if (existing.expires_at < Date.now()) {
      return c.json({ valid: false, reason: "邀请码已过期" });
    }

    return c.json({ valid: true, message: "邀请码验证通过" });
  } catch (error) {
    console.error("Invite use error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// GET /api/history - Get user's history
app.get("/api/history", async (c) => {
  try {
    const deviceId = c.req.query("deviceId");

    if (!deviceId) {
      return c.json({ error: "Missing deviceId" }, 400);
    }

    const sessions = await c.env.DB.prepare(
      "SELECT id, input_data, result_data, invite_code_used, is_premium, created_at FROM user_sessions WHERE device_id = ? ORDER BY created_at DESC LIMIT 10"
    )
      .bind(deviceId)
      .all();

    return c.json({ sessions: sessions.results || [] });
  } catch (error) {
    console.error("History error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// ============================================================================
// Admin Routes (should be protected in production)
// ============================================================================

// POST /admin/invite/generate - Generate invite codes
app.post("/admin/invite/generate", async (c) => {
  try {
    const { count = 1, creatorDeviceId, creatorPhone } = await c.req.json();

    const codes: string[] = [];
    const now = Date.now();
    const expiresAt = now + 30 * 24 * 60 * 60 * 1000; // 30 days

    for (let i = 0; i < count; i++) {
      const code = generateInviteCode();
      codes.push(code);

      await c.env.DB.prepare(
        `INSERT INTO invite_codes (code, creator_device_id, creator_phone, status, created_at, expires_at)
         VALUES (?, ?, ?, 'available', ?, ?)`
      )
        .bind(code, creatorDeviceId || "admin", creatorPhone, now, expiresAt)
        .run();
    }

    return c.json({ codes });
  } catch (error) {
    console.error("Generate invite code error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// GET /admin/invite/list - List invite codes
app.get("/admin/invite/list", async (c) => {
  try {
    const status = c.req.query("status");

    let query = "SELECT code, creator_device_id, creator_phone, used_by_device_id, used_by_phone, status, created_at, used_at, expires_at FROM invite_codes";
    const params: any[] = [];

    if (status) {
      query += " WHERE status = ?";
      params.push(status);
    }

    query += " ORDER BY created_at DESC LIMIT 100";

    const result = await c.env.DB.prepare(query).bind(...params).all();

    return c.json({ codes: result.results || [] });
  } catch (error) {
    console.error("List invite codes error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// ============================================================================
// Helper Functions
// ============================================================================

async function verifyInviteCode(db: D1Database, code: string): Promise<{ valid: boolean; reason?: string }> {
  const result = await db.prepare(
    "SELECT * FROM invite_codes WHERE code = ?"
  )
    .bind(code)
    .first();

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

export default app;
