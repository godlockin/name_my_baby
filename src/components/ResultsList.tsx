"use client";

import React from "react";

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
  names?: NameResult[];
  savedNames?: NameResult[];
  onSelectName?: (name: NameResult) => void;
  onToggleSave?: (name: NameResult) => void;
  onBack?: () => void;
  onRegenerate?: () => void;
}

export const ResultsList: React.FC<ResultsListProps> = ({
  names = [],
  savedNames = [],
  onSelectName,
  onToggleSave,
  onBack,
  onRegenerate,
}) => {
  const [filter, setFilter] = React.useState<"all" | "saved">("all");
  const [sortBy, setSortBy] = React.useState<"score" | "cultural" | "phonetic">("score");

  const displayedNames = filter === "saved" ? savedNames : names;

  const sortedNames = [...displayedNames].sort((a, b) => {
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
          <h1 className="text-3xl font-bold mb-2" style={{ color: "var(--color-text)" }}>
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
                onClick={() => onSelectName?.(name)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-2xl font-bold" style={{ color: "var(--color-text)" }}>
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
                        onToggleSave?.(name);
                      }}
                      className="p-1 hover:bg-gray-100 rounded"
                    >
                      {name.isSaved ? (
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
    </div>
  );
};

export default ResultsList;
