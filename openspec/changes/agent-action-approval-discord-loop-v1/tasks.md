## 1. OpenSpec 与评审 Gate

- [x] 1.1 创建并校验本 change 的 proposal、design、spec 和 tasks，确保中文正文与英文 OpenSpec 语法通过 strict validate。
- [x] 1.2 提交 OpenSpec-only PR，PR 只包含 `agent-action-approval-discord-loop-v1` artifacts，不混入实现、依赖升级或格式化。
- [x] 1.3 等维护者明确评论“没问题”或批准后，再开始代码实现。

## 2. Agent action submission

- [x] 2.1 在 `packages/agent` 为 `submit_action_plan` 增加 action submission port / no-op fallback，保持工具 schema 通用且输出新增稳定字段。
- [x] 2.2 在 `apps/api` Agent Chat service 中注入 Event Bus backed action submission port，将 NVDA ActionPlan 映射为脱敏 `ActionRequest` 并发布 `action.requested`。
- [x] 2.3 增加 Agent/API 测试，覆盖成功发布、port 缺失、发布失败和敏感字段脱敏。

## 3. Worker production consumers

- [x] 3.1 扩展 worker composition root，订阅 `action.requested`、`approval.input_received`、`notification.requested`，并保持既有 source / analysis topic 分发。
- [x] 3.2 为 action / approval input handler 创建请求级 SQLAlchemy session、`SQLAlchemyApprovalRepository`、`ApprovalOrchestrationService` 和 `ApprovalEventPublisher`。
- [x] 3.3 为 notification handler 读取 `NOTIFICATION_DISPATCH_*` 配置，组装 `NotificationDispatchService`、`NotificationRequestedHandler` 和 `NotificationEventPublisher`。
- [x] 3.4 增加 worker tests，覆盖 action request 落库、approval input 完成、notification dispatch、disabled dispatcher 和未知 topic。

## 4. API notification ingress handoff

- [x] 4.1 在 API app/service composition 中默认组装 publisher 模式 `ApprovalNotificationHandoffAdapter`，使用 EventBusRuntime publisher 发布 `approval.input_received`。
- [x] 4.2 保留显式 no-op/disabled 降级，响应或日志不得声称审批完成。
- [x] 4.3 更新 API tests，覆盖真实 handoff 发布、无 runtime 降级、错误不泄密和 route/OpenAPI 不回归。
- [x] 4.4 更新 `apps/api/README.md` 和 `.env.example`，说明 ingress / dispatch 配置和生产闭环边界。

## 5. Web approval workbench real API

- [x] 5.1 新增 `features/approvals/api/approval-workbench.contracts.ts` 与 `approval-workbench.api.ts`，只负责 DTO、endpoint 和 mapper。
- [x] 5.2 更新 app runtime，挂载 runtime-scoped `approvalWorkbench` API。
- [x] 5.3 将 approval list/detail/overview queries 改为调用真实 API，并将 mock 限定为测试 fixture。
- [x] 5.4 将 approval action mutation 改为调用真实 approve/reject/request-reanalysis endpoint，成功后 invalidate list/detail/overview。
- [x] 5.5 更新 Web tests，覆盖 API mapper、query/mutation invalidation、错误状态和 mock 不再作为默认数据源。

## 6. Review gates

- [x] 6.1 后端 review：确认 router/API 不承载业务状态机，worker 是后台 consumer，core 不依赖 app 或具体 Discord 插件。
- [x] 6.2 Web review：确认 route 不发请求，feature API / queries / mutations / hooks / components 职责拆分符合 Web gate。
- [x] 6.3 安全 review：确认 Discord 文本 approve 仍是弱确认，Policy Gate 不可绕过，所有 payload 不含 secret、完整 prompt、私有策略或 broker credential。

## 7. Validation

- [x] 7.1 运行 `openspec validate agent-action-approval-discord-loop-v1 --type change --strict --json`。
- [x] 7.2 运行 agent/core/worker 相关 Python unit tests，至少覆盖新增 action submission 和 worker loop tests。
- [x] 7.3 运行 `cd apps/api && uv run python -m unittest discover -s src/tests` 或受影响 API 子集，并记录任何既有失败。
- [x] 7.4 运行 `bun run --cwd apps/web test:unit` 和 `bun run --cwd apps/web build`。
- [x] 7.5 运行本地 memory smoke：模拟 NVDA Agent Chat 触发 `action.requested`，worker 生成 approval，Web REST read model 能读取 approval，fake Discord 回流后 approval 进入安全终态；Kafka / 真实 Discord 作为部署环境验证项保留。
