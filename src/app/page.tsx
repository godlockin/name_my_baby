"use client";

import { useWorkflowStore } from "../stores/workflow";
import { useState, useEffect } from "react";
import { generateName, getJobStatus } from "../lib/api";
import { StepForm, GeneratingPage, ResultsList } from "../components";

type DebugWindow = Window & {
  __handleSubmitCalled?: boolean;
  __handleSubmitCalledAt?: string;
  __handleSubmitCurrentStep?: unknown;
};

export default function Home() {
  const {
    fatherName, motherName, children, generationChar, stylePreference,
    specialRequests, phone, inviteCode,
    startGeneration, setSessionId, setGenerationStatus, setNames,
    generationStatus, reset, currentStep
  } = useWorkflowStore();

  const [deviceId, setDeviceId] = useState("");
  const [pollAttempts, setPollAttempts] = useState(0);
  const [lastPollStatus, setLastPollStatus] = useState<string>("");

  // Debug: Log generationStatus changes
  useEffect(() => {
    console.log('[page.tsx] generationStatus changed to:', generationStatus);
  }, [generationStatus]);

  useEffect(() => {
    let id = localStorage.getItem("deviceId");
    if (!id) {
      id = `device-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      localStorage.setItem("deviceId", id);
    }
    setDeviceId(id);
  }, []);

  const formatChildren = () => {
    return children.map(child => ({
      id: child.id,
      name: child.name,
      gender: child.gender,
      birthYear: child.birthYear,
      birthMonth: child.birthMonth,
      birthDay: child.birthDay,
      birthHour: child.birthHour,
    }));
  };

  const handleSubmit = async () => {
    console.log('[page.tsx] handleSubmit called, generationStatus:', generationStatus, 'currentStep:', currentStep);
    // Debug: Set a window flag to track if handleSubmit was called
    const debugWindow = window as DebugWindow;
    debugWindow.__handleSubmitCalled = true;
    debugWindow.__handleSubmitCalledAt = new Date().toISOString();
    debugWindow.__handleSubmitCurrentStep = currentStep;
    startGeneration();

    try {
      const data = {
        fatherName,
        motherName,
        children: formatChildren(),
        generationChar,
        stylePreference,
        specialRequests,
        phone,
        inviteCode,
        deviceId,
      };

      console.log('[page.tsx] Calling generateName API');
      const response = await generateName(data);

      if (response.sessionId) {
        setSessionId(response.sessionId);

        // Handle synchronous response (API may return completed status immediately)
        if (response.status === "completed" && response.names) {
          console.log('[page.tsx] API returned completed status with names');
          console.log('[page.tsx] === Names from API ===');
          response.names?.forEach((name, idx) => {
            console.log(`[page.tsx] Name ${idx}: ${name.chineseName}, gender: ${name?.gender}, targetChildIndex: ${name?.targetChildIndex}`);
          });
          setNames(response.names);
          setGenerationStatus("completed");
        } else if (response.status === "failed") {
          console.error('[page.tsx] API returned failed status:', response.error);
          setGenerationStatus("failed");
        } else {
          // Start polling for async response
          console.log('[page.tsx] Starting polling for async response');
          pollResults(response.sessionId);
        }
      }
    } catch (error) {
      console.error("Generation error:", error);
      setGenerationStatus("failed");
    }
  };

  const pollResults = async (sessionId: string) => {
    const MAX_POLL_ATTEMPTS = 90; // 90 attempts * 2s = 180s = 3 minutes timeout
    const POLL_INTERVAL = 2000; // 2 seconds

    const poll = async (attempt: number = 0) => {
      try {
        const response = await getJobStatus(sessionId);
        const data = response;

        // Update status for UI
        setLastPollStatus(data.status);
        setPollAttempts(attempt + 1);

        if (data.status === "completed" && data.names) {
          console.log('[page.tsx] Polling completed with names');
          console.log('[page.tsx] === Names from polling ===');
          data.names?.forEach((name, idx) => {
            console.log(`[page.tsx] Name ${idx}: ${name.chineseName}, gender: ${name?.gender}, targetChildIndex: ${name?.targetChildIndex}`);
          });
          setNames(data.names);
          setGenerationStatus("completed");
        } else if (data.status === "processing") {
          // Continue polling with timeout protection
          if (attempt < MAX_POLL_ATTEMPTS) {
            console.log(`[Polling] Attempt ${attempt + 1}/${MAX_POLL_ATTEMPTS}, still processing...`);
            setTimeout(() => poll(attempt + 1), POLL_INTERVAL);
          } else {
            console.error("[Polling] Timeout after", MAX_POLL_ATTEMPTS, "attempts");
            setGenerationStatus("failed");
          }
        } else if (data.status === "failed") {
          console.error("[Polling] Job failed:", data.error);
          setGenerationStatus("failed");
        } else {
          // Unknown status, continue polling
          if (attempt < MAX_POLL_ATTEMPTS) {
            setTimeout(() => poll(attempt + 1), POLL_INTERVAL);
          } else {
            setGenerationStatus("failed");
          }
        }
      } catch (error) {
        console.error("Poll error:", error);
        // Retry on network errors, up to 3 times
        if (attempt < MAX_POLL_ATTEMPTS) {
          setTimeout(() => poll(attempt + 1), POLL_INTERVAL);
        } else {
          setGenerationStatus("failed");
        }
      }
    };

    setTimeout(poll, 1000); // Start polling after 1 second
  };

  return (
    <main className="min-h-screen">
      {/* View based on current generationStatus */}
      {generationStatus === "idle" && (
        <div className="py-12">
          <div className="text-center mb-10">
            <h1 className="text-4xl font-bold mb-3 font-serif" style={{ color: "var(--color-primary)" }}>AI 起名助手</h1>
            <p className="text-gray-600">为宝宝挑选一个寓意深远、音韵优美的好名字</p>
          </div>
          <StepForm onSubmit={handleSubmit} />
        </div>
      )}

      {generationStatus === "processing" && (
        <GeneratingPage pollAttempts={pollAttempts} lastPollStatus={lastPollStatus} />
      )}

      {generationStatus === "failed" && (
        <GeneratingPage onRetry={handleSubmit} pollAttempts={pollAttempts} lastPollStatus={lastPollStatus} />
      )}

      {generationStatus === "completed" && (
        <ResultsList
          onBack={reset}
          onRegenerate={handleSubmit}
        />
      )}
    </main>
  );
}
