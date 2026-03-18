"use client";

import React from "react";
import type { NameResult } from "./ResultsList";

interface ResultDetailProps {
  name: NameResult | null;
  isOpen: boolean;
  onClose: () => void;
  onSave?: () => void;
  onShare?: () => void;
}

export const ResultDetail: React.FC<ResultDetailProps> = ({
  name,
  isOpen,
  onClose,
  onSave,
  onShare,
}) => {
  const overlayRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) {
      onClose();
    }
  };

  if (!isOpen || !name) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex justify-end"
      onClick={handleOverlayClick}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 transition-opacity animate-fade-in"
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        className="relative w-full max-w-md bg-white h-full shadow-2xl overflow-y-auto animate-fade-in"
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
      >
        {/* Header */}
        <div
          className="sticky top-0 z-10 flex items-center justify-between p-6 border-b"
          style={{
            backgroundColor: "var(--color-bg)",
            borderColor: "rgba(196, 69, 54, 0.1)",
          }}
        >
          <h2
            id="drawer-title"
            className="text-2xl font-bold"
            style={{ color: "var(--color-text)" }}
          >
            {name.name}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-black/5 rounded-full transition-colors"
            aria-label="关闭"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Name Display */}
          <div className="text-center p-6 rounded-lg" style={{ backgroundColor: "rgba(196, 69, 54, 0.05)" }}>
            <div className="text-5xl font-bold mb-2" style={{ color: "var(--color-primary)" }}>
              {name.name}
            </div>
            <p className="text-gray-500">{name.pinyin}</p>
          </div>

          {/* Score Overview */}
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 rounded-lg border" style={{ borderColor: "rgba(196, 69, 54, 0.2)" }}>
              <div className="text-2xl font-bold" style={{ color: "var(--color-primary)" }}>
                {name.score}
              </div>
              <div className="text-xs text-gray-500 mt-1">综合评分</div>
            </div>
            <div className="text-center p-4 rounded-lg border" style={{ borderColor: "rgba(212, 175, 55, 0.3)" }}>
              <div className="text-2xl font-bold" style={{ color: "var(--color-accent)" }}>
                {name.culturalScore}
              </div>
              <div className="text-xs text-gray-500 mt-1">文化评分</div>
            </div>
            <div className="text-center p-4 rounded-lg border" style={{ borderColor: "rgba(44, 44, 44, 0.2)" }}>
              <div className="text-2xl font-bold" style={{ color: "var(--color-text)" }}>
                {name.phoneticScore}
              </div>
              <div className="text-xs text-gray-500 mt-1">音韵评分</div>
            </div>
          </div>

          {/* Meaning */}
          <div>
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <svg className="w-5 h-5" style={{ color: "var(--color-primary)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              寓意解析
            </h3>
            <p className="text-gray-600 leading-relaxed">{name.meaning}</p>
          </div>

          {/* Wu Xing */}
          <div>
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <svg className="w-5 h-5" style={{ color: "var(--color-primary)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              五行分析
            </h3>
            <div className="flex flex-wrap gap-2">
              {name.wuxing.map((w, index) => (
                <span
                  key={index}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium"
                  style={{
                    backgroundColor: getWuxingColor(w),
                    color: "white",
                  }}
                >
                  {w}
                </span>
              ))}
            </div>
          </div>

          {/* Ba Zi */}
          <div>
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <svg className="w-5 h-5" style={{ color: "var(--color-primary)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              八字
            </h3>
            <div className="grid grid-cols-4 gap-2">
              {name.bazi.split(" ").map((char, index) => (
                <div
                  key={index}
                  className="text-center p-3 rounded-lg"
                  style={{ backgroundColor: "rgba(212, 175, 55, 0.1)" }}
                >
                  <span className="text-lg font-bold" style={{ color: "var(--color-text)" }}>
                    {char}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Detailed Scores */}
          <div>
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <svg className="w-5 h-5" style={{ color: "var(--color-primary)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              详细评分
            </h3>
            <div className="space-y-3">
              <ScoreBar label="文化寓意" score={name.culturalScore} />
              <ScoreBar label="音韵和谐" score={name.phoneticScore} />
              <ScoreBar label="字形美观" score={name.meaningScore} />
            </div>
          </div>

          {/* Gender Badge */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">适合：</span>
            <span className={`badge ${name.gender === "male" ? "badge-medium" : "badge-high"}`}>
              {name.gender === "male" ? "男孩" : name.gender === "female" ? "女孩" : "男孩女孩均可"}
            </span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="sticky bottom-0 p-6 border-t bg-white space-y-3">
          <button
            onClick={onSave}
            className="btn-primary w-full"
          >
            {name.isSaved ? "已收藏" : "收藏此名"}
          </button>
          <div className="flex gap-3">
            <button
              onClick={onShare}
              className="btn-secondary flex-1"
            >
              分享
            </button>
            <button
              onClick={onClose}
              className="btn-secondary flex-1"
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

function getWuxingColor(element: string): string {
  const colors: Record<string, string> = {
    金: "#9CA3AF",
    木: "#22C55E",
    水: "#3B82F6",
    火: "#EF4444",
    土: "#A855F7",
  };
  return colors[element] || "#6B7280";
}

function ScoreBar({ label, score }: { label: string; score: number }) {
  const percentage = Math.min(100, Math.max(0, score));

  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-600">{label}</span>
        <span className="font-medium">{score}分</span>
      </div>
      <div className="progress-bar h-2">
        <div
          className="progress-bar-fill"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

export default ResultDetail;
