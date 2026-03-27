"use client";

import React from "react";
import type { NameScheme, BaziData } from "../types";

interface TreeDiagramProps {
  nameScheme: NameScheme;
  fatherName: string;
  motherName: string;
  childrenInfo: Array<{
    name?: string;
    gender: "male" | "female";
    birthYear: number;
    birthMonth: number;
    birthDay: number;
    birthHour: string;
  }>;
}

/**
 * 纵向树状图谱组件
 * 展示家庭信息、生辰八字、专家组分析过程
 */
export const TreeDiagram: React.FC<TreeDiagramProps> = ({
  nameScheme,
  fatherName,
  motherName,
  childrenInfo,
}) => {
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({
    family: true,
    bazi: true,
    agents: false,
    references: false,
  });

  const toggleSection = (section: string) => {
    setExpanded((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  // Safe access to homophone check with default values
  const homophoneCheck = nameScheme.homophoneCheck || {
    mandarin: "safe" as const,
    dialects: [],
    english: "safe" as const,
    overall: "safe" as const,
  };

  // 提取姓氏
  const surnameChoice = nameScheme.surnameSource || "father"; // Default to father's surname
  const surname = surnameChoice === "mother"
    ? motherName.charAt(0)
    : fatherName.charAt(0);
  // Handle cases where chineseName is empty or too short
  const givenName = nameScheme.chineseName && nameScheme.chineseName.length > 1
    ? nameScheme.chineseName.slice(1)
    : nameScheme.chineseName || "";

  // 格式化八字信息
  const formatBaziInfo = () => {
    if (!nameScheme.baziDetails) {
      return {
        eightChars: nameScheme.baziAnalysis || "八字排盘信息",
        fiveElements: nameScheme.fiveElementsDistribution || "金木水火土",
      };
    }
    return {
      eightChars: nameScheme.baziDetails.eightChars,
      fiveElements: nameScheme.baziDetails.fiveElements,
    };
  };

  const baziInfo = formatBaziInfo();

  // 获取孩子信息
  const childInfo = childrenInfo.map((child, index) => ({
    ...child,
    label: `孩子${index + 1}${child.name ? `（${child.name}）` : ""}`,
    birthInfo: `${child.birthYear}年${child.birthMonth}月${child.birthDay}日${child.birthHour}时`,
    genderLabel: child.gender === "male" ? "男" : "女",
  }));

  return (
    <div className="tree-diagram">
      {/* 顶部：名字展示 */}
      <div className="tree-node root-node">
        <div className="name-display">
          <span className="surname">{surname}</span>
          <span className="given-name">{givenName}</span>
        </div>
        <div className="name-info">
          <span className="core-meaning">{nameScheme.coreMeaning}</span>
          {nameScheme.englishName && (
            <span className="english-name">{nameScheme.englishName}</span>
          )}
        </div>
      </div>

      {/* 连接线 */}
      <div className="tree-connector"></div>

      {/* 家庭信息 */}
      <div className="tree-section">
        <button
          className="tree-header"
          onClick={() => toggleSection("family")}
        >
          <span className="tree-icon">{expanded.family ? "▼" : "▶"}</span>
          <span>家庭信息</span>
        </button>

        {expanded.family && (
          <div className="tree-content">
            <div className="tree-grid">
              <div className="tree-item">
                <span className="item-label">父亲</span>
                <span className="item-value">{fatherName}</span>
              </div>
              <div className="tree-item">
                <span className="item-label">母亲</span>
                <span className="item-value">{motherName}</span>
              </div>
              <div className="tree-item">
                <span className="item-label">姓氏</span>
                <span className="item-value">
                  {nameScheme.surnameSource === "mother" ? "随母姓" : "随父姓"}
                </span>
              </div>
              {childInfo.map((child, index) => (
                <div key={index} className="tree-item tree-item-child">
                  <span className="item-label">{child.label}</span>
                  <span className="item-value">
                    {child.genderLabel} · {child.birthInfo}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 连接线 */}
      <div className="tree-connector"></div>

      {/* 八字分析 */}
      <div className="tree-section">
        <button
          className="tree-header"
          onClick={() => toggleSection("bazi")}
        >
          <span className="tree-icon">{expanded.bazi ? "▼" : "▶"}</span>
          <span>生辰八字分析</span>
        </button>

        {expanded.bazi && (
          <div className="tree-content">
            <div className="bazi-display">
              <div className="bazi-chars">
                <span className="bazi-label">八字：</span>
                <span className="bazi-value">{baziInfo.eightChars}</span>
              </div>
              <div className="five-elements">
                <span className="bazi-label">五行：</span>
                <span className="five-elements-value">{baziInfo.fiveElements}</span>
              </div>
              {nameScheme.baziAnalysis && (
                <div className="bazi-summary">
                  <span className="bazi-label">分析：</span>
                  <p className="bazi-text">{nameScheme.baziAnalysis}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 连接线 */}
      <div className="tree-connector"></div>

      {/* 专家组分析 */}
      <div className="tree-section">
        <button
          className="tree-header"
          onClick={() => toggleSection("agents")}
        >
          <span className="tree-icon">{expanded.agents ? "▼" : "▶"}</span>
          <span>专家组综合考量</span>
        </button>

        {expanded.agents && (
          <div className="tree-content">
            <div className="agents-grid">
              {/* 八字分析师 */}
              {nameScheme.agentNotes?.bazi && (
                <div className="agent-card">
                  <div className="agent-header">
                    <span className="agent-icon">🔮</span>
                    <span className="agent-title">八字分析师</span>
                  </div>
                  <p className="agent-note">{nameScheme.agentNotes.bazi}</p>
                </div>
              )}

              {/* 谐音梗专家 */}
              {nameScheme.agentNotes?.homophone && (
                <div className="agent-card">
                  <div className="agent-header">
                    <span className="agent-icon">🎯</span>
                    <span className="agent-title">谐音梗专家</span>
                  </div>
                  <p className="agent-note">{nameScheme.agentNotes.homophone}</p>
                </div>
              )}

              {/* 古诗词专家 */}
              {nameScheme.agentNotes?.poetry && (
                <div className="agent-card">
                  <div className="agent-header">
                    <span className="agent-icon">📖</span>
                    <span className="agent-title">古诗词专家</span>
                  </div>
                  <p className="agent-note">{nameScheme.agentNotes.poetry}</p>
                </div>
              )}

              {/* 历史学家 */}
              {nameScheme.agentNotes?.history && (
                <div className="agent-card">
                  <div className="agent-header">
                    <span className="agent-icon">🏛️</span>
                    <span className="agent-title">历史学家</span>
                  </div>
                  <p className="agent-note">{nameScheme.agentNotes.history}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 连接线 */}
      <div className="tree-connector"></div>

      {/* 来源出处 */}
      <div className="tree-section">
        <button
          className="tree-header"
          onClick={() => toggleSection("references")}
        >
          <span className="tree-icon">{expanded.references ? "▼" : "▶"}</span>
          <span>来源出处与寓意</span>
        </button>

        {expanded.references && (
          <div className="tree-content">
            <div className="references-list">
              {/* 诗词出处 */}
              {nameScheme.poetryReference && (
                <div className="reference-item">
                  <div className="reference-header">
                    <span className="reference-icon">📜</span>
                    <span className="reference-title">诗词出处</span>
                    {nameScheme.poetryReference.level && (
                      <span className="reference-level">{nameScheme.poetryReference.level}</span>
                    )}
                  </div>
                  {nameScheme.poetryReference.original && (
                    <p className="reference-original">{nameScheme.poetryReference.original}</p>
                  )}
                  {nameScheme.poetryReference.source && (
                    <p className="reference-source">出自：{nameScheme.poetryReference.source}</p>
                  )}
                  <p className="reference-explanation">{nameScheme.poetryReference.explanation}</p>
                </div>
              )}

              {/* 历史典故 */}
              {nameScheme.historyReference && (
                <div className="reference-item">
                  <div className="reference-header">
                    <span className="reference-icon">🏺</span>
                    <span className="reference-title">历史典故</span>
                  </div>
                  {nameScheme.historyReference.original && (
                    <p className="reference-original">{nameScheme.historyReference.original}</p>
                  )}
                  {nameScheme.historyReference.source && (
                    <p className="reference-source">出自：{nameScheme.historyReference.source}</p>
                  )}
                  <p className="reference-explanation">{nameScheme.historyReference.explanation}</p>
                </div>
              )}

              {/* 英文名词源 */}
              {nameScheme.englishEtymology && (
                <div className="reference-item">
                  <div className="reference-header">
                    <span className="reference-icon">🌍</span>
                    <span className="reference-title">英文名词源</span>
                  </div>
                  <p className="reference-explanation">
                    <strong>{nameScheme.englishEtymology.etymology}</strong>
                    <br />
                    原意：{nameScheme.englishEtymology.originalMeaning}
                    <br />
                    与中文名关联：{nameScheme.englishEtymology.relationToChinese}
                  </p>
                </div>
              )}

              {/* 谐音检查 */}
              <div className="reference-item">
                <div className="reference-header">
                  <span className="reference-icon">🔊</span>
                  <span className="reference-title">谐音检查</span>
                  <span className={`risk-badge risk-${homophoneCheck.overall}`}>
                    {homophoneCheck.overall === "safe" ? "安全" :
                     homophoneCheck.overall === "medium" ? "中等" : "高风险"}
                  </span>
                </div>
                {homophoneCheck.dialects.map((dialect, index) => (
                  <div key={index} className="dialect-check">
                    <span>{dialect.dialect}：</span>
                    <span className={`risk-text risk-${dialect.risk}`}>
                      {dialect.risk === "safe" ? "安全" :
                       dialect.risk === "medium" ? "注意" : "避免"}
                    </span>
                    {dialect.note && <span className="dialect-note"> - {dialect.note}</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TreeDiagram;
