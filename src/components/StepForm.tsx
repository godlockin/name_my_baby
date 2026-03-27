"use client";

import React from "react";
import { useWorkflowStore } from "../stores/workflow";
import InviteCodePanel from "./InviteCodePanel";

interface StepFormProps {
  onStepChange?: (step: "family" | "children" | "preferences") => void;
  onSubmit?: () => void;
}

interface FormError {
  field: string;
  message: string;
}

type DebugWindow = Window & {
  __handleNextCalled?: boolean;
  __handleNextCalledAt?: string;
  __stepFormSubmitCalled?: boolean;
  __stepFormSubmitCalledAt?: string;
  __stepFormSubmitCurrentStep?: unknown;
};

export const StepForm: React.FC<StepFormProps> = ({ onStepChange, onSubmit }) => {
  const {
    fatherName,
    motherName,
    children,
    generationChar,
    stylePreference,
    specialRequests,
    inviteCode,
    currentStep,
    setFatherName,
    setMotherName,
    addChild,
    removeChild,
    updateChild,
    setGenerationChar,
    setStylePreference,
    setSpecialRequests,
    setInviteCode,
    nextStep,
    prevStep,
  } = useWorkflowStore();

  const [errors, setErrors] = React.useState<FormError[]>([]);

  React.useEffect(() => {
    setErrors([]);
  }, [currentStep]);

  const validateCurrentStep = (): boolean => {
    const newErrors: FormError[] = [];

    if (currentStep === "family") {
      if (!fatherName || fatherName.trim().length < 2) {
        newErrors.push({ field: "fatherName", message: "父亲姓名至少 2 个字" });
      }
      if (!motherName || motherName.trim().length < 2) {
        newErrors.push({ field: "motherName", message: "母亲姓名至少 2 个字" });
      }
    }

    if (currentStep === "children") {
      children.forEach((child, index) => {
        // Name is now optional, removed validation
        if (!child.gender) {
          newErrors.push({ field: `child-${index}-gender`, message: "请选择性别" });
        }
        if (!child.birthYear || !child.birthMonth || !child.birthDay) {
          newErrors.push({ field: `child-${index}-birth`, message: "请选择出生日期" });
        }
        if (!child.birthHour) {
          newErrors.push({ field: `child-${index}-birthHour`, message: "请选择出生时辰" });
        }
      });
    }

    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const handleNext = (e?: React.MouseEvent) => {
    console.log('[StepForm] handleNext called, currentStep:', currentStep);
    // Debug: Set a window flag to track handleNext calls
    const debugWindow = window as DebugWindow;
    debugWindow.__handleNextCalled = true;
    debugWindow.__handleNextCalledAt = new Date().toISOString();
    // Prevent form submission event from bubbling up
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (validateCurrentStep()) {
      const success = nextStep();
      console.log('[StepForm] nextStep returned:', success, 'new currentStep:', useWorkflowStore.getState().currentStep);
      if (success && onStepChange) {
        onStepChange(useWorkflowStore.getState().currentStep);
      }
    }
  };

  const handlePrev = (e?: React.MouseEvent) => {
    // Prevent form submission event from bubbling up
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    prevStep();
    if (onStepChange) {
      onStepChange(useWorkflowStore.getState().currentStep);
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    console.log('[StepForm] handleSubmit called, currentStep:', currentStep);
    // Debug: Set a window flag to track handleSubmit calls
    const debugWindow = window as DebugWindow;
    debugWindow.__stepFormSubmitCalled = true;
    debugWindow.__stepFormSubmitCalledAt = new Date().toISOString();
    debugWindow.__stepFormSubmitCurrentStep = currentStep;
    // Only allow submission on preferences step
    if (currentStep !== "preferences") {
      console.log('[StepForm] handleSubmit returning early, not on preferences step');
      return;
    }
    if (e) {
      e.preventDefault();
    }
    console.log('[StepForm] handleSubmit calling onSubmit');
    if (validateCurrentStep() && onSubmit) {
      onSubmit();
    }
  };

  const getError = (field: string): string | undefined => {
    return errors.find((e) => e.field === field)?.message;
  };

  const errorId = (field: string) => `error-${field}`;

  const steps: { key: "family" | "children" | "preferences"; label: string }[] = [
    { key: "family", label: "家庭信息" },
    { key: "children", label: "子女信息" },
    { key: "preferences", label: "偏好设置" },
  ];

  const currentStepIndex = steps.findIndex((s) => s.key === currentStep);

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Step Indicator */}
      <div className="step-indicator">
        {steps.map((step, index) => (
          <React.Fragment key={step.key}>
            <div className="step">
              <div
                className={`step-circle ${
                  index === currentStepIndex
                    ? "active"
                    : index < currentStepIndex
                      ? "completed"
                      : ""
                }`}
              >
                {index < currentStepIndex ? "✓" : index + 1}
              </div>
              <span
                className={`text-sm font-medium hidden sm:inline ${
                  index === currentStepIndex ? "text-[var(--color-primary)]" : "text-gray-500"
                }`}
              >
                {step.label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div
                className={`step-line ${index < currentStepIndex ? "completed" : ""}`}
              />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Form Content */}
      <div className="card-chinese animate-fade-in">
        {currentStep === "family" && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-center mb-6 text-[var(--color-text)]">
              家庭信息
            </h2>

            <div>
              <label className="label label-required">父亲姓名</label>
              <input
                type="text"
                className={`input ${getError("fatherName") ? "input-error" : ""}`}
                placeholder="请输入父亲姓名"
                value={fatherName}
                onChange={(e) => setFatherName(e.target.value)}
                disabled={false}
                aria-invalid={!!getError("fatherName")}
                aria-describedby={getError("fatherName") ? errorId("fatherName") : undefined}
              />
              {getError("fatherName") && (
                <p id={errorId("fatherName")} className="text-sm text-[var(--color-error)] mt-1" role="alert">
                  {getError("fatherName")}
                </p>
              )}
            </div>

            <div>
              <label className="label label-required">母亲姓名</label>
              <input
                type="text"
                className={`input ${getError("motherName") ? "input-error" : ""}`}
                placeholder="请输入母亲姓名"
                value={motherName}
                onChange={(e) => setMotherName(e.target.value)}
                aria-invalid={!!getError("motherName")}
                aria-describedby={getError("motherName") ? errorId("motherName") : undefined}
              />
              {getError("motherName") && (
                <p id={errorId("motherName")} className="text-sm text-[var(--color-error)] mt-1" role="alert">
                  {getError("motherName")}
                </p>
              )}
            </div>

            <div className="p-4 rounded-lg bg-[rgba(212,175,55,0.1)]">
              <p className="text-sm text-[var(--color-text)]">
                <span className="text-[var(--color-primary)] font-semibold">提示：</span>
                我们将根据父母姓名结合传统文化，为宝宝选取吉祥好名
              </p>
            </div>
          </div>
        )}

        {currentStep === "children" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-[var(--color-text)]">
                子女信息
              </h2>
              <button
                type="button"
                onClick={addChild}
                disabled={children.length >= 4}
                className="btn-secondary text-sm py-2 px-4 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                + 添加子女
              </button>
            </div>

            {children.map((child, index) => (
              <div
                key={child.id}
                className="p-4 rounded-lg border space-y-4 border-[rgba(196,69,54,0.2)]"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium">孩子 {index + 1}</h3>
                    {child.name && (
                      <span className="text-sm text-gray-500">（参考：{child.name}）</span>
                    )}
                  </div>
                  {children.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`确定要删除孩子 ${index + 1} 的信息吗？此操作不可恢复。`)) {
                          removeChild(child.id);
                        }
                      }}
                      className="text-sm text-[var(--color-error)] hover:underline"
                    >
                      删除
                    </button>
                  )}
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="label">姓名（可选，仅供参考）</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="如家族有字辈要求可先填写，最终起名可参考"
                      value={child.name}
                      onChange={(e) => updateChild(child.id, { name: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="label label-required">性别</label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name={`gender-${child.id}`}
                          checked={child.gender === "male"}
                          onChange={() => updateChild(child.id, { gender: "male" })}
                          className="radio"
                        />
                        男
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name={`gender-${child.id}`}
                          checked={child.gender === "female"}
                          onChange={() => updateChild(child.id, { gender: "female" })}
                          className="radio"
                        />
                        女
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="label label-required">出生时间</label>
                    <div className="grid grid-cols-4 gap-2">
                      {/* Year */}
                      <select
                        className="input"
                        value={child.birthYear}
                        onChange={(e) => updateChild(child.id, { birthYear: parseInt(e.target.value, 10) })}
                        aria-label="出生年份"
                      >
                        {Array.from({ length: 10 }, (_, i) => 2021 + i).map((year) => (
                          <option key={year} value={year}>{year}年</option>
                        ))}
                      </select>

                      {/* Month */}
                      <select
                        className="input"
                        value={child.birthMonth}
                        onChange={(e) => updateChild(child.id, { birthMonth: parseInt(e.target.value, 10) })}
                        aria-label="出生月份"
                      >
                        {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                          <option key={month} value={month}>{month}月</option>
                        ))}
                      </select>

                      {/* Day */}
                      <select
                        className="input"
                        value={child.birthDay}
                        onChange={(e) => updateChild(child.id, { birthDay: parseInt(e.target.value, 10) })}
                        aria-label="出生日期"
                      >
                        {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                          <option key={day} value={day}>{day}日</option>
                        ))}
                      </select>

                      {/* Hour */}
                      <select
                        className="input"
                        value={child.birthHour}
                        onChange={(e) => updateChild(child.id, { birthHour: e.target.value })}
                        aria-label="出生时辰"
                      >
                        {Array.from({ length: 24 }, (_, i) => i).map((hour) => (
                          <option key={hour} value={hour.toString().padStart(2, "0")}>{hour}时</option>
                        ))}
                      </select>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      年/月/日/时分别选择
                    </p>
                  </div>
                </div>
              </div>
            ))}

            <div className="p-4 rounded-lg bg-[rgba(212,175,55,0.1)]">
              <p className="text-sm text-[var(--color-text)]">
                <span className="text-[var(--color-primary)] font-semibold">提示：</span>
                出生时间用于计算八字五行，帮助选取平衡命理的好名字
              </p>
            </div>
          </div>
        )}

        {currentStep === "preferences" && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-center mb-6 text-[var(--color-text)]">
              偏好设置
            </h2>

            <div>
              <label htmlFor="generation-char" className="label">字辈要求（可选）</label>
              <input
                id="generation-char"
                type="text"
                className="input"
                placeholder="如家族有字辈要求请填写"
                value={generationChar}
                onChange={(e) => setGenerationChar(e.target.value)}
              />
              <p className="text-xs text-gray-500 mt-1">
                如果家族有排字辈的传统，请输入对应的字
              </p>
            </div>

            <div>
              <label htmlFor="style-pref" className="label">风格偏好（可选）</label>
              <input
                id="style-pref"
                type="text"
                className="input"
                placeholder="如：文雅、大气、古典、现代等"
                value={stylePreference}
                onChange={(e) => setStylePreference(e.target.value)}
              />
              <div className="flex flex-wrap gap-2 mt-2">
                {["文雅", "大气", "古典", "现代", "清新", "知性"].map((style) => (
                  <button
                    key={style}
                    type="button"
                    onClick={() => setStylePreference(style)}
                    className={`px-3 py-1 rounded-full text-sm transition-colors ${
                      stylePreference === style
                        ? "bg-[var(--color-primary)] text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {style}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="special-requests" className="label">特殊要求（可选）</label>
              <textarea
                id="special-requests"
                className="input"
                placeholder="其他特殊要求或说明，如希望避免的字、特定的寓意等"
                value={specialRequests}
                onChange={(e) => setSpecialRequests(e.target.value)}
                rows={4}
              />
            </div>

            <InviteCodePanel
              inviteCode={inviteCode}
              onChange={setInviteCode}
              className="mt-6"
            />

            <div className="p-4 rounded-lg bg-[rgba(212,175,55,0.1)]">
              <p className="text-sm text-[var(--color-text)]">
                <span className="text-[var(--color-primary)] font-semibold">提示：</span>
                以上选项均为可选，不填写将根据传统文化自动匹配最佳名字
              </p>
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex gap-4 mt-8">
          {currentStep !== "family" ? (
            <button
              type="button"
              onClick={(e) => handlePrev(e)}
              className="btn-secondary flex-1"
            >
              上一步
            </button>
          ) : (
            <div className="flex-1" />
          )}

          {currentStep === "preferences" ? (
            <button type="button" onClick={handleSubmit} className="btn-primary flex-1">
              开始起名
            </button>
          ) : (
            <button type="button" onClick={(e) => handleNext(e)} className="btn-primary flex-1">
              下一步
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default StepForm;
