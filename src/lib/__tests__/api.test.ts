/**
 * Tests for API client error handling
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { generateName, getJobStatus, ApiRequestError } from "../api";

describe("API Client", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("generateName", () => {
    it("throws ApiRequestError with structured data on non-200 response", async () => {
      const mockError = {
        error: "Validation failed",
        code: "VALIDATION_ERROR",
        reason: "Missing required fields",
        details: ["fatherName is required"],
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        json: async () => mockError,
      });

      const input = {
        fatherName: "",
        motherName: "",
        children: [],
      };

      await expect(generateName(input)).rejects.toThrow(ApiRequestError);

      try {
        await generateName(input);
      } catch (error) {
        expect(error).toBeInstanceOf(ApiRequestError);
        expect((error as ApiRequestError).code).toBe("VALIDATION_ERROR");
        expect((error as ApiRequestError).reason).toBe("Missing required fields");
        expect((error as ApiRequestError).details).toEqual(["fatherName is required"]);
      }
    });

    it("returns GenerateResponse on success", async () => {
      const mockResponse = {
        sessionId: "test-123",
        status: "processing",
        estimatedTime: 30,
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await generateName({
        fatherName: "张三",
        motherName: "李四",
        children: [{ id: "1", gender: "male", birthTime: "2024-01-01T00:00:00Z" }],
      });

      expect(result).toEqual(mockResponse);
    });
  });

  describe("getJobStatus", () => {
    it("throws ApiRequestError on non-200 response", async () => {
      const mockError = {
        error: "Session not found",
        code: "NOT_FOUND",
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        json: async () => mockError,
      });

      await expect(getJobStatus("invalid-id")).rejects.toThrow(ApiRequestError);
    });

    it("returns job status on success", async () => {
      const mockResponse = {
        sessionId: "test-123",
        status: "completed",
        names: [{ id: "1", chineseName: "张志强", coreMeaning: "志向远大" }],
        isPremium: false,
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await getJobStatus("test-123");

      expect(result).toEqual(mockResponse);
    });
  });
});
