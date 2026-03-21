"use client";

import React from "react";
import { useWorkflowStore } from "../stores/workflow";
import type { NameScheme } from "../types";
import TreeDiagram from "./TreeDiagram";

export interface NameResult {
  id: string;
  name: string;
  pinyin: string;
  gender: "male" | "female" | "unisex";
  score: number;
  meaning: string;
  wuxing: string[];
  bazi: string;
  culturalScore: number;
  phoneticScore: number;
  meaningScore: number;
  isSaved?: boolean;
}

interface ResultsListProps {
  onBack?: () => void;
  onRegenerate?: () => void;
}

// Convert NameScheme to NameResult
const convertToNameResult = (scheme: NameScheme): NameResult => {
  // Extract five elements from bazi analysis
  const wuxing: string[] = [];
  if (scheme.baziAnalysis) {
    const match = scheme.baziAnalysis.match(/五行 [:：]\s*([金木水火土，]+)/);
    if (match) {
      wuxing.push(...match[1].split(/[,,]/).filter(Boolean));
    }
  }

  // Derive scores from available data
  const culturalScore = scheme.poetryReference ? 90 : 70;
  const phoneticScore = scheme.homophoneCheck.overall === "safe" ? 95 : 70;
  const meaningScore = scheme.poetryReference ? 85 : 75;
  const overallScore = Math.round((culturalScore + phoneticScore + meaningScore) / 3);

  return {
    id: scheme.id,
    name: scheme.chineseName,
    pinyin: "",
    gender: "unisex",
    score: overallScore,
    meaning: scheme.coreMeaning,
    wuxing: wuxing.length > 0 ? wuxing : ["金", "木", "水"],
    bazi: scheme.baziAnalysis,
    culturalScore,
    phoneticScore,
    meaningScore,
    isSaved: false,
  };
};

export const ResultsList: React.FC<ResultsListProps> = ({
  onBack,
  onRegenerate,
}) => {
  const { names, savedNames, saveName, removeSavedName, fatherName, motherName, children } = useWorkflowStore();
  const [filter, setFilter] = React.useState<"all" | "saved">("all");
  const [sortBy, setSortBy] = React.useState<"score" | "cultural" | "phonetic">("score");
  const [selectedName, setSelectedName] = React.useState<NameScheme | null>(null);

  // Convert NameScheme to NameResult for display
  const displayedNames: NameResult[] = React.useMemo(() => {
    const source = filter === "saved" ? savedNames : names;
    return source.map(convertToNameResult);
  }, [names, savedNames, filter]);

  const sortedNames = React.useMemo(() => {
    return [...displayedNames].sort((a, b) => {
      switch (sortBy) {
        case "cultural":
          return b.culturalScore - a.culturalScore;
        case "phonetic":
          return b.phoneticScore - a.phoneticScore;
        case "score":
        default:
          return b.score - a.score;
      }
    });
  }, [displayedNames, sortBy]);

  const handleToggleSave = (name: NameResult) => {
    const isSaved = savedNames.find((n) => n.id === name.id);
    if (isSaved) {
      removeSavedName(name.id);
    } else {
      // Find original scheme from names
      const originalScheme = names.find((n) => n.id === name.id);
      if (originalScheme) {
        saveName(originalScheme);
      }
    }
  };

  const getScoreBadge = (score: number) => {
    if (score >= 90) return "badge-high";
    if (score >= 75) return "badge-medium";
    return "badge-safe";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 90) return "高分";
    if (score >= 75) return "中等";
    return "参考";
  };

  return (
    <div className="min-h-screen p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2 text-[var(--color-text)]">
            起名结果
          </h1>
          <p className="text-gray-600">
            为您精心挑选了 {names.length} 个吉祥好名
          </p>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex gap-2">
            <button
              onClick={() => setFilter("all")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === "all"
                  ? "bg-[var(--color-primary)] text-white"
                  : "bg-white text-gray-600 hover:bg-gray-100"
              }`}
            >
              全部 ({names.length})
            </button>
            <button
              onClick={() => setFilter("saved")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === "saved"
                  ? "bg-[var(--color-primary)] text-white"
                  : "bg-white text-gray-600 hover:bg-gray-100"
              }`}
            >
              已收藏 ({savedNames.length})
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">排序：</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="input py-2 px-3 text-sm w-auto"
            >
              <option value="score">综合评分</option>
              <option value="cultural">文化评分</option>
              <option value="phonetic">音韵评分</option>
            </select>
          </div>
        </div>

        {/* Results Grid */}
        {sortedNames.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sortedNames.map((name) => (
              <div
                key={name.id}
                className="card name-card cursor-pointer"
                onClick={() => {
                  const originalScheme = names.find((n) => n.id === name.id) || savedNames.find((n) => n.id === name.id);
                  if (originalScheme) {
                    setSelectedName(originalScheme);
                  }
                }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-2xl font-bold text-[var(--color-text)]">
                      {name.name}
                    </h3>
                    <p className="text-sm text-gray-500">{name.pinyin}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`badge ${getScoreBadge(name.score)}`}>
                      {getScoreLabel(name.score)}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleSave(name);
                      }}
                      className="p-1 hover:bg-gray-100 rounded"
                    >
                      {savedNames.find((n) => n.id === name.id) ? (
                        <svg className="w-5 h-5 text-[var(--color-primary)]" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M5 4a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 20V4z" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 4a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 20V4z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-3">
                  <span className={`badge ${name.gender === "male" ? "badge-medium" : "badge-high"}`}>
                    {name.gender === "male" ? "男孩" : name.gender === "female" ? "女孩" : "通用"}
                  </span>
                  <span className="badge badge-premium">综合 {name.score}分</span>
                </div>

                <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                  {name.meaning}
                </p>

                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <div className="flex items-center gap-1">
                    {name.wuxing.slice(0, 3).map((w, i) => (
                      <span
                        key={i}
                        className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600"
                      >
                        {w}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span>文化 {name.culturalScore}</span>
                    <span>音韵 {name.phoneticScore}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card text-center py-12">
            <svg
              className="w-16 h-16 mx-auto mb-4 text-gray-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
              />
            </svg>
            <p className="text-gray-500">
              {filter === "saved" ? "暂无收藏的名字" : "暂无结果"}
            </p>
            {filter === "saved" && (
              <button
                onClick={() => setFilter("all")}
                className="btn-secondary mt-4"
              >
                查看全部名字
              </button>
            )}
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex flex-wrap justify-center gap-4 mt-8">
          <button onClick={onBack} className="btn-secondary">
            重新填写
          </button>
          <button onClick={onRegenerate} className="btn-primary">
            重新生成
          </button>
        </div>
      </div>

      {/* Name Detail Modal */}
      {selectedName && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">名字详情</h2>
              <button
                onClick={() => setSelectedName(null)}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6">
              <TreeDiagram
                nameScheme={selectedName}
                fatherName={fatherName}
                motherName={motherName}
                children={children}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResultsList;
