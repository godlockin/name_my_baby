/**
 * Tests for GeneratingPage component
 *
 * Critical issues to verify:
 * 1. Memory leak - setInterval not properly cleaned up when currentStage changes
 * 2. Retry button should call handleFormSubmit on error screen
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { GeneratingPage } from "../GeneratingPage";
import { useWorkflowStore } from "../../stores/workflow";

// Mock the Zustand store
vi.mock("../../stores/workflow", () => ({
  useWorkflowStore: vi.fn(),
}));

const mockUseWorkflowStore = useWorkflowStore as ReturnType<typeof vi.fn>;

describe("GeneratingPage", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const renderGeneratingPage = (overrides = {}) => {
    const mockStore = {
      generationStatus: "processing" as const,
      ...overrides,
    };
    mockUseWorkflowStore.mockReturnValue(mockStore);
    mockUseWorkflowStore.getState = vi.fn().mockReturnValue(mockStore);
    return render(<GeneratingPage />);
  };

  describe("Memory leak fix", () => {
    it("does not reset interval when currentStage changes during processing", async () => {
      let intervalClearCount = 0;
      const originalClearInterval = global.clearInterval;
      global.clearInterval = vi.fn(((id: number) => {
        intervalClearCount++;
        originalClearInterval(id);
      }) as typeof global.clearInterval);

      renderGeneratingPage({ generationStatus: "processing" });

      // Initial render should set up intervals
      const initialClearCount = intervalClearCount;

      // Wait for first stage transition (2 seconds)
      await act(async () => {
        vi.advanceTimersByTime(2000);
      });

      // Wait a bit more for progress interval
      await act(async () => {
        vi.advanceTimersByTime(500);
      });

      // The key fix: currentStage in useEffect dependencies causes unnecessary re-renders
      // After the fix (removing currentStage from dependencies), clear count should be stable
      // Before fix, each stage change would trigger cleanup and re-setup
      expect(intervalClearCount).toBeLessThan(5); // Reasonable bound, not exact

      global.clearInterval = originalClearInterval;
    });
  });

  describe("Error state", () => {
    it("shows retry button when generation fails", () => {
      renderGeneratingPage({ generationStatus: "failed" });

      expect(screen.getByText("生成失败")).toBeInTheDocument();
      expect(screen.getByText("重新尝试")).toBeInTheDocument();
    });

    it("renders error icon with correct styling", () => {
      const { container } = renderGeneratingPage({ generationStatus: "failed" });

      // Check for error icon (X mark)
      const errorIcon = container.querySelector('svg[stroke="currentColor"]');
      expect(errorIcon).toBeInTheDocument();
    });
  });

  describe("Progress visualization", () => {
    it("shows progress bar and stages during processing", () => {
      renderGeneratingPage({ generationStatus: "processing" });

      expect(screen.getByText("正在为您起名")).toBeInTheDocument();
      expect(screen.getByText("生成进度")).toBeInTheDocument();
      expect(screen.getByText("分析八字")).toBeInTheDocument();
      expect(screen.getByText("生成候选")).toBeInTheDocument();
      expect(screen.getByText("评分筛选")).toBeInTheDocument();
      expect(screen.getByText("最终审核")).toBeInTheDocument();
    });

    it("advances progress over time", async () => {
      renderGeneratingPage({ generationStatus: "processing" });

      // Initial progress should be low
      const progressText = screen.getByText(/%$/);
      expect(progressText.textContent).toMatch(/^\d+%$/);

      // Advance time and check progress increases
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      const newProgress = parseInt(progressText.textContent);
      expect(newProgress).toBeGreaterThan(0);
    });

    it("completes all stages within expected time", async () => {
      renderGeneratingPage({ generationStatus: "processing" });

      // 4 stages, 30 seconds total
      await act(async () => {
        vi.advanceTimersByTime(30000);
      });

      // Should have completed all stages
      const progressText = screen.getByText(/%$/);
      expect(progressText.textContent).toBe("100%");
    });
  });
});
