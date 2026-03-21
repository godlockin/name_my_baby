# 安全规范 - 敏感信息保护

## 禁止提交的敏感信息

以下内容严禁提交到 Git 仓库：

### 1. API Keys 和凭证
- Gemini API Key (`GEMINI_API_KEY`)
- 任何第三方服务的 API Key
- 数据库连接字符串
- 认证令牌（tokens）

### 2. 认证文件
- `.env` 文件（已加入 `.gitignore`）
- `.env.local`、`.env.*.local`
- 私钥文件（`*.key`、`*.pem`）
- 证书文件（`*.crt`）

### 3. 本地路径和配置
- 本地文件绝对路径
- 个人配置文件（`.claude/settings.local.json`）
- IDE 配置（`.idea/`、`.vscode/`）

### 4. 账号密码
- 数据库密码
- 服务账号密码
- 任何明文密码

## 正确的配置方式

### 环境变量
1. 复制 `.env.template` 为 `.env`
2. 在 `.env` 中填入实际值
3. `.env` 已被 `.gitignore` 排除，不会被提交

### Cloudflare Pages 部署
敏感环境变量应在 Cloudflare Pages 仪表板中配置：

1. 访问 [Cloudflare Pages Dashboard](https://dash.cloudflare.com/?to=/:account/pages)
2. 选择项目 → Settings → Environment variables
3. 添加生产环境变量：
   - `GEMINI_API_KEY`（必填）
   - `API_SECRET`（可选，用于管理接口）

### wrangler.toml 配置
`wrangler.toml` 可以提交到 Git，但：
- 只能包含非敏感配置（数据库名称、绑定名称等）
- 敏感值（API Key、密码）必须通过 Cloudflare 仪表板配置
- 注释中也不应包含真实凭证

## 泄露处理

如果发现敏感信息被提交：

1. **立即撤销/轮换**泄露的凭证
2. **不要直接删除**提交历史（会破坏协作）
3. 在团队频道中通知相关人员
4. 检查是否有自动化系统使用了该凭证

## 检查清单

提交代码前请确认：
- [ ] `.env` 文件未被修改或添加
- [ ] 代码中无硬编码的 API Key 或密码
- [ ] `wrangler.toml` 中无敏感值
- [ ] 无本地绝对路径
- [ ] 无个人配置文件

## 相关文件

- `.gitignore` - Git 忽略规则
- `.env.template` - 环境变量模板（不含实际值）
- `wrangler.toml` - Cloudflare 配置（仅非敏感配置）
