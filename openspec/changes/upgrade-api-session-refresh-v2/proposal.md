# Change: 升级 API Cookie Session Refresh 为安全优先的可迁移 v2

## 来源

- GitHub issue: https://github.com/BqLee-AI/QuantAgent/issues/unknown
- Issue 标题：`升级 API Cookie Session Refresh 为安全优先的可迁移 v2`
- 影响范围：`apps/api` Cookie Session、CSRF、OpenAPI、README 与 HTTP Cookie 文档

## Issue 归一化

本 change 只解决一个问题：把 `apps/api` 现有 Cookie Session refresh 从“`GET /api/v1/me` 无条件隐式续期”收敛为显式、可审核、未来可迁移到服务端 session store 的 v2 模型。

它现在重要，是因为 QuantAgent 后续会逐步承载插件配置、密钥管理、审批、dry-run executor 与受控执行等高风险能力。如果继续把 refresh 绑定到读取 `/me` 和 `exp` 变化上的 CSRF token，前端多 tab、并发请求、未来多用户主体和服务端 session 迁移都会变得脆弱。

## 当前基线

- 当前 API 已有本地单用户 Cookie Session 闭环：`POST /api/v1/auth/login`、`POST /api/v1/auth/logout`、`GET /api/v1/me`、CurrentActor、capability guard、CSRF guard 与统一 401/403 envelope。
- 现有 session payload 仍偏 v1：包含 `sub/type/exp/csrf/capabilities`，CSRF 依赖 `actor_id + exp` 派生。
- `GET /api/v1/me` 在 session 模式下会自动重签 cookie 并回写新的 `csrf_token`。
- 当前不使用 Redis/DB session store，也没有 revoke list、设备管理或多用户表。

## 目标

- 新增显式 `POST /api/v1/auth/refresh`，作为延长登录态的唯一主要入口。
- 引入 v2 session payload：至少包含 `v`、`sid`、`sub`、`actor_type`、`iat`、`exp`、`max_exp`、`capabilities`。
- 区分 idle/sliding expiration 与 absolute expiration；refresh 只能延长 `exp`，不能突破 `max_exp`。
- 把 CSRF token 改为绑定稳定 session identity，而不是依赖 `exp`。
- 保持当前不引入 Redis/DB session store，但为未来服务端 lookup / revocation 预留 `sid` 和内部边界。
- 让 `/api/v1/me` 回归读取当前 actor 的语义，只保留明确的 v1→v2 兼容升级窗口。

## 非目标

- 不引入 Redis、DB session table、revoke list、设备管理或多用户注册。
- 不实现 access token + refresh token 双 token 体系。
- 不实现 RBAC、OAuth、SSO、租户或真实交易相关 re-auth 流程。
- 不把 refresh 作为高风险动作确认机制。

## 变更内容

- 扩展 auth settings，增加 `AUTH_SESSION_ABSOLUTE_LIFETIME_SECONDS` 和 `AUTH_SESSION_REFRESH_THRESHOLD_SECONDS`。
- 新增 v2 session 签发、解析与 refresh 逻辑，保留对旧 v1 cookie 的迁移兼容。
- 新增 `POST /api/v1/auth/refresh`，要求有效 session + 有效 CSRF。
- 调整 `/api/v1/me`，不再无条件续期；仅在识别 v1 cookie 时执行一次 v2 升级。
- 更新 API tests、OpenAPI contract tests、`apps/api/README.md`、HTTP Cookie 技术文档与前端接入说明。

## 验收标准

- `POST /api/v1/auth/refresh` 是 protected route，并且成功前必须通过 CSRF 校验。
- v2 session payload 至少包含 `v/sid/sub/actor_type/iat/exp/max_exp/capabilities`。
- refresh 后 `csrf_token` 保持稳定，不因 `exp` 改变而变化。
- refresh 只有在剩余 idle 时间低于阈值且实际延长 `exp` 时才回写 cookie。
- `GET /api/v1/me` 不再作为长期主 refresh 入口。
- 错误响应、成功响应和测试输出都不泄露 raw session、cookie、signature、secret、password 或 traceback。

## 失败信号

- `/api/v1/me` 仍在每次读取时无条件滑动续期。
- refresh 需要前端在每次成功后频繁替换 CSRF token。
- absolute expiration 到期后仍可继续 refresh。
- session payload、错误体或日志泄露 secret、cookie value 或导出材料。
- 新 route 没有进入标准 API v1 registration boundary 或 OpenAPI 契约测试。

## 依赖与顺序

- 无外部服务依赖。
- 先更新 OpenSpec artifacts，再调整 settings/session/routes/tests/docs。
- 本 change 不要求 Redis、真实凭证、真实交易或数据库 migration。

## 验证

- `openspec validate upgrade-api-session-refresh-v2 --type change --strict --json`
- `cd apps/api && uv run python -m unittest discover -s src/tests`
