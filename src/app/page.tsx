"use client";

import { useWorkflowStore } from "../stores/workflow";
import { useState, useEffect } from "react";
import { generateName, getJobStatus } from "../lib/api";
import StepForm from "../components/StepForm";
import GeneratingPage from "../components/GeneratingPage";
import ResultsList from "../components/ResultsList";

export default function Home() {
  const {
    phone, inviteCode,
    setPhone, setInviteCode,
    startGeneration, setSessionId, setGenerationStatus, setNames,
    generationStatus, sessionId
  } = useWorkflowStore();

  const [deviceId, setDeviceId] = useState("");
  const [pollRetries, setPollRetries] = useState(0);
  const MAX_POLL_RETRIES = 3;

  useEffect(() => {
    // Get or create device ID
    let id = localStorage.getItem("deviceId");
    if (!id) {
      id = `device-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      localStorage.setItem("deviceId", id);
    }
    setDeviceId(id);
  }, []);

  const handleFormSubmit = async () => {
    const state = useWorkflowStore.getState();

    const data = {
      fatherName: state.fatherName,
      motherName: state.motherName,
      children: state.children,
      generationChar: state.generationChar,
      stylePreference: state.stylePreference,
      specialRequests: state.specialRequests,
      phone: state.phone,
      inviteCode: state.inviteCode,
      deviceId,
    };

    startGeneration();

    try {

      const response = await generateName(data);

      if (response.sessionId) {
        setSessionId(response.sessionId);
        setPollRetries(0); // Reset retry counter on new submission
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
          setPollRetries(0);
        } else if (data.status === "processing") {
          setPollRetries(0); // Reset on successful poll
          setTimeout(poll, 2000);
        } else {
          setGenerationStatus("failed");
        }
      } catch (error) {
        console.error("Poll error:", error);
        // Retry logic with max retries
        if (pollRetries < MAX_POLL_RETRIES) {
          setPollRetries((prev) => prev + 1);
          setTimeout(poll, 2000);
        } else {
          setGenerationStatus("failed");
          setPollRetries(0);
        }
      }
    };

    setTimeout(poll, 2000);
  };

  // Show generating page when processing
  if (generationStatus === "processing" || generationStatus === "completed") {
    return (
      <main className="min-h-screen p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-center mb-8">AI 起名助手</h1>
          {generationStatus === "processing" && (
            <GeneratingPage onRetry={handleFormSubmit} />
          )}
          {generationStatus === "completed" && (
            <ResultsList />
          )}
        </div>
      </main>
    );
  }

  // Show error page with retry option
  if (generationStatus === "failed") {
    return (
      <main className="min-h-screen p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-center mb-8">AI 起名助手</h1>
          <GeneratingPage onRetry={handleFormSubmit} />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-8">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-[var(--color-primary)] focus:text-white focus:rounded-lg">
        Skip to main content
      </a>
      <div className="max-w-2xl mx-auto" id="main-content">
        <h1 className="text-3xl font-bold text-center mb-8">AI 起名助手</h1>
        <StepForm onSubmit={handleFormSubmit} />
      </div>
    </main>
  );
}
