## 1. Status 与审查门

- [ ] B0 OpenSpec-only review gate。输入：issue #272、proposal、design、spec。输出：只包含本 change artifacts 的 OpenSpec-only PR。写入边界：`openspec/changes/approval-persistence-api-v1/**`。依赖：无。验证：`openspec validate approval-persistence-api-v1 --type change --strict --json`。实现代码必须等维护者明确评论“没问题”或批准后再开始。
- [ ] B1 契约与权限基线确认。输入：design Decisions 3/5、spec capability requirement、当前 `apps/api` auth capability。输出：实现前锁定 `approval.read` 新增、actions 复用 `approval.approve`、`approval.amend` 不进入本轮。写入边界：实现阶段的 `apps/api/src/quantagent/api/auth/*` 和 API tests。依赖：B0 review 通过。验证：auth capability unit/API tests。

## 2. Blocking Serial Path

- [ ] B2 持久化 schema 蓝图落地。输入：design Decision 2、spec append-only requirements。输出：Approval ORM、Alembic migration、索引、唯一约束、record id / created_at / nullable input_id / latest decision 排序策略。写入边界：`packages/core/src/quantagent/core/db/models/*`、`packages/core/alembic/versions/*`。依赖：B1。验证：migration import、upgrade/downgrade 可执行时验证。
- [ ] B3 Core repository contract 稳定。输入：B2 schema、现有 `ApprovalRepository` protocol。输出：生产最小 repository 方法、SQLAlchemy repository、in-memory repository 兼容调整。写入边界：`packages/core/src/quantagent/core/approval/repository.py`、`packages/core/src/quantagent/core/db/repositories/*`。依赖：B2。验证：repository tests 覆盖 CRUD、latest decision、list/detail 查询和重复 input id。
- [ ] B4 Core action transaction 边界稳定。输入：B3 repository、现有 evaluator / Policy Gate / service。输出：action 写入同事务完成 input、evaluation、decision、approval 当前状态和 audit record；终态幂等和并发保护在锁内生效。写入边界：`packages/core/src/quantagent/core/approval/*`。依赖：B3。验证：approval orchestration tests 覆盖 approve/reject/request_reanalysis、terminal ignored、Policy Gate unavailable、并发冲突。

## 3. Parallel Work After B2

- [ ] P1 Core read model slice。输入：B2 schema、design list/detail 字段。输出：approval query service / read model，提供 summary、detail、history、latest decision、allowed actions、audit refs。写入边界：`packages/core/src/quantagent/core/approval/query_service.py`、`api_models.py` 或等价 core-only 模块。依赖：B2。并行条件：不修改 API router，不修改 action transaction。验证：query service tests。
- [ ] P2 API DTO 与 router skeleton slice。输入：B1 权限决策、design REST contract、spec envelope requirements。输出：API schemas、service/provider seam、protected router、v1 registration、OpenAPI response_model。写入边界：`apps/api/src/quantagent/api/schemas/approvals.py`、`services/approval_api.py`、`routers/v1/approvals.py`、`routers/v1/register.py`。依赖：B1；真正接通 DB action 依赖 B4。并行条件：只消费已锁定 DTO/权限契约。验证：OpenAPI schema tests 可先覆盖 route shape。
- [ ] P3 文档与脱敏策略 slice。输入：design non-goals、spec redaction requirements。输出：approval README / API README 更新，脱敏字段与非目标说明。写入边界：`packages/core/src/quantagent/core/approval/README.md`、`apps/api/README.md`。依赖：B1。并行条件：不修改运行时代码。验证：人工 review 与 PR 说明。

## 4. Merge / Integration Nodes

- [ ] M1 Core + API 集成。输入：B4 action service、P1 read model、P2 API skeleton。输出：list/detail/actions 全部通过请求级 Session 访问 core service/repository，router 不直接操作 ORM，不承载状态机。写入边界：`apps/api/src/quantagent/api/services/approval_api.py`、`routers/v1/approvals.py`、必要 core exports。依赖：B4、P1、P2。验证：API runtime tests 覆盖 200/400/403/404/409 和 request id。
- [ ] M2 契约漂移检查。输入：M1 集成结果、design/spec。输出：确认 path action 到 `ApprovalInput.structured_payload.intent` 映射一致，body intent 冲突返回 400，`request-reanalysis` 不触发 AgentRuntime/worker/scheduler。写入边界：测试与必要小修。依赖：M1。验证：API + core tests。

## 5. Review Checkpoints

- [ ] R1 持久化 review checkpoint。输入：B2/B3 diff。输出：确认 ORM/domain/API DTO/audit payload/event payload 分层，append-only records 可排序可回放，repository 不承载业务规则。依赖：B3。验证：对照 `core-and-plugin-architecture-gate.md`。
- [ ] R2 API boundary review checkpoint。输入：P2/M1 diff。输出：确认 router 只做 HTTP 参数、DTO、DI、状态码、envelope 和错误映射，所有业务状态流转在 core。依赖：M1。验证：对照 `api-architecture-gate.md`。
- [ ] R3 Risk boundary review checkpoint。输入：M2 diff。输出：确认 approve 不被描述为真实交易成功，Policy Gate 不可绕过，敏感字段不进入响应、日志、audit 明文。依赖：M2。验证：安全/脱敏测试与 PR review notes。

## 6. Validation Nodes

- [ ] V1 OpenSpec validation。输入：OpenSpec artifacts。输出：strict validate 通过。依赖：每次 artifacts 修改后。命令：`openspec validate approval-persistence-api-v1 --type change --strict --json`。
- [ ] V2 Core validation。输入：B2/B3/B4/P1。输出：core approval persistence/orchestration tests 通过。依赖：B4、P1。命令：`uv run python -m unittest packages/core/tests/test_approval_persistence.py`、`uv run python -m unittest packages/core/tests/test_approval_orchestration.py`。
- [ ] V3 API validation。输入：M1/M2。输出：API runtime 和 OpenAPI tests 通过。依赖：M2。命令：`cd apps/api && uv run python -m unittest discover -s src/tests`。
- [ ] V4 Migration validation。输入：B2 migration。输出：数据库可用时 upgrade/downgrade 验证通过；不可用时 PR 明确原因。依赖：B2。命令：`uv run quantagent-db upgrade`、`uv run quantagent-db downgrade -1`。
- [ ] V5 PR readiness。输入：R1/R2/R3/V1/V2/V3/V4。输出：实现 PR 说明链接 issue #272 和 OpenSpec change，列出依据、改动、验证、未验证风险和 deferred items。依赖：所有 review / validation nodes。

## 7. Multi-Agent Plan

- [ ] MA1 可选并行：在 B2/B1 稳定后，可把 P1 core read model、P2 API skeleton、P3 docs 分给不同执行者；三者写入边界不重叠，统一由 M1/M2 合并。
- [ ] MA2 不建议并行：B2/B3/B4 必须单 owner 串行推进，因为 schema、repository protocol、transaction/idempotency 互相依赖；不能让多个执行者同时改 approval service/repository 核心状态机。
