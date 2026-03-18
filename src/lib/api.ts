/**
 * Frontend API client for the baby naming service
 *
 * Provides type-safe wrappers for all API endpoints.
 * Handles error responses with structured error data.
 *
 * @module api
 */

import type {
  GenerateResponse,
  JobStatusResponse,
  InviteVerifyResponse,
  InviteUseResponse,
  HistoryResponse,
  ApiError,
  UserInput,
} from "../types";

/**
 * Custom error class for API errors with structured data
 */
export class ApiRequestError extends Error {
  code: string;
  details?: string[];
  reason?: string;

  constructor(error: ApiError) {
    super(error.error);
    this.name = "ApiRequestError";
    this.code = error.code;
    this.reason = error.reason;
    this.details = error.details;
  }
}

/**
 * Submits form data and initiates name generation
 *
 * POST /api/generate - Creates a session and starts async generation.
 * Returns immediately with session ID for polling.
 *
 * @param input - User input data (parent names, children info, etc.)
 * @returns Session ID and initial processing status
 * @throws {ApiRequestError} If validation fails or server error
 *
 * @example
 * ```typescript
 * try {
 *   const { sessionId, status } = await generateName(input);
 *   // Poll for results using getJobStatus(sessionId)
 * } catch (error) {
 *   if (error instanceof ApiRequestError) {
 *     console.error(error.code, error.details);
 *   }
 * }
 * ```
 */
export async function generateName(input: UserInput): Promise<GenerateResponse> {
  const response = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = (await response.json()) as ApiError;
    throw new ApiRequestError(error);
  }

  return response.json() as Promise<GenerateResponse>;
}

/**
 * Polls for job status and results
 *
 * GET /api/job/:id - Returns processing status or completed results.
 * Use this to poll after calling generateName().
 *
 * @param sessionId - Session ID from generateName() response
 * @returns Job status with names if completed
 * @throws {ApiRequestError} If session not found or server error
 *
 * @example
 * ```typescript
 * // Poll every 2 seconds until completed
 * async function pollStatus(sessionId: string) {
 *   const result = await getJobStatus(sessionId);
 *   if (result.status === "completed") {
 *     console.log(result.names);
 *   } else if (result.status === "processing") {
 *     setTimeout(() => pollStatus(sessionId), 2000);
 *   }
 * }
 * ```
 */
export async function getJobStatus(sessionId: string): Promise<JobStatusResponse> {
  const response = await fetch(`/api/job/${sessionId}`);

  if (!response.ok) {
    const error = (await response.json()) as ApiError;
    throw new ApiRequestError(error);
  }

  return response.json() as Promise<JobStatusResponse>;
}

/**
 * Verifies an invite code without consuming it
 *
 * POST /api/invite/verify - Checks if an invite code is valid and available.
 * Does not reserve or consume the code.
 *
 * @param code - Invite code to verify
 * @returns Verification result with validity status
 * @throws {ApiRequestError} If invalid code format or server error
 *
 * @example
 * ```typescript
 * try {
 *   const result = await verifyInviteCode("AB12CD");
 *   if (result.valid) {
 *     // Code is valid, can be used
 *   } else {
 *     console.error(result.reason);
 *   }
 * } catch (error) {
 *   console.error("Verification failed:", error);
 * }
 * ```
 */
export async function verifyInviteCode(code: string): Promise<InviteVerifyResponse> {
  const response = await fetch("/api/invite/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });

  if (!response.ok) {
    const error = (await response.json()) as ApiError;
    throw new ApiRequestError(error);
  }

  return response.json() as Promise<InviteVerifyResponse>;
}

/**
 * Reserves an invite code for use
 *
 * POST /api/invite/use - Validates and reserves an invite code.
 * The code is fully consumed when /api/generate completes.
 *
 * @param code - Invite code to reserve
 * @param deviceId - Device identifier
 * @param phone - Optional phone number
 * @returns Reservation confirmation
 * @throws {ApiRequestError} If code invalid/already used or server error
 *
 * @example
 * ```typescript
 * try {
 *   const result = await reserveInviteCode("AB12CD", deviceId, phone);
 *   if (result.valid) {
 *     // Code reserved, proceed to generate
 *   }
 * } catch (error) {
 *   console.error("Reservation failed:", error);
 * }
 * ```
 */
export async function reserveInviteCode(
  code: string,
  deviceId: string,
  phone?: string
): Promise<InviteUseResponse> {
  const response = await fetch("/api/invite/use", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, deviceId, phone }),
  });

  if (!response.ok) {
    const error = (await response.json()) as ApiError;
    throw new ApiRequestError(error);
  }

  return response.json() as Promise<InviteUseResponse>;
}

/**
 * Retrieves user's generation history
 *
 * GET /api/history - Returns up to 10 most recent sessions for a device.
 *
 * @param deviceId - Device identifier
 * @returns List of user sessions
 * @throws {ApiRequestError} If missing deviceId or server error
 *
 * @example
 * ```typescript
 * try {
 *   const history = await getHistory(deviceId);
 *   history.sessions.forEach(session => {
 *     console.log(session.created_at, session.result_data);
 *   });
 * } catch (error) {
 *   console.error("Failed to load history:", error);
 * }
 * ```
 */
export async function getHistory(deviceId: string): Promise<HistoryResponse> {
  const response = await fetch(`/api/history?deviceId=${encodeURIComponent(deviceId)}`);

  if (!response.ok) {
    const error = (await response.json()) as ApiError;
    throw new ApiRequestError(error);
  }

  return response.json() as Promise<HistoryResponse>;
}
