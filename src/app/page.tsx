"use client";

import { useWorkflowStore } from "../stores/workflow";
import { useState, useEffect } from "react";
import { generateName, getJobStatus } from "../lib/api";
import { StepForm, GeneratingPage, ResultsList } from "../components";

export default function Home() {
  const {
    fatherName, motherName, children, generationChar, stylePreference,
    specialRequests, phone, inviteCode,
    startGeneration, setSessionId, setGenerationStatus, setNames,
    generationStatus, reset, currentStep
  } = useWorkflowStore();

  const [deviceId, setDeviceId] = useState("");

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
    (window as any).__handleSubmitCalled = true;
    (window as any).__handleSubmitCalledAt = new Date().toISOString();
    (window as any).__handleSubmitCurrentStep = currentStep;
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
        pollResults(response.sessionId);
      }
    } catch (error) {
      console.error("Generation error:", error);
      setGenerationStatus("failed");
    }
  };

  const pollResults = async (sessionId: string) => {
    const poll = async () => {
      try {
        const response = await getJobStatus(sessionId);
        const data = response;

        if (data.status === "completed" && data.names) {
          setNames(data.names);
          setGenerationStatus("completed");
        } else if (data.status === "processing") {
          setTimeout(poll, 2000);
        } else {
          setGenerationStatus("failed");
        }
      } catch (error) {
        console.error("Poll error:", error);
        setGenerationStatus("failed");
      }
    };

    setTimeout(poll, 2000);
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
        <GeneratingPage />
      )}

      {generationStatus === "failed" && (
        <GeneratingPage onRetry={handleSubmit} />
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
