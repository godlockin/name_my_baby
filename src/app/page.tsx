"use client";

import { useWorkflowStore } from "../stores/workflow";
import { useState, useEffect } from "react";
import { generateName, getJobStatus } from "../lib/api";

export default function Home() {
  const {
    fatherName, motherName, children, generationChar, stylePreference,
    specialRequests, phone, inviteCode,
    setFatherName, setMotherName, updateChild, setGenerationChar,
    setStylePreference, setSpecialRequests, setPhone, setInviteCode,
    startGeneration, setSessionId, setGenerationStatus, setNames
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    startGeneration();

    try {
      const data = {
        fatherName,
        motherName,
        children,
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
        // Start polling for results
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
            <input
              type="text"
              className="input"
              placeholder="请输入父亲姓名"
              value={fatherName}
              onChange={(e) => setFatherName(e.target.value)}
            />
          </div>

          <div>
            <label className="label">母亲姓名</label>
            <input
              type="text"
              className="input"
              placeholder="请输入母亲姓名"
              value={motherName}
              onChange={(e) => setMotherName(e.target.value)}
            />
          </div>

          <div>
            <label className="label">字辈要求（可选）</label>
            <input
              type="text"
              className="input"
              placeholder="如家族有字辈要求请填写"
              value={generationChar}
              onChange={(e) => setGenerationChar(e.target.value)}
            />
          </div>

          <div>
            <label className="label">风格偏好（可选）</label>
            <input
              type="text"
              className="input"
              placeholder="如：文雅、大气、古典等"
              value={stylePreference}
              onChange={(e) => setStylePreference(e.target.value)}
            />
          </div>

          <div>
            <label className="label">特殊要求（可选）</label>
            <textarea
              className="input"
              placeholder="其他特殊要求或说明"
              value={specialRequests}
              onChange={(e) => setSpecialRequests(e.target.value)}
              rows={3}
            />
          </div>

          <div>
            <label className="label">手机号（可选）</label>
            <input
              type="tel"
              className="input"
              placeholder="用于接收通知和找回结果"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <div>
            <label className="label">邀请码（可选）</label>
            <input
              type="text"
              className="input"
              placeholder="如有邀请码请填写，解锁完整权益"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
            />
          </div>

          <button type="submit" className="btn-primary w-full">
            开始起名
          </button>
        </form>
      </div>
    </main>
  );
}
