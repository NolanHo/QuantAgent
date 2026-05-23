# API Client 与全局错误治理 Specification

## Purpose

定义 `apps/web/src/shared/api/` 的统一 envelope 解包、鉴权注入、401/403 收口、错误元数据保留与请求生命周期治理边界。

## Requirements

### Requirement: Shared API Module

`apps/web/src/shared/api/` SHALL 提供统一的 API client 模块。

#### Scenario: API module exports are available

- **WHEN** 开发者导入 `@/shared/api`
- **THEN** 可以获得 `apiClient`、`createApiClient`、`ApiError`、`ErrorRegistry` 和相关类型

### Requirement: Strongly Typed Envelope Handling

前端 SHALL 支持后端 `code/data/msg` envelope 协议。

#### Scenario: Successful response auto-unpacks business data

- **WHEN** 调用 `apiClient.get<User>("/me")`
- **AND** 响应体为 `{ code: 0, data: { id: 1 }, msg: "ok" }`
- **THEN** 返回值为 `User`

#### Scenario: Full envelope remains available

- **WHEN** 调用 `apiClient.requestEnvelope<User>("/me")`
- **AND** 响应体为 `{ code: 0, data: { id: 1 }, msg: "ok" }`
- **THEN** 返回完整 envelope

#### Scenario: Business failure becomes ApiError

- **WHEN** 响应体为 `{ code: 40001, data: null, msg: "参数错误" }`
- **THEN** client 抛出 `ApiError`
- **AND** 保留 `code`、`msg`、`request_id`、`trace_id`

### Requirement: Authentication Injection

API client SHALL 以 Cookie Session 为主鉴权路径，并集中处理前端 auth bootstrap 相关 header 注入。

#### Scenario: Cookie-session requests keep credentials enabled

- **WHEN** 前端通过默认 shared API client 发起请求
- **THEN** 请求保留 `withCredentials=true`
- **AND** 浏览器可自动携带 HttpOnly session cookie

#### Scenario: CSRF header is injected from auth bootstrap state

- **WHEN** 当前前端 auth bootstrap 状态中存在 `csrf_token`
- **AND** 调用受保护写请求或 logout
- **THEN** shared API client 统一注入 `X-CSRF-Token`
- **AND** 页面组件不需要手写该 header

#### Scenario: Bearer token injection is not the primary auth path

- **WHEN** 实现本地单用户 Cookie Session 登录接入
- **THEN** shared API client 不要求从本地存储读取 Bearer token 才能完成本轮登录态管理
- **AND** 登录页、`GET /api/v1/me` bootstrap、`POST /api/v1/auth/logout` 和受保护写请求都不得以 Bearer token 作为成立前提

#### Scenario: Compatibility extension does not redefine the main auth path

- **WHEN** 实现仍临时保留 Bearer token 或 refresh 相关扩展点
- **THEN** 这些扩展点只能被视为兼容保留
- **AND** 不得把本轮主鉴权路径从 Cookie Session + `X-CSRF-Token` 改回 token 驱动

### Requirement: 401 Silent Refresh

API client SHALL 集中处理 401 场景，但在本地单用户 Cookie Session 登录接入中，401 的默认收口是未登录态恢复，而不是前端 refresh token 流程。

#### Scenario: Unauthorized error calls the centralized unauthorized handler

- **WHEN** 受保护请求返回 401
- **THEN** shared API client 调用统一 `onUnauthorized`
- **AND** 调用方可以通过该入口清理前端 auth bootstrap 状态

#### Scenario: Cookie-session login flow does not require refresh token replay

- **WHEN** 本轮前端消费 `/auth/login`、`/auth/logout` 与 `/me`
- **THEN** shared API client 不依赖 refresh token endpoint、cookie refresh 或请求重放才能完成既定登录流程

#### Scenario: Unauthorized handling remains centralized

- **WHEN** 页面或 feature 模块调用 shared API client
- **THEN** 401 行为通过统一入口处理
- **AND** 页面组件不各自维护跳转登录页和状态清理逻辑

#### Scenario: Sensitive auth failures do not leak values

- **WHEN** shared API client 处理 401、403 或 CSRF 相关失败
- **THEN** 前端错误对象、共享状态和日志中不暴露 session cookie、cookie value、password、password hash、signing secret、真实 token 或私有策略原文

### Requirement: Error Governance

前端 SHALL 统一封装 API 失败语义，并为 capability guard 与 403 权限不足 UX 提供稳定的错误元数据。

#### Scenario: ApiError preserves metadata

- **WHEN** 抛出 `ApiError`
- **THEN** 至少包含 `code`、`msg`、`status`
- **AND** 如可用则包含 `requestId` 和 `traceId`

#### Scenario: Error registry maps business codes to UI behavior

- **WHEN** 查询 `ErrorRegistry`
- **THEN** 可获得 `toast | modal | silent | redirect` 等默认 UI 行为
- **AND** registry 本身不直接渲染 UI

#### Scenario: Global error hook can observe failures

- **WHEN** client 产生 `ApiError`
- **THEN** 若配置了 `onError`，该 hook 会收到统一错误对象

#### Scenario: Forbidden error remains distinguishable from generic network failures

- **WHEN** shared API client 收到 403 响应
- **THEN** 前端错误对象保留权限不足语义与元数据
- **AND** capability guard 或页面 UI 可以基于该对象渲染统一 forbidden 体验
- **AND** 403 不会被伪装成普通网络错误

#### Scenario: Forbidden diagnostics stay available without leaking secrets

- **WHEN** 403 响应附带 `request_id` 或 `trace_id`
- **THEN** shared API client SHALL 把这些字段保留到 `ApiError`
- **AND** 前端错误对象、共享状态和日志中仍不暴露 session cookie、cookie value、password、password hash、signing secret、真实 token 或私有策略原文

### Requirement: Lifecycle And Request Deduplication

API client SHALL 支持组件生命周期安全与基础请求去重。

#### Scenario: AbortSignal is forwarded

- **WHEN** 调用方传入 `signal`
- **THEN** client 将该 `signal` 透传给底层请求

#### Scenario: Duplicate GET requests reuse inflight promise

- **WHEN** 相同 GET 请求在前一个请求完成前再次发起
- **THEN** client 复用同一个 inflight promise

### Requirement: Trace Header Extension Point

请求链路追踪 SHALL 保留实现扩展点。

#### Scenario: Trace injection todo is preserved

- **WHEN** 开发者检查 request interceptor
- **THEN** 能看到 `X-Request-Id` / `X-Trace-Id` 的 TODO 注释
- **AND** 当前不会生成真实 trace id

### Requirement: Verification

本 change 完成后 SHALL 通过前端单元测试、lint 和构建验证。

#### Scenario: Required commands pass

- **WHEN** 运行 `bun --cwd apps/web run test:unit`
- **THEN** API client 相关测试通过

- **WHEN** 运行 `bun run lint`
- **THEN** 静态检查通过

- **WHEN** 运行 `bun run build --filter=web`
- **THEN** 前端构建通过
