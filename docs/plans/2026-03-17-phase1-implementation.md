# Phase 1 Implementation Plan

**Created:** 2026-03-17
**Status:** In Progress

---

## Overview

Phase 1 实现完整的 7 Agent 团队 + 邀请码系统，不做支付功能。

**范围：**
- 7 个 Agent（八字、谐音、古诗词、历史、英文语言学、欧洲历史、汇总员）
- 用户表单采集
- Layer 1 / Layer 2 输出
- 邀请码系统（后台生成 + 输入解锁）
- 免费版 vs 邀请码解锁版权益

**不做：**
- 支付功能
- 微信小程序
- 👍/👎反馈
- Pin + 重新生成
- 对比功能

---

## Technical Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14 + React 18 + Zustand |
| Deployment | Cloudflare Pages |
| API | Cloudflare Workers + Hono |
| Database | Cloudflare D1 |
| Storage | Cloudflare R2 |
| AI | Gemini 2.0 Flash |

---

## Project Structure

```
name_my_baby/
├── apps/
│   ├── web/                    # Next.js 前端
│   │   └── src/
│   │       ├── app/            # Pages
│   │       ├── components/     # UI 组件
│   │       ├── stores/         # Zustand 状态
│   │       ├── hooks/          # 自定义 hooks
│   │       └── lib/            # 工具函数
│   └── workers/                # Cloudflare Workers
│       └── src/
│           ├── agents/         # 7 个 Agent 实现
│           ├── api/            # API 路由
│           ├── db/             # D1 schema
│           ├── types/          # 类型定义
│           └── utils/          # 工具函数
└── docs/
    └── plans/
        └── 2026-03-17-phase1-implementation.md
```

---

## Development Tasks

### Phase 1: Project Initialization ✅

- [x] 创建 Next.js + Cloudflare Pages 项目
- [x] 配置 Wrangler (Workers + D1 + R2)
- [x] 设置环境变量 (GEMINI_API_KEY 等)
- [x] 创建基础类型定义

### Phase 2: Database Schema ✅

- [x] D1 Schema 设计
  - `invite_codes` 表
  - `user_sessions` 表

### Phase 3: Agent Implementation ✅

- [x] Agent 基础框架（共享 Context 模式）
- [x] 八字分析师 Prompt + 输出解析
- [x] 谐音梗专家 Prompt + 输出解析
- [x] 古诗词专家 Prompt + 输出解析
- [x] 历史学家 Prompt + 输出解析
- [x] 英文语言学专家 Prompt + 输出解析
- [x] 欧洲历史专家 Prompt + 输出解析
- [x] 汇总员 Prompt + 输出解析
- [x] Agent 编排流程（4 轮协作）

### Phase 4: API Development ✅

- [x] POST /api/generate - 提交表单，生成名字
- [x] GET /api/job/:id - 查询生成进度
- [x] POST /api/invite/verify - 验证邀请码
- [x] POST /api/invite/use - 使用邀请码
- [x] GET /api/history - 获取历史记录
- [x] POST /admin/invite/generate - 生成邀请码
- [x] GET /admin/invite/list - 列出邀请码

### Phase 5: Frontend Development (In Progress)

- [ ] 首页（价值说明 + CTA）
- [ ] 表单页面（分步式：家庭信息 → 子女信息 → 偏好）
- [ ] 生成中页面（进度可视化）
- [ ] 结果列表页（Layer 1 卡片）
- [ ] 详情页（Layer 2 抽屉）
- [ ] 邀请码输入页
- [ ] 本地收藏功能

### Phase 6: Testing and Deployment

- [ ] E2E 测试（关键路径：表单→生成→结果）
- [ ] 性能优化（缓存、并发限制）
- [ ] 部署到 Cloudflare Pages
- [ ] 域名绑定

---

## Key Design Decisions

### 1. Agent Output Contract

所有 Agent 输出统一格式：
```typescript
interface AgentOutput<T> {
  status: "success" | "failed" | "timeout";
  data: T;
  constraints?: Constraints;
  notes: string;
}
```

### 2. Shared Context Pattern

```typescript
interface SharedContext {
  sessionId: string;
  userInput: UserInput;
  round1?: { baziAnalysis, homophoneCheck };
  round2?: { poetry, history, english };
  round3?: { finalNames };
}
```

### 3. Invite Code Flow

1. 用户提交表单时可选填邀请码
2. Workers 验证邀请码有效性
3. 生成完成后标记为 used，绑定 Device ID + 手机号
4. 防刷：一次性使用 + 强绑定

### 4. Free vs Premium

| Feature | Free | Invite Code |
|---------|------|-------------|
| 方案数量 | 1-2 | 5-8 |
| 英文名 | ❌ | ✅ |
| Layer 2 | ❌ | ✅ |
| 详细分析 | 基础 | 完整 |

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Gemini API 超时 | 单 Agent 超时 5s，降级输出 |
| 免费用户滥用 | Device ID 限流（每设备每天 1 次） |
| D1 并发冲突 | 事务 + 乐观锁 |
| 结果质量不稳定 | Prompt 迭代 + 输出质量评分 |

---

## Next Steps

1. 完成前端页面开发
2. 添加 E2E 测试
3. 部署到 Cloudflare Pages
4. 绑定域名
5. 准备上线

---

## Notes

- 使用 Gemini 2.0 Flash（成本低、速度快）
- 手机号选填（平衡体验和识别）
- 出生时间精确到小时（降低填写门槛）
- 小程序暂不做，先聚焦 Web
