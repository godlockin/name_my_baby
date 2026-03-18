# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Project Overview

**AI 起名助手 (Name My Baby)** - A multi-agent AI system that generates culturally meaningful Chinese baby names with:
- Five Elements (八字五行) analysis
- Homophone risk detection (普通话/方言/中英文)
- Classical literature references (诗经/论语/楚辞)
- English name recommendations with etymology
- Multi-children name correlation support

---

## Architecture

### Agent Team (混合协作模式)

```
Round 1 (并行): 八字分析师 + 谐音梗专家 → 生成约束条件
Round 2 (并行): 古诗词专家 + 历史学家 + 英文专家 → 候选字/英文名
Round 3 (串行): 汇总员 → 组合方案 + 复审
Round 4 (输出): Layer 1 简要版 → Layer 2 详细版 (按需展开)
```

### Agent 角色

| Agent | 职责 | 人设 |
|-------|------|------|
| 八字分析师 | 五行喜忌、用字建议 | 玄学老先生 |
| 谐音梗专家 | 全维度谐音检查 | 网感年轻人 |
| 古诗词专家 | 典籍出处考据 (分级标注) | 文学教授 |
| 历史学家 | 历史典故分析 | 博学大叔 |
| 英文语言学专家 | 英文名推荐 + 词源 | 海归精英 |
| 欧洲历史专家 | 英文名典故来源 | 文化学者 |
| 汇总员 | 整合所有输出生成方案 | 产品经理 |

### 技术选型

- **前端**: Next.js 14+ (Web + 小程序)
- **部署**: Cloudflare Pages
- **存储**: Cloudflare R2
- **Agent 框架**: 待定 (需支持多 Agent 协作)

---

## Key Design Patterns

### Shared Context Pattern

All agents read/write to a shared JSON context:
```typescript
interface SharedContext {
  session_id: string;
  user_input: UserInput;
  round1: { bazi_analysis: Analysis; homophone_check: HomophoneResult };
  round2: { candidate_chars: CandidateChar[]; candidate_names: string[] };
  round3: { final_review: FinalReview };
}
```

### Layered Output Pattern

- **Layer 1**: 3-5 name cards with name + English name + one-sentence meaning
- **Layer 2**: Detailed analysis (Five Elements, homophone, references, etymology)

### Constraint Propagation

Round 1 agents generate constraints that filter Round 2 search space:
- `must_have` / `avoid` radicals from Bazi analysis
- `forbidden_chars` from homophone check

---

## Development Guidelines

### Type Safety

Use `unknown` + type guards for external data, never `any`. Define interfaces for all API responses and Agent outputs.

### Agent Output Contracts

Each agent must output:
1. `status: "success" | "failed"`
2. `data`: Structured JSON
3. `constraints`: For downstream agents
4. `notes`: Human-readable explanation

### Error Handling

- Timeout per agent: 5s
- Degraded output: Continue with available results if single agent times out
- Startup validation: Fail immediately on missing env vars (API keys)

### Cost Optimization

- Parallel execution where possible
- Cache/reuse identical analyses
- Constraint-filtered search space
-分层 output (load detailed analysis on-demand)

---

## Data Model

### User Input (必填)
- Father name, Mother name
- Children count (1-4), each child's gender + birth time

### User Input (选填)
- Generation character (字辈)
- Style preference (自由描述)
- Special requests
- Phone number (for user identification)

### Storage (Cloudflare R2)
- User input (linked to Device ID + timestamp)
- Generated results
- Phone number (optional, for cross-device linking)

---

## Invite Code System

- **Format**: 6 chars (AB3X9K) - ~160M combinations
- **Usage**: 1 invite code = 1 full generation (one-time use, bound to user)
- **Anti-fraud**: Device ID + phone verification + IP rate limiting
- **Expiry**: 30 days

---

## Visual Design

| Element | Value | Usage |
|---------|-------|-------|
| 朱砂红 | `#C44536` | Primary buttons, emphasis |
| 米白色 | `#F8F4E8` | Background |
| 墨色 | `#2C2C2C` | Body text |
| 淡金 | `#D4AF37` | Premium features |

- **Fonts**: 思源宋体 (titles), 思源黑体 (body)
- **Style**: Minimal Chinese decorative elements (云纹/回纹/印章)

---

## Documentation

- `docs/prd.md` - Product requirements
- `docs/agent-design.md` - Agent team architecture
- `docs/invite-code-design.md` - Invite code system design

---

## Development Commands

```bash
# Install dependencies
npm install

# Start Next.js dev server (frontend)
npm run dev

# Build for production (verifies both Next.js and Functions)
npm run build

# Type check Functions only
npm run check:functions

# Type check Next.js only
npm run check:next
```

### Local Development Setup

```bash
# 1. Create .env file with your Gemini API Key
cp .env.example .env
# Edit .env and add: GEMINI_API_KEY=your_key_here

# 2. Initialize local D1 database
npm run db:migrate

# 3. Start development server
npm run dev
```

Access the app at: http://localhost:3000

### TypeScript Configuration

- `tsconfig.json` - Next.js app (excludes `functions/`)
- `functions/tsconfig.json` - Cloudflare Pages Functions (includes `@cloudflare/workers-types`)
