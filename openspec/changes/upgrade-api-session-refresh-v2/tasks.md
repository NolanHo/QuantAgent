# Tasks: API Cookie Session Refresh v2

## 任务图

### 阻塞串行路径

- [ ] B1. 更新 OpenSpec artifacts
  - 输入：issue 背景、现有 `openspec/specs/api-cookie-session-auth/spec.md`、README 与 Cookie 技术文档
  - 输出：proposal/design/tasks/spec delta，明确 refresh v2、idle/absolute expiration、stable CSRF、v1 兼容窗口和 `/me` 新语义
  - 写入边界：`openspec/changes/upgrade-api-session-refresh-v2/**`

- [ ] B2. 扩展 auth settings 与 session model
  - 输入：B1 定义的 payload 与过期模型
  - 输出：新 settings、v2 payload 签发/解析、稳定 CSRF、v1 兼容解析与升级边界
  - 写入边界：`apps/api/src/quantagent/api/config/**`、`apps/api/src/quantagent/api/auth/**`

- [ ] B3. 新增 refresh route 并调整 `/me`
  - 输入：B2 session model、现有 auth routes、protected route registration boundary
  - 输出：`POST /api/v1/auth/refresh`、`/me` 读取语义调整、v1 升级逻辑
  - 写入边界：`apps/api/src/quantagent/api/routers/**`、`apps/api/src/quantagent/api/schemas/**`

- [ ] B4. 更新测试与 OpenAPI 契约
  - 输入：B2/B3 runtime 行为
  - 输出：login 签发 v2 cookie；refresh 成功/失败；CSRF 稳定；`/me` 不再无条件续期；OpenAPI 包含 refresh route；敏感信息不泄露
  - 写入边界：`apps/api/src/tests/**`

- [ ] B5. 更新 README 与 Cookie 文档
  - 输入：B2/B3/B4 最终行为
  - 输出：`apps/api/README.md`、`docs/api/http_cookie/http-cookie-technical-guide.md`、必要的前端接入说明与 `.env.example` 更新
  - 写入边界：文档与样例配置文件

## 审核检查点

- [ ] R1. 确认 refresh 不是所有 protected request 的隐式自动续期。
- [ ] R2. 确认 `/api/v1/me` 只保留 v1 兼容升级，不再承担长期 refresh 语义。
- [ ] R3. 确认 CSRF token 对 v2 session 在 refresh 前后保持稳定。
- [ ] R4. 确认 `exp` 只受 idle timeout 控制，且不会突破 `max_exp`。
- [ ] R5. 确认 parser 边界没有把 `local_admin` 固化为唯一长期 payload 契约。
- [ ] R6. 确认错误响应、README 和测试都不泄露 session/cookie/secret 原文。

## 验证

- [ ] V1. `openspec validate upgrade-api-session-refresh-v2 --type change --strict --json`
- [ ] V2. `cd apps/api && uv run python -m unittest discover -s src/tests`

## 说明

- 本 change 当前不上 Redis/DB session store，但 `sid` 与显式 refresh route 是未来迁移边界。
- 兼容策略只保留一个旧 v1 生命周期窗口，避免发布后立即要求所有本地开发者重新登录。
