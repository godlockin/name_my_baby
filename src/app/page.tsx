"use client";

import { useWorkflowStore } from "../stores/workflow";
import { useState, useEffect } from "react";
import { generateName, getJobStatus } from "../lib/api";
import { StepForm, GeneratingPage, ResultsList, ResultDetail } from "../components";
import type { NameResult } from "../components/ResultsList";

export default function Home() {
  const {
    fatherName, motherName, children, generationChar, stylePreference,
    specialRequests, phone, inviteCode,
    startGeneration, setSessionId, setGenerationStatus, setNames,
    generationStatus, names, savedNames, saveName, removeSavedName, reset
  } = useWorkflowStore();

  const [deviceId, setDeviceId] = useState("");
  const [selectedName, setSelectedName] = useState<NameResult | null>(null);
  
  // Progress simulation states
  const [progress, setProgress] = useState(0);
  const [currentStage, setCurrentStage] = useState("analyze");

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
      birthTime: `${child.birthYear}-${String(child.birthMonth).padStart(2, "0")}-${String(child.birthDay).padStart(2, "0")}T${child.birthHour}:00`,
    }));
  };

  const simulateProgress = () => {
    setProgress(0);
    setCurrentStage("analyze");
    
    setTimeout(() => { setProgress(30); setCurrentStage("generate"); }, 2000);
    setTimeout(() => { setProgress(60); setCurrentStage("evaluate"); }, 4000);
    setTimeout(() => { setProgress(85); setCurrentStage("finalize"); }, 6000);
  };

  const handleSubmit = async () => {
    startGeneration();
    simulateProgress();

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
          setProgress(100);
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

  const handleToggleSave = (name: NameResult) => {
    const isSaved = savedNames.some(n => n.id === name.id);
    if (isSaved) {
      removeSavedName(name.id);
    } else {
      saveName(name as any);
    }
  };

  // Maps the store names to the ui names properly adding isSaved flag.
  const mappedNames = names.map(n => ({
    ...n,
    isSaved: savedNames.some(sn => sn.id === n.id)
  })) as NameResult[];

  const mappedSavedNames = savedNames.map(n => ({
    ...n,
    isSaved: true
  })) as NameResult[];

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
        <GeneratingPage status="processing" progress={progress} currentStage={currentStage} />
      )}

      {generationStatus === "failed" && (
        <GeneratingPage status="failed" />
      )}

      {generationStatus === "completed" && (
        <ResultsList
          names={mappedNames}
          savedNames={mappedSavedNames}
          onSelectName={setSelectedName}
          onToggleSave={handleToggleSave}
          onBack={reset}
          onRegenerate={handleSubmit}
        />
      )}

      {/* Result Detail Overlay */}
      {selectedName && (
        <ResultDetail
          name={selectedName}
          onClose={() => setSelectedName(null)}
          onToggleSave={() => handleToggleSave(selectedName)}
        />
      )}
    </main>
  );
}
