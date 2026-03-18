"use client";

import React from "react";

interface InviteCodePanelProps {
  inviteCode: string;
  onChange: (code: string) => void;
  onVerify?: (code: string) => Promise<boolean>;
  verifiedCode?: string | null;
  isVerified?: boolean;
  className?: string;
}

interface VerificationStatus {
  valid: boolean;
  message: string;
  benefits?: string[];
}

export const InviteCodePanel: React.FC<InviteCodePanelProps> = ({
  inviteCode,
  onChange,
  onVerify,
  verifiedCode,
  isVerified = false,
  className = "",
}) => {
  const [isVerifying, setIsVerifying] = React.useState(false);
  const [status, setStatus] = React.useState<VerificationStatus | null>(null);
  const [isExpanded, setIsExpanded] = React.useState(false);

  const handleVerify = async () => {
    if (!inviteCode || inviteCode.trim().length === 0) {
      setStatus({
        valid: false,
        message: "请输入邀请码",
      });
      return;
    }

    setIsVerifying(true);
    setStatus(null);

    try {
      if (onVerify) {
        const isValid = await onVerify(inviteCode.trim());
        if (isValid) {
          setStatus({
            valid: true,
            message: "邀请码验证成功",
            benefits: [
              "解锁完整起名报告",
              "无限次名字收藏",
              "获取名字详细解析",
              "优先客户服务支持",
            ],
          });
        } else {
          setStatus({
            valid: false,
            message: "邀请码无效，请检查后重试",
          });
        }
      } else {
        // Default verification logic (placeholder)
        setStatus({
          valid: true,
          message: "邀请码验证成功",
          benefits: [
            "解锁完整起名报告",
            "无限次名字收藏",
            "获取名字详细解析",
          ],
        });
      }
    } catch (error) {
      setStatus({
        valid: false,
        message: "验证失败，请稍后重试",
      });
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div
      className={`card-chinese ${className}`}
      style={{ borderColor: isVerified ? "var(--color-success)" : undefined }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center ${
              isVerified
                ? "bg-[var(--color-success)]"
                : "bg-[var(--color-accent)]"
            }`}
          >
            {isVerified ? (
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            )}
          </div>
          <div>
            <h3 className="font-semibold" style={{ color: "var(--color-text)" }}>
              {isVerified ? "已激活会员权益" : "邀请码"}
            </h3>
            <p className="text-sm text-gray-500">
              {isVerified ? "享受完整起名服务" : "有邀请码？解锁完整权益"}
            </p>
          </div>
        </div>
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform ${
            isExpanded ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="mt-4 space-y-4 animate-fade-in">
          {isVerified ? (
            /* Verified State */
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="badge badge-premium">VIP 会员</span>
                <span className="text-sm text-[var(--color-success)] font-medium">
                  已验证
                </span>
              </div>
              <div className="text-sm text-gray-600 mb-3">
                您的邀请码已激活，享受以下权益：
              </div>
              <ul className="space-y-2">
                {[
                  "解锁完整起名报告（含详细解析）",
                  "无限次名字收藏",
                  "获取八字五行详细分析",
                  "优先客户服务支持",
                  "新名字无限次重新生成",
                ].map((benefit, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm">
                    <svg
                      className="w-4 h-4 text-[var(--color-success)] flex-shrink-0 mt-0.5"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="text-gray-600">{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            /* Input State */
            <>
              <div className="flex gap-2">
                <input
                  type="text"
                  className="input flex-1"
                  placeholder="请输入邀请码"
                  value={inviteCode}
                  onChange={(e) => onChange(e.target.value.toUpperCase())}
                  disabled={isVerifying}
                />
                <button
                  onClick={handleVerify}
                  disabled={isVerifying || !inviteCode}
                  className="btn-primary whitespace-nowrap"
                >
                  {isVerifying ? (
                    <span className="flex items-center gap-2">
                      <span className="spinner w-4 h-4" />
                      验证中...
                    </span>
                  ) : (
                    "验证"
                  )}
                </button>
              </div>

              {/* Status Message */}
              {status && (
                <div
                  className={`p-3 rounded-lg text-sm ${
                    status.valid
                      ? "bg-[rgba(34, 197, 94, 0.1)] text-[var(--color-success)]"
                      : "bg-[rgba(239, 68, 68, 0.1)] text-[var(--color-error)]"
                  }`}
                >
                  {status.message}
                </div>
              )}

              {/* Benefits Preview */}
              {!status && (
                <div className="text-sm text-gray-500">
                  <p className="font-medium mb-2">邀请码权益：</p>
                  <ul className="space-y-1">
                    <li className="flex items-center gap-2">
                      <span className="w-1 h-1 rounded-full bg-[var(--color-primary)]" />
                      <span>解锁完整起名报告</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1 h-1 rounded-full bg-[var(--color-primary)]" />
                      <span>无限次名字收藏</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1 h-1 rounded-full bg-[var(--color-primary)]" />
                      <span>获取详细名字解析</span>
                    </li>
                  </ul>
                </div>
              )}

              {/* Benefits List (after verification) */}
              {status?.benefits && (
                <div className="mt-3 p-3 rounded-lg bg-[rgba(212, 175, 55, 0.1)]">
                  <p className="text-sm font-medium mb-2" style={{ color: "var(--color-text)" }}>
                    已解锁权益：
                  </p>
                  <ul className="space-y-1">
                    {status.benefits.map((benefit, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm">
                        <svg
                          className="w-4 h-4 text-[var(--color-success)] flex-shrink-0 mt-0.5"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                        <span className="text-gray-600">{benefit}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default InviteCodePanel;
