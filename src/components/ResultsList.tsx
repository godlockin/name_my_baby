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
  childIndex?: number; // 第几个孩子（从 1 开始）
  childGender?: "male" | "female"; // 孩子性别
}

interface ResultsListProps {
  onBack?: () => void;
  onRegenerate?: () => void;
}

// Convert NameScheme to NameResult
const convertToNameResult = (scheme: NameScheme, children?: Array<{ gender: "male" | "female" }>): NameResult => {
  // Extract five elements from bazi analysis
  const wuxing: string[] = [];
  if (scheme.baziAnalysis) {
    const match = scheme.baziAnalysis.match(/五行 [:：]\s*([金木水火土，]+)/);
    if (match) {
      wuxing.push(...match[1].split(/[,,]/).filter(Boolean));
    }
  }

  // Derive scores from available data - add variation based on name content
  const hasPoetry = !!scheme.poetryReference;
  const hasHistory = !!scheme.historyReference;
  const hasEnglish = !!scheme.englishEtymology;
  const isSafe = scheme.homophoneCheck?.overall === "safe";

  // Base scores
  let culturalScore = hasPoetry ? 85 : 70;
  if (hasHistory) culturalScore += 5;

  let phoneticScore = isSafe ? 90 : 60;
  // Add small variation based on name length (simpler names are easier to pronounce)
  const nameLength = scheme.chineseName?.length || 2;
  if (nameLength === 2) phoneticScore += 3;

  let meaningScore = hasPoetry ? 80 : 70;
  if (hasHistory) meaningScore += 5;
  if (hasEnglish) meaningScore += 3;

  // Add hash-based variation to avoid all names having same score
  const hash = scheme.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const variation = (hash % 5); // 0-4 variation

  culturalScore += variation;
  meaningScore += variation;

  const overallScore = Math.round((culturalScore + phoneticScore + meaningScore) / 3);

  // Extract child info using targetChildIndex from scheme
  let childIndex: number | undefined;
  let childGender: "male" | "female" | undefined;

  const targetIndex = scheme.targetChildIndex ?? 0;
  const childFromStore = children && children.length > targetIndex ? children[targetIndex] : undefined;

  // Priority: 1) LLM returned gender (must be exactly "male" or "female"), 2) derived from children array
  if (scheme.gender === "male" || scheme.gender === "female") {
    childGender = scheme.gender;
  } else if (childFromStore?.gender === "male" || childFromStore?.gender === "female") {
    childGender = childFromStore.gender;
  }

  if (childFromStore) {
    childIndex = targetIndex + 1; // Display as 1-based
  }

  return {
    id: scheme.id,
    name: scheme.chineseName,
    pinyin: "",
    gender: childGender || "unisex",
    score: overallScore,
    meaning: scheme.coreMeaning,
    wuxing: wuxing.length > 0 ? wuxing : ["金", "木", "水"],
    bazi: scheme.baziAnalysis,
    culturalScore,
    phoneticScore,
    meaningScore,
    isSaved: false,
    childIndex,
    childGender,
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

  // Convert NameScheme to NameResult for display, preserving the original ID
  const displayedNames: Array<{ result: NameResult; id: string }> = React.useMemo(() => {
    const source = filter === "saved" ? savedNames : names;
    return source.map((scheme) => ({
      result: convertToNameResult(scheme, children),
      id: scheme.id,
    }));
  }, [names, savedNames, filter, children]);

  const sortedNames = React.useMemo(() => {
    return [...displayedNames].sort((a, b) => {
      switch (sortBy) {
        case "cultural":
          return b.result.culturalScore - a.result.culturalScore;
        case "phonetic":
          return b.result.phoneticScore - a.result.phoneticScore;
        case "score":
        default:
          return b.result.score - a.result.score;
      }
    });
  }, [displayedNames, sortBy]);

  // Get original scheme by ID from the correct source array
  // Use callback pattern to always get latest state
  const getOriginalScheme = React.useCallback((id: string, currentFilter: "all" | "saved"): NameScheme | null => {
    const source = currentFilter === "saved" ? savedNames : names;
    return source.find((n) => n.id === id) || null;
  }, [names, savedNames]);

  const handleToggleSave = (id: string) => {
    const originalScheme = getOriginalScheme(id, filter);
    if (!originalScheme) {
      console.error('[ResultsList] ToggleSave: No scheme found for id:', id);
      return;
    }

    const isSaved = savedNames.find((n) => n.id === id);
    if (isSaved) {
      removeSavedName(id);
    } else {
      saveName(originalScheme);
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
            {sortedNames.map(({ result: name, id }) => (
              <div
                key={`${filter}-${id}`}
                className="card name-card cursor-pointer"
                onClick={() => {
                  const originalScheme = getOriginalScheme(id, filter);
                  if (!originalScheme) {
                    console.error('[ResultsList] Click: No scheme found for id:', id);
                    return;
                  }
                  console.log('[ResultsList] Click: Selected name:', originalScheme.chineseName, 'id:', id);
                  setSelectedName(originalScheme);
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
                        handleToggleSave(id);
                      }}
                      className="p-1 hover:bg-gray-100 rounded"
                    >
                      {savedNames.find((n) => n.id === id) ? (
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
                  {name.childIndex !== undefined && (
                    <span className="badge badge-medium">
                      孩子{name.childIndex}
                    </span>
                  )}
                  {name.childGender && (
                    <span className={`badge ${name.childGender === "male" ? "badge-medium" : "badge-high"}`}>
                      {name.childGender === "male" ? "男孩" : "女孩"}
                    </span>
                  )}
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
                childrenInfo={children}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResultsList;
