"use client";

import React from "react";
import { useWorkflowStore } from "../stores/workflow";

interface StageInfo {
  key: string;
  label: string;
  description: string;
  icon: React.ReactNode;
}

interface GeneratingPageProps {
  onRetry?: () => void;
  pollAttempts?: number;
  lastPollStatus?: string;
}

export const GeneratingPage: React.FC<GeneratingPageProps> = ({ onRetry, pollAttempts = 0, lastPollStatus = "processing" }) => {
  const { generationStatus } = useWorkflowStore();
  const [currentStage, setCurrentStage] = React.useState("analyze");
  const [stageMessage, setStageMessage] = React.useState("正在初始化...");
  const [elapsedSeconds, setElapsedSeconds] = React.useState(0);

  React.useEffect(() => {
    if (generationStatus !== "processing") return;
    setElapsedSeconds(0);
    const intervalId = setInterval(() => {
      setElapsedSeconds((s) => (s >= 30 ? 30 : s + 1));
    }, 1000);
    return () => clearInterval(intervalId);
  }, [generationStatus]);

  // Update stage and message based on poll attempts
  React.useEffect(() => {
    if (generationStatus !== "processing") return;

    // Calculate progress based on poll attempts (max 90 attempts = 3 minutes)
    const maxAttempts = 90;
    const progress = Math.min((pollAttempts / maxAttempts) * 100, 99); // Cap at 99% until completed

    // Update stage based on progress
    if (pollAttempts < 15) {
      setCurrentStage("analyze");
      setStageMessage("八字分析师正在计算五行强弱，分析喜用神...");
    } else if (pollAttempts < 30) {
      setCurrentStage("analyze");
      setStageMessage("谐音梗专家正在检查普通话、方言、中英文谐音...");
    } else if (pollAttempts < 45) {
      setCurrentStage("generate");
      setStageMessage("古诗词专家正在查阅诗经、论语，寻找经典出处...");
    } else if (pollAttempts < 60) {
      setCurrentStage("generate");
      setStageMessage("历史学家正在分析历史典故，确保名字有文化底蕴...");
    } else if (pollAttempts < 75) {
      setCurrentStage("evaluate");
      setStageMessage("专家组正在综合讨论，筛选最优名字方案...");
    } else {
      setCurrentStage("finalize");
      setStageMessage("汇总员正在整理最终结果，准备呈现给您...");
    }
  }, [pollAttempts, generationStatus]);

  const getStageStatus = (stageKey: string) => {
    const stages = defaultStages;
    const currentIndex = stages.findIndex((s) => s.key === currentStage);
    const stageIndex = stages.findIndex((s) => s.key === stageKey);

    if (generationStatus === "failed") return "error";
    if (generationStatus === "completed") return "completed";
    if (stageIndex < currentIndex) return "completed";
    if (stageIndex === currentIndex) return "active";
    return "pending";
  };

  // Calculate progress percentage based on poll attempts
  const progressFromPoll = Math.min(Math.floor((pollAttempts / 90) * 100), 99);
  const progressFromTime = Math.min(Math.floor((elapsedSeconds / 30) * 100), 100);
  const progress =
    generationStatus === "completed"
      ? 100
      : generationStatus === "processing"
        ? pollAttempts > 0
          ? progressFromPoll
          : progressFromTime
        : 0;
  const estimatedRemaining =
    generationStatus === "processing"
      ? pollAttempts > 0
        ? Math.max(0, Math.ceil((90 - pollAttempts) * 2 / 3))
        : Math.max(0, 30 - elapsedSeconds)
      : 0;

  if (generationStatus === "failed") {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="card-chinese text-center max-w-md w-full">
          <div
            className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center bg-[rgba(239,68,68,0.1)]"
          >
            <svg
              className="w-8 h-8 text-[var(--color-error)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold mb-2">生成失败</h2>
          <p className="text-gray-600 mb-6">
            抱歉，起名过程中遇到了问题，请稍后重试
          </p>
          <button className="btn-primary w-full" onClick={onRetry}>重新尝试</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="card-chinese max-w-lg w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="relative w-20 h-20 mx-auto mb-4">
            <div className="absolute inset-0 animate-spin-slow">
              <svg
                className="w-full h-full"
                viewBox="0 0 100 100"
                fill="none"
              >
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  stroke="rgba(196, 69, 54, 0.2)"
                  strokeWidth="2"
                  fill="none"
                />
                <path
                  d="M50 5 A45 45 0 0 1 95 50"
                  stroke="var(--color-primary)"
                  strokeWidth="2"
                  fill="none"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-2xl font-bold text-[var(--color-primary)]">
                起
              </span>
            </div>
          </div>
          <h2 className="text-2xl font-semibold mb-2">正在为您起名</h2>
          <p className="text-gray-600">
            AI 起名助手正在分析八字五行，精心挑选吉祥好名
          </p>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-600">生成进度</span>
            <span className="font-medium text-[var(--color-primary)]">
              {progress}%
            </span>
          </div>
          <div className="progress-bar">
            <div
              className="progress-bar-fill"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between text-xs mt-2 text-gray-500">
            <span>预计还需 {estimatedRemaining} 秒</span>
            <span>第 {pollAttempts} 次查询</span>
          </div>
        </div>

        {/* Current Stage Message */}
        <div className="mb-6 p-4 rounded-lg bg-[rgba(196,69,54,0.05)]">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center flex-shrink-0 animate-pulse-chinese">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <h3 className="font-medium text-[var(--color-primary)] mb-1">专家组正在讨论</h3>
              <p className="text-sm text-gray-600">{stageMessage}</p>
            </div>
          </div>
        </div>

        {/* Stages */}
        <div className="space-y-4">
          {defaultStages.map((stage) => {
            const stageStatus = getStageStatus(stage.key);
            return (
              <div
                key={stage.key}
                className={`flex items-start gap-3 p-3 rounded-lg transition-all ${
                  stageStatus === "active"
                    ? "bg-[rgba(196,69,54,0.05)]"
                    : ""
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                    stageStatus === "completed"
                      ? "bg-[var(--color-success)] text-white"
                      : stageStatus === "active"
                        ? "bg-[var(--color-primary)] text-white animate-pulse-chinese"
                        : stageStatus === "error"
                          ? "bg-[var(--color-error)] text-white"
                          : "bg-gray-200 text-gray-500"
                  }`}
                >
                  {stageStatus === "completed" ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    stage.icon
                  )}
                </div>
                <div className="flex-1">
                  <h3
                    className={`font-medium ${
                      stageStatus === "active"
                        ? "text-[var(--color-primary)]"
                        : stageStatus === "completed"
                          ? "text-[var(--color-success)]"
                          : "text-gray-500"
                    }`}
                  >
                    {stage.label}
                  </h3>
                  <p className="text-sm text-gray-500">{stage.description}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Loading Tips */}
        <div className="mt-8 p-4 rounded-lg text-center bg-[rgba(212,175,55,0.1)]">
          <p className="text-sm text-[var(--color-text)]">
            <span className="text-[var(--color-primary)] font-semibold">小知识：</span>
            传统起名需考虑八字五行、音韵平仄、字形寓意等多个维度
          </p>
        </div>
      </div>
    </div>
  );
};

const defaultStages: StageInfo[] = [
  {
    key: "analyze",
    label: "分析八字",
    description: "分析生辰八字，计算五行强弱",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    key: "generate",
    label: "生成候选",
    description: "结合字辈要求，生成候选名字",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
  },
  {
    key: "evaluate",
    label: "评分筛选",
    description: "多维度评分，筛选最优名字",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
      </svg>
    ),
  },
  {
    key: "finalize",
    label: "最终审核",
    description: "文化专家审核，确保名字吉祥",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
];

export default GeneratingPage;
