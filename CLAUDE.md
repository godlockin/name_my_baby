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

### Code Structure

```
src/
├── app/              # Next.js app router pages
├── components/       # React components (StepForm, ResultsList, etc.)
├── lib/
│   ├── agents.ts     # Base Agent runner + 7 agent configs
│   ├── team.ts       # AgentTeam orchestrator (3-round pipeline)
│   ├── utils.ts      # Helpers (validation, constraint building)
│   └── api.ts        # Frontend API client
├── stores/
│   └── workflow.ts   # Zustand state management
└── types/
    └── index.ts      # Shared type definitions

functions/
└── api/[[route]].ts  # Cloudflare Pages Functions (Hono router)

docs/
├── prd.md            # Product requirements
├── agent-design.md   # Agent architecture
└── invite-code-design.md
```

### Agent Pipeline (混合协作模式)

```
Round 1 (并行): 八字分析师 + 谐音梗专家 → 生成约束条件
Round 2 (并行): 古诗词专家 + 历史学家 + 英文专家 → 候选字/英文名
Round 3 (聚合): 汇总员 → 组合方案 + 复审
输出：Layer 1 简要版 → Layer 2 详细版 (按需展开)
```

### 技术栈

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 15 + React 18 + TypeScript |
| State | Zustand |
| Styling | Tailwind CSS |
| Backend | Cloudflare Pages Functions + Hono |
| Database | Cloudflare D1 (SQLite) |
| Storage | Cloudflare R2 |
| AI | Google Gemini 2.0 Flash |

---

## API Routes (Hono in functions/api/[[route]].ts)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/generate` | Submit form, run agent team, store results |
| GET | `/api/job/:id` | Poll for generation status/results |
| POST | `/api/invite/verify` | Verify invite code validity |
| POST | `/api/invite/use` | Reserve invite code |
| GET | `/api/history?deviceId=` | Get user's session history |
| POST | `/api/admin/invite/generate` | Generate invite codes (admin) |
| GET | `/api/admin/invite/list` | List invite codes (admin) |

---

## Database Schema (D1)

### invite_codes
```sql
code TEXT PRIMARY KEY,
creator_device_id TEXT, creator_phone TEXT,
used_by_device_id TEXT, used_by_phone TEXT,
status TEXT CHECK(status IN ('available', 'used', 'expired')),
created_at, used_at, expires_at INTEGER
```

### user_sessions
```sql
id TEXT PRIMARY KEY,
device_id TEXT, phone TEXT,
input_data TEXT, result_data TEXT,
invite_code_used TEXT, is_premium INTEGER,
created_at, updated_at INTEGER
```

---

## Key Patterns

### Shared Context Pattern
Agents read/write to a shared `SharedContext` object passed through the pipeline.

### Constraint Propagation
Round 1 outputs (`recommendedRadicals`, `forbiddenChars`) filter Round 2 search space.

### Layered Output
- **Layer 1**: Name cards with minimal info
- **Layer 2**: Full analysis expanded on demand

### Agent Output Contract
```typescript
interface AgentOutput<T> {
  status: "success" | "failed" | "timeout";
  data: T;
  notes: string;
}
```

---

## State Management (Zustand)

`src/stores/workflow.ts` manages:
- Form data (parent names, children info, preferences)
- UI state (current step, generation status)
- Results (generated names, saved names)

Key actions: `nextStep`, `prevStep`, `startGeneration`, `saveName`, `reset`

---

## Development Commands

```bash
npm install                    # Install dependencies
npm run dev                    # Next.js dev server
npm run build                  # Build for production
npm run pages:build            # Build for Cloudflare Pages
npm run preview                # Local preview with Wrangler
npm run deploy                 # Deploy to Cloudflare Pages
npm run db:migrate             # Run D1 migrations (local)
npm run db:migrate:prod        # Run D1 migrations (production)
npm run check:functions        # Type check Functions
npm run check:next             # Type check Next.js
npm run lint                   # ESLint
```

### Local Setup

```bash
cp .env.example .env           # Create .env
# Add: GEMINI_API_KEY=your_key_here
npm run db:migrate             # Initialize D1
npm run dev                    # Start at http://localhost:3000
```

---

## Visual Design

| Element | Value |
|---------|-------|
| 朱砂红 | `#C44536` |
| 米白色 | `#F8F4E8` |
| 墨色 | `#2C2C2C` |
| 淡金 | `#D4AF37` |

Fonts: 思源宋体 (titles), 思源黑体 (body)
