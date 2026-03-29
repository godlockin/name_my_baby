# 生产环境部署指南

## 完整部署流程

### 1. 本地构建

```bash
# 清理并重新构建
rm -rf .vercel/output
npm run build

# 准备部署文件（复制 functions 目录）
./scripts/prepare-deploy.sh
```

### 2. 配置生产环境 Secrets

通过 Cloudflare CLI 配置环境变量（需要登录到 Cloudflare 账户）：

```bash
# Gemini API Key（必需 - 如果用作主要 LLM provider）
echo "$GEMINI_API_KEY" | wrangler pages secret put GEMINI_API_KEY --project-name=name-my-baby

# Zhipu API Key（必需 - 如果用作备用 LLM provider）
echo "$ZHIPU_API_KEY" | wrangler pages secret put ZHIPU_API_KEY --project-name=name-my-baby

# 默认 LLM Provider（可选，默认：gemini）
echo "zhipu" | wrangler pages secret put DEFAULT_LLM_PROVIDER --project-name=name-my-baby

# 后门邀请码（测试用，逗号分隔多个代码）
echo "BACKDOOR" | wrangler pages secret put BACKDOOR_INVITE_CODES --project-name=name-my-baby

# API 管理密钥（可选 - 保护管理员 API）
echo "your_admin_secret" | wrangler pages secret put API_SECRET --project-name=name-my-baby
```

**重要说明**：
- Secrets 配置后，新部署会自动应用
- 如果 Secrets 不生效，需要在 Cloudflare Dashboard 手动验证
- Secrets 不会显示在部署日志中，只能通过 Dashboard 查看

### 3. 部署到 Cloudflare Pages

```bash
# 部署到 main 分支（生产环境）
wrangler pages deploy .vercel/output --project-name=name-my-baby --branch=main --commit-dirty=true
```

部署成功后会返回：
- 临时预览 URL：`https://[commit-hash].name-my-baby-eh8.pages.dev`
- 分支 URL：`https://main.name-my-baby-eh8.pages.dev`

### 4. 验证部署

```bash
# 测试静态页面加载
curl -s https://main.name-my-baby-eh8.pages.dev | head -20

# 测试邀请码验证 API
curl -s -X POST https://main.name-my-baby-eh8.pages.dev/api/invite/verify \
  -H "Content-Type: application/json" \
  -d '{"code":"BACKDOOR","deviceId":"test-device"}'

# 测试完整生成流程（需要有效的邀请码）
curl -s -X POST https://main.name-my-baby-eh8.pages.dev/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "fatherName":"张三",
    "motherName":"李四",
    "children":[{
      "gender":"male",
      "birthYear":2024,
      "birthMonth":6,
      "birthDay":15,
      "birthHour":"08"
    }],
    "inviteCode":"BACKDOOR",
    "deviceId":"test-device-123"
  }'
```

### 5. 绑定自定义域名

**通过 Cloudflare Dashboard 操作**：

1. 访问 https://dash.cloudflare.com/pages
2. 选择 `name-my-baby` 项目
3. 进入 **Settings** → **Custom domains**
4. 点击 **Add custom domain**
5. 输入域名：`name-my-baby.331912.xyz`
6. 选择绑定到 **Production** 分支 (main)
7. 确认 DNS 记录已正确配置

**DNS 配置要求**：
- 如果使用 Cloudflare DNS：自动配置 CNAME
- 如果外部 DNS：添加 CNAME 记录指向 `name-my-baby-eh8.pages.dev`

### 6. D1 数据库初始化

如果是首次部署，需要初始化数据库：

```bash
# 初始化 D1 数据库（生产环境）
wrangler d1 execute name-my-baby-db --remote --file=./src/db/migrations/001_init.sql
wrangler d1 execute name-my-baby-db --remote --file=./src/db/migrations/002_add_unlimited_invite.sql
```

## 常见问题排查

### API 返回 "邀请码不存在"

**原因**：BACKDOOR_INVITE_CODES secret 未正确配置

**解决方案**：
1. 确认 secret 已通过 CLI 配置：
   ```bash
   wrangler pages secret list --project-name=name-my-baby
   ```
2. 在 Dashboard 验证：Settings → Environment variables → Production
3. 重新部署以应用新配置

### API 超时（Generation timeout）

**原因**：
- LLM API Keys 未配置
- LLM provider 响应慢或失败

**解决方案**：
1. 验证 GEMINI_API_KEY 和 ZHIPU_API_KEY 已配置
2. 检查 DEFAULT_LLM_PROVIDER 设置
3. 查看 Cloudflare Functions 日志

### 自定义域名显示旧版本

**原因**：域名绑定到旧部署而非 production 分支

**解决方案**：
1. Dashboard → Custom domains
2. 删除现有绑定
3. 重新绑定到 Production 分支 (main)

### 数据库错误

**原因**：D1 数据库未初始化或 schema 不匹配

**解决方案**：
1. 运行 migrations 初始化表结构
2. 检查 wrangler.toml 中 database_id 是否正确

## 部署检查清单

- [ ] 本地构建成功（`npm run build`）
- [ ] Functions 目录正确复制到 `.vercel/output/functions/`
- [ ] 所有 secrets 已配置（GEMINI_API_KEY, ZHIPU_API_KEY, BACKDOOR_INVITE_CODES）
- [ ] 部署到 main 分支
- [ ] API 验证通过（invite/verify 端点）
- [ ] 自定义域名绑定到 production 分支
- [ ] D1 数据库已初始化
- [ ] 端到端测试通过

## 快速部署命令

```bash
# 一键部署（假设环境变量已配置）
npm run build && \
./scripts/prepare-deploy.sh && \
wrangler pages deploy .vercel/output --project-name=name-my-baby --branch=main --commit-dirty=true
```

## 环境变量参考

| 变量名 | 必需 | 说明 | 示例 |
|--------|------|------|------|
| GEMINI_API_KEY | 是* | Gemini API 密钥 | `AIza...` |
| ZHIPU_API_KEY | 是* | 智谱 AI API 密钥 | `xxx...` |
| DEFAULT_LLM_PROVIDER | 否 | 默认 provider | `gemini` 或 `zhipu` |
| BACKDOOR_INVITE_CODES | 否 | 测试用邀请码 | `BACKDOOR,TEST123` |
| API_SECRET | 否 | 管理员 API 密钥 | 任意字符串 |
| ENABLE_RATE_LIMIT | 否 | 启用限流 | `true` |
| RATE_LIMIT_MAX | 否 | 每分钟请求数 | `100` |

* 至少配置一个 LLM provider 的 API Key
