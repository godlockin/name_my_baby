"use client";

import React from "react";
import { useWorkflowStore } from "../stores/workflow";

interface StepFormProps {
  onStepChange?: (step: "family" | "children" | "preferences") => void;
  onSubmit?: () => void;
}

interface FormError {
  field: string;
  message: string;
}

export const StepForm: React.FC<StepFormProps> = ({ onStepChange, onSubmit }) => {
  const {
    fatherName,
    motherName,
    children,
    generationChar,
    stylePreference,
    specialRequests,
    currentStep,
    setFatherName,
    setMotherName,
    addChild,
    removeChild,
    updateChild,
    setGenerationChar,
    setStylePreference,
    setSpecialRequests,
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
        if (!child.birthTime || child.birthTime.trim() === "") {
          newErrors.push({ field: `child-${index}-birthTime`, message: "请填写出生时间" });
        }
        if (!child.gender) {
          newErrors.push({ field: `child-${index}-gender`, message: "请选择性别" });
        }
      });
    }

    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const handleNext = () => {
    if (validateCurrentStep()) {
      const success = nextStep();
      if (success && onStepChange) {
        onStepChange(useWorkflowStore.getState().currentStep);
      }
    }
  };

  const handlePrev = () => {
    prevStep();
    if (onStepChange) {
      onStepChange(useWorkflowStore.getState().currentStep);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateCurrentStep() && onSubmit) {
      onSubmit();
    }
  };

  const getError = (field: string): string | undefined => {
    return errors.find((e) => e.field === field)?.message;
  };

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
      <form onSubmit={handleSubmit} className="card-chinese animate-fade-in">
        {currentStep === "family" && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-center mb-6" style={{ color: "var(--color-text)" }}>
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
              />
              {getError("fatherName") && (
                <p className="text-sm text-[var(--color-error)] mt-1">{getError("fatherName")}</p>
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
              />
              {getError("motherName") && (
                <p className="text-sm text-[var(--color-error)] mt-1">{getError("motherName")}</p>
              )}
            </div>

            <div className="p-4 rounded-lg" style={{ backgroundColor: "rgba(212, 175, 55, 0.1)" }}>
              <p className="text-sm" style={{ color: "var(--color-text)" }}>
                <span style={{ color: "var(--color-primary)", fontWeight: 600 }}>提示：</span>
                我们将根据父母姓名结合传统文化，为宝宝选取吉祥好名
              </p>
            </div>
          </div>
        )}

        {currentStep === "children" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold" style={{ color: "var(--color-text)" }}>
                子女信息
              </h2>
              <button
                type="button"
                onClick={addChild}
                className="btn-secondary text-sm py-2 px-4"
              >
                + 添加子女
              </button>
            </div>

            {children.map((child, index) => (
              <div
                key={child.id}
                className="p-4 rounded-lg border space-y-4"
                style={{ borderColor: "rgba(196, 69, 54, 0.2)" }}
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">孩子 {index + 1}</h3>
                  {children.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeChild(child.id)}
                      className="text-sm text-[var(--color-error)] hover:underline"
                    >
                      删除
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label label-required">性别</label>
                    <select
                      className="input"
                      value={child.gender}
                      onChange={(e) =>
                        updateChild(child.id, { gender: e.target.value as "male" | "female" })
                      }
                    >
                      <option value="male">男孩</option>
                      <option value="female">女孩</option>
                    </select>
                  </div>

                  <div>
                    <label className="label label-required">出生时间</label>
                    <input
                      type="datetime-local"
                      className={`input ${getError(`child-${index}-birthTime`) ? "input-error" : ""}`}
                      value={child.birthTime}
                      onChange={(e) =>
                        updateChild(child.id, { birthTime: e.target.value })
                      }
                    />
                    {getError(`child-${index}-birthTime`) && (
                      <p className="text-sm text-[var(--color-error)] mt-1">
                        {getError(`child-${index}-birthTime`)}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}

            <div className="p-4 rounded-lg" style={{ backgroundColor: "rgba(212, 175, 55, 0.1)" }}>
              <p className="text-sm" style={{ color: "var(--color-text)" }}>
                <span style={{ color: "var(--color-primary)", fontWeight: 600 }}>提示：</span>
                出生时间用于计算八字五行，帮助选取平衡命理的好名字
              </p>
            </div>
          </div>
        )}

        {currentStep === "preferences" && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-center mb-6" style={{ color: "var(--color-text)" }}>
              偏好设置
            </h2>

            <div>
              <label className="label">字辈要求（可选）</label>
              <input
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
              <label className="label">风格偏好（可选）</label>
              <input
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
              <label className="label">特殊要求（可选）</label>
              <textarea
                className="input"
                placeholder="其他特殊要求或说明，如希望避免的字、特定的寓意等"
                value={specialRequests}
                onChange={(e) => setSpecialRequests(e.target.value)}
                rows={4}
              />
            </div>

            <div className="p-4 rounded-lg" style={{ backgroundColor: "rgba(212, 175, 55, 0.1)" }}>
              <p className="text-sm" style={{ color: "var(--color-text)" }}>
                <span style={{ color: "var(--color-primary)", fontWeight: 600 }}>提示：</span>
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
              onClick={handlePrev}
              className="btn-secondary flex-1"
            >
              上一步
            </button>
          ) : (
            <div className="flex-1" />
          )}

          {currentStep === "preferences" ? (
            <button type="submit" className="btn-primary flex-1">
              开始起名
            </button>
          ) : (
            <button type="button" onClick={handleNext} className="btn-primary flex-1">
              下一步
            </button>
          )}
        </div>
      </form>
    </div>
  );
};

export default StepForm;
