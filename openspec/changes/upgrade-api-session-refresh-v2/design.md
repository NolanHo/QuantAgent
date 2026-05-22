# Design: API Cookie Session Refresh v2

## 背景

当前 `apps/api` 的 Cookie Session 已经能支撑本地单用户管理台登录，但 refresh 语义仍然偏隐式：`GET /api/v1/me` 会自动重签 cookie，并且 CSRF token 跟随 `exp` 变化。这个模型在单 tab、单用户早期原型里可用，但不适合作为 QuantAgent 后续安全边界的长期契约。

本设计要做的是：保留当前“本地单用户 + 无服务端 session store”的实现复杂度，同时把 payload、refresh API 和解析边界收敛成未来可迁移到服务端 session lookup / revocation 的形态。

## 目标

- 明确 refresh 只通过 `POST /api/v1/auth/refresh` 触发。
- 使用 v2 payload 和稳定 `sid` 来派生 CSRF。
- 把过期模型拆成 idle timeout（`exp`）和 absolute timeout（`max_exp`）。
- 让当前解析逻辑支持“现在只签本地管理员，但未来主体不必重写整个 parser”。
- 保留 v1 cookie 的自然过期兼容窗口，不强制发布后立即重新登录。

## 非目标

- 不引入 Redis/DB session store。
- 不实现多用户主体、租户、RBAC 或 refresh token rotation。
- 不把 refresh 提升为 re-auth / approval / Policy Gate 替代物。

## 关键决策

### 1. refresh 入口显式化

`POST /api/v1/auth/refresh` 成为唯一主要 refresh 入口。它必须已经通过默认 protected route policy，并且额外要求有效 `X-CSRF-Token`。

`GET /api/v1/me` 只负责返回当前 actor 快照；它不再作为长期 refresh 主路径。唯一兼容例外是：如果解析到旧 v1 cookie，`/me` 可以执行一次 v1→v2 升级并回写 cookie，之后恢复为纯读取语义。

### 2. session payload 升级为 v2

v2 payload 至少包含：

- `v`: schema 版本，当前为 `2`
- `sid`: 稳定 session identity
- `sub`: 主体标识
- `actor_type`: 当前主体类型
- `iat`: 初次签发时间
- `exp`: 当前 idle expiration
- `max_exp`: absolute expiration 上限
- `capabilities`: 当前 capability 快照

当前仍只签发本地管理员 `local_admin/local_single_user`，但 parser 先做通用 payload 校验，再由“当前本地主体映射层”决定是否接受为现阶段支持的 actor。这样未来引入多用户或服务端 lookup 时，payload/parser 与 actor 映射边界可以复用。

### 3. CSRF 改为绑定稳定 session identity

v2 CSRF token 使用 `sid + sub + secret` 派生，不再依赖 `exp`。这样 refresh 延长 `exp` 时 CSRF 保持稳定，避免多 tab 和并发请求因为 cookie 续期而频繁失效。

旧 v1 cookie 仍按原先 `actor_id + exp` 校验，只作为迁移窗口兼容。完成 v1→v2 升级后，前端获得新的稳定 CSRF token。

### 4. 过期模型拆分为 idle + absolute

- `AUTH_SESSION_LIFETIME_SECONDS`：idle timeout，默认 `43200`
- `AUTH_SESSION_ABSOLUTE_LIFETIME_SECONDS`：absolute timeout，默认 `86400`
- `AUTH_SESSION_REFRESH_THRESHOLD_SECONDS`：当剩余 idle 时间低于该阈值时，refresh 才有必要重签 cookie，默认 `1800`

login 签发时：

- `iat = now`
- `max_exp = now + absolute_lifetime`
- `exp = min(now + idle_lifetime, max_exp)`

refresh 时：

- 只允许延长 `exp`
- `exp' = min(now + idle_lifetime, max_exp)`
- 若 `exp' <= exp`，说明已经达到 absolute cap 或剩余 idle 仍高于阈值，不重签 cookie

### 5. v1 兼容窗口只保留自然过期生命周期

旧 v1 cookie 兼容到旧 `AUTH_SESSION_LIFETIME_SECONDS` 自然过期。实现上：

- v1 payload 首次通过 `/me` 或显式 refresh 进入认证路径时，可升级为 v2
- 升级后的 `max_exp` 固定为旧 v1 的 `exp`
- 这样兼容升级不会把旧 cookie 延长成新的绝对生命周期，超过旧过期时间后必须重新登录

## 数据流

### 登录

```text
POST /api/v1/auth/login
  -> 校验本地管理员口令
  -> 生成 v2 session (sid, iat, exp, max_exp, capabilities)
  -> 派生稳定 csrf_token
  -> Set-Cookie: HttpOnly session
  -> 返回 actor snapshot + csrf_token
```

### 读取当前用户

```text
GET /api/v1/me
  -> 解析 cookie
  -> 若为 v2: 返回 actor snapshot，不续期
  -> 若为 v1: 验证旧 payload，升级为 v2，回写 cookie，并返回新的稳定 csrf_token
```

### 显式 refresh

```text
POST /api/v1/auth/refresh
  -> 默认 protected route policy 验证 session
  -> CSRF guard 验证 X-CSRF-Token
  -> 解析 session
  -> 若为 v1: 升级为 v2（不突破旧 exp）
  -> 若为 v2 且剩余 idle <= threshold: 延长 exp，不突破 max_exp，并回写 cookie
  -> 否则仅返回当前 session 状态，不回写 cookie
```

## 失败路径

- 缺少/篡改/过期 cookie：401 `UNAUTHORIZED`
- `max_exp` 已过期或 payload 不一致：401 `UNAUTHORIZED`
- refresh 缺失或错误 CSRF：403 `FORBIDDEN`
- response/error 不得回显 cookie、signature、secret、csrf derivation material 或 traceback

## 迁移与后续演进

本 change 仍是无状态签名 cookie，但内部边界已经显式保留 `sid`、payload version 和 refresh 入口。未来如果切换到服务端 session store，可以在相同路由与 payload 形状上追加：

- `sid -> session record` lookup
- revoke / disable 标记
- 设备或会话列表
- 多用户主体映射

届时不需要再把 refresh 语义重新绑回 `/me` 或把 CSRF 重新设计一轮。
