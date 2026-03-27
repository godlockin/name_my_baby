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
| 汇总员 | 整合所有输出生成方案 | 产品经理 |
| 快速起名专家 | 快速生成名字方案 (fastMode) | 高效顾问 |

### 技术选型

- **前端**: Next.js 15 (static export to `out/`)
- **部署**: Cloudflare Pages
- **存储**: Cloudflare R2
- **数据库**: Cloudflare D1 (SQLite)
- **AI 模型**:
  - Primary: Gemini API (gemini-2.5-flash, gemini-2.0-flash)
  - Backup: Zhipu AI API (glm-4-air, glm-4-flash)
- **LLM Provider 抽象**: 支持多 provider 自动故障切换

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

# Development
npm run dev       # Start local dev server (Cloudflare Pages + Functions) at http://localhost:3001
npm run build     # Build static frontend to out/ directory

# Preview production build locally
npm run preview   # Builds + serves production build locally

# Deploy to Cloudflare Pages
npm run deploy    # Deploy to production (main branch)

# Testing (Vitest for unit tests, Playwright for E2E)
npm test          # Run Vitest unit tests (src/**/__tests__/**/*.test.{ts,tsx})
npm run test:ui   # Run Vitest with UI
npm run test:headed  # Run Playwright E2E tests with visible browser
npx playwright test tests/e2e/regression.test.ts  # Run specific E2E test file
```

### Local Development Setup

```bash
# 1. Create .env file with your Gemini API Key
# Required env vars: GEMINI_API_KEY, BACKDOOR_INVITE_CODES (optional)

# 2. Initialize local D1 database
npm run db:migrate

# 3. Build frontend and start development server
npm run build
npm run dev
```

Access the app at: http://localhost:3001

### Architecture

- **Frontend**: Next.js 15 static export (`output: "export"`) to `out/` directory
- **API**: Cloudflare Pages Functions in `functions/` directory using Hono framework
- **Development**: `wrangler pages dev out` serves both static assets and Functions

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/generate` | POST | Submit form and create session, returns session ID |
| `/api/job/:id` | GET | Poll for job status and results |
| `/api/invite/verify` | POST | Verify invite code validity |
| `/api/invite/use` | POST | Reserve invite code |
| `/api/history` | GET | Get user's generation history by device ID |
| `/api/admin/invite/generate` | POST | Generate new invite codes (requires API_SECRET) |
| `/api/admin/invite/list` | GET | List all invite codes (requires API_SECRET) |

### Environment Variables

```bash
# Required (at least one)
GEMINI_API_KEY=your_gemini_api_key
ZHIPU_API_KEY=your_zhipu_api_key  # Optional: BigModel.cn (智谱 AI) API key

# LLM Provider Selection
DEFAULT_LLM_PROVIDER=gemini  # 'gemini' or 'zhipu' (default: gemini)

# Optional
BACKDOOR_INVITE_CODES=comma,separated,codes  # Backdoor invite codes for testing
API_SECRET=admin_secret_for_api_protection
ENABLE_RATE_LIMIT=true  # Enable rate limiting
RATE_LIMIT_MAX=100  # Max requests per minute per IP/device
```

### LLM Provider Configuration

The system supports multiple LLM providers with automatic fallback:

1. **Gemini** (Google) - Default provider
   - Models: `gemini-2.5-flash` (standard), `gemini-2.0-flash` (fast mode)
   - Requires: `GEMINI_API_KEY`

2. **Zhipu AI** (智谱 AI / BigModel.cn) - Backup provider
   - Models: `glm-4-air` (standard), `glm-4-flash` (fast mode)
   - Requires: `ZHIPU_API_KEY`
   - API Docs: https://docs.bigmodel.cn/

**Provider Failover:**
- If both API keys are configured, the system automatically falls back to the secondary provider when the primary fails
- Set `DEFAULT_LLM_PROVIDER` to switch the primary provider
- The failover is transparent to users

