"use client";

import { useWorkflowStore } from "../stores/workflow";
import { useState, useEffect } from "react";

export default function Home() {
  const { startGeneration, setSessionId, setGenerationStatus, setNames } = useWorkflowStore();
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    startGeneration();

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fatherName: "张三",
          motherName: "李四",
          children: [{ id: "1", gender: "male", birthTime: "2026-02-01T00:09" }],
          deviceId,
        }),
      });

      const data = await response.json();

      if (data.sessionId) {
        setSessionId(data.sessionId);
        // Start polling for results
        pollResults(data.sessionId);
      }
    } catch (error) {
      console.error("Generation error:", error);
      setGenerationStatus("failed");
    }
  };

  const pollResults = async (sessionId: string) => {
    const poll = async () => {
      try {
        const response = await fetch(`/api/job/${sessionId}`);
        const data = await response.json();

        if (data.status === "completed") {
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
    <main className="min-h-screen p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-8">AI 起名助手</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="label">父亲姓名</label>
            <input type="text" className="input" placeholder="请输入父亲姓名" />
          </div>

          <div>
            <label className="label">母亲姓名</label>
            <input type="text" className="input" placeholder="请输入母亲姓名" />
          </div>

          <div>
            <label className="label">邀请码（可选）</label>
            <input type="text" className="input" placeholder="如有邀请码请填写" />
          </div>

          <button type="submit" className="btn-primary w-full">
            开始起名
          </button>
        </form>
      </div>
    </main>
  );
}
