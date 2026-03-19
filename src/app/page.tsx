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
    startGeneration();

    const state = useWorkflowStore.getState();

    try {
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

  // Show generating page when processing
  if (generationStatus === "processing" || generationStatus === "completed") {
    return (
      <main className="min-h-screen p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-center mb-8">AI 起名助手</h1>
          {generationStatus === "processing" && (
            <GeneratingPage />
          )}
          {generationStatus === "completed" && (
            <ResultsList />
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-8">AI 起名助手</h1>
        <StepForm onSubmit={handleFormSubmit} />
      </div>
    </main>
  );
}