**Provider Implementation:**
- `src/lib/llm-providers.ts` - Provider abstraction layer with `LLMProviderBase`, `GeminiProvider`, `ZhipuProvider`, and `ProviderManager`
- `src/lib/agents.ts` - Agent runner with provider manager integration
- `ProviderManager.generateContentWithFallback()` - Automatic retry with next provider on failure

### Database Schema

**invite_codes** table:
- `code` (TEXT, PK): 6-char invite code
- `creator_device_id`, `creator_phone`: Creator info
- `used_by_device_id`, `used_by_phone`: User info
- `status`: available | used | expired
- `is_unlimited`: 1 = unlimited use, never expires
- `created_at`, `used_at`, `expires_at`: timestamps

**user_sessions** table:
- `id` (TEXT, PK): Session ID
- `device_id`, `phone`: User identifiers
- `input_data` (JSON): Form input
- `result_data` (JSON): Generation results or processing state
- `invite_code_used`: Code used for this session
- `is_premium` (INTEGER): Premium status
- `created_at`, `updated_at`: timestamps

### ChildInfo Data Structure

Children information is stored with separate year, month, day, and hour fields for feng shui calculations:

```typescript
interface ChildInfo {
  id: string;
  name: string;         // Child's name (optional, for reference only)
  gender: "male" | "female";
  birthYear: number;    // YYYY format, e.g., 2024
  birthMonth: number;   // MM format (1-12)
  birthDay: number;     // DD format (1-31)
  birthHour: string;    // HH format (00-23)
}
```

The form combines `birthYear`, `birthMonth`, `birthDay`, and `birthHour` into ISO datetime string when submitting to API:
```typescript
birthTime: `${child.birthYear}-${String(child.birthMonth).padStart(2, '0')}-${String(child.birthDay).padStart(2, '0')}T${child.birthHour}:00`
```

**Default values:** New child entries are initialized with current date and time (year, month, day, hour from `new Date()`).

**Name field:** Changed from required to optional - serves as reference only, parents can leave it empty if they want the AI to suggest names without prior input.

### TypeScript Configuration

- `tsconfig.json` - Next.js app (excludes `functions/`)
- `functions/tsconfig.json` - Cloudflare Pages Functions (includes `@cloudflare/workers-types`)
- `vitest.config.ts` - Vitest unit testing config

## Testing

#### Unit Tests (Vitest)

Located in `src/**/__tests__/**/*.test.{ts,tsx}`. Configuration in `vitest.config.ts`.

```bash
# Run all unit tests
npm test

# Run with UI
npm run test:ui

# Run with coverage
npm run test:coverage

# Run specific test file
npx vitest run src/lib/__tests__/utils.test.ts
```

#### E2E Tests (Playwright)

Located in `tests/e2e/`. Tests cover:

1. **Complete flow test** - Full user journey from form fill to API submission
2. **Validation test** - Required field validation
3. **Children management test** - Add/remove children (1-4 limit)
4. **API data format test** - Verifies children data is formatted correctly

```bash
# Run all E2E tests
npx playwright test

# Run with visible browser
npm run test:headed

# Run specific test file
npx playwright test tests/e2e/regression.test.ts

# Run with UI
npm run test:ui
```

---

## Code Organization

```
├── functions/              # Cloudflare Pages Functions (API)
│   └── api/[[route]].ts   # Hono-based API entry point
├── src/
│   ├── app/               # Next.js app router pages
│   ├── components/        # React components
│   ├── lib/               # Shared utilities and agent logic
│   ├── stores/            # Zustand state stores
│   ├── types/             # TypeScript type definitions
│   └── test/              # Vitest test setup
├── docs/                  # Documentation
├── tests/e2e/             # Playwright E2E tests
└── .claude/               # Claude configuration
```

---

## Test Results

All tests passing as of 2026-03-27:

- **79 Unit Tests** (Vitest) - Testing API client, utils, team orchestration, and React components
- **4 E2E Tests** (Playwright) - Testing full user flow, validation, children management, and API data format

**Total: 83 tests, 0 failures**
