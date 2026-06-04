## ADDED Requirements

### Requirement: Approvals Workbench Is a Dedicated Approval Queue

系统 SHALL 将 `/approvals` 实现为独立审批工作台，用于集中处理 ApprovalRequest，而不是把审批动作散落在 Dashboard 或事件详情页。

#### Scenario: Workbench owns the queue workflow
- **WHEN** 已登录用户进入 `/approvals`
- **THEN** 页面展示待处理审批队列及其概览信息
- **AND** 用户可以在不离开审批上下文的前提下理解建议动作、风险、确认等级和到期策略
- **AND** Dashboard 只提供审批摘要和入口，不在首页内联 approve / reject

#### Scenario: Event detail stays as evidence review, not approval execution
- **WHEN** 用户从 `/events/:eventId` 进入审批相关流程
- **THEN** 事件详情只提供进入审批工作台或审批详情的入口
- **AND** 不在事件详情页直接完成高风险批准动作

### Requirement: Workbench Default Sorting Prioritizes AI Recommendation

审批工作台 SHALL 默认按 AI 推荐度最高优先排序，同时保留对即将过期项的清晰高亮信号。

#### Scenario: Default landing uses recommendation-first ordering
- **WHEN** 用户首次进入 `/approvals` 且未显式指定排序
- **THEN** 列表按推荐度从高到低展示审批项
- **AND** 推荐度相近时优先展示更接近到期时间的审批项
- **AND** 用户无需先切换到其他排序才能看到高优先级审批

#### Scenario: Alternate sort modes remain available
- **WHEN** 用户切换排序方式
- **THEN** 页面至少支持“即将过期优先”“风险最高优先”“最新创建优先”
- **AND** 再次回到默认排序时恢复推荐度优先语义

### Requirement: Approval List Fields Must Support Queue Decisions

审批工作台 SHALL 在列表层提供足够的决策字段，避免用户只能盲目进入详情页。

#### Scenario: List item exposes minimum decision context
- **WHEN** 页面渲染一条审批项
- **THEN** 该项至少展示关联事件、建议动作、推荐度、风险方向、风险等级、确认等级、到期策略和触发摘要
- **AND** 该项提供进入审批详情与关联事件详情的稳定入口
- **AND** 列表文案不将批准描述成已下单、已成交或已真实执行

#### Scenario: Queue overview summarizes operator pressure
- **WHEN** 页面渲染审批工作台首屏
- **THEN** 首屏提供待处理数量、即将过期数量、高风险数量与强确认数量摘要
- **AND** 这些摘要用于帮助用户理解队列压力，而不是替代列表详情

### Requirement: Row Actions Preserve Human-Confirmation Semantics

审批工作台 SHALL 支持逐条处理 `approve`、`reject` 与 `request_reanalysis`，并保持“人工确认”语义。

#### Scenario: Row actions remain explicitly human confirmation
- **WHEN** 用户触发单条审批动作
- **THEN** 页面反馈明确说明该动作代表人工确认、拒绝或要求重分析
- **AND** 不把反馈写成真实执行已经完成
- **AND** 对高风险项保留额外确认提示

#### Scenario: Reanalysis requires a short reason
- **WHEN** 用户触发 `request_reanalysis`
- **THEN** 页面要求用户填写简短原因
- **AND** 该原因用于说明证据缺口、时效变化或其他需要重新分析的原因
- **AND** 用户不能在没有原因的情况下直接提交该动作

### Requirement: Batch Actions Are Restricted and Conservative

审批工作台 SHALL 明确受限批量边界，但在首版后端 contract 未落地前，不交付可执行的真实批量动作。

#### Scenario: Batch panel explains future eligibility rules
- **WHEN** 用户在工作台中勾选多个审批项
- **THEN** 页面说明只有相同风险方向、相同确认等级、未过期且非 `manual_only` 的审批项未来才可能组成同一批次
- **AND** 页面明确标识不可批量处理项及其原因
- **AND** 即将进入自动过期处理的审批项默认不进入可批量集合

#### Scenario: Batch actions remain disabled before contract review
- **WHEN** 用户看到批量处理区
- **THEN** 批量 approve / reject / request_reanalysis 按钮保持 disabled 或仅作说明态展示
- **AND** 页面不通过 mock mutation 伪造批量成功结果
- **AND** 文案继续强调批准不代表真实执行完成

### Requirement: Approval States and Failures Must Be Visible

审批工作台 SHALL 覆盖空态、权限不足、部分失败、实时降级和已过期状态。

#### Scenario: Queue empty state remains actionable
- **WHEN** 当前筛选结果没有任何审批项
- **THEN** 页面展示明确空态
- **AND** 空态提供返回 Dashboard 或事件中心的入口

#### Scenario: Partial failure stays localized
- **WHEN** 单条动作或批量动作中的部分项失败
- **THEN** 失败反馈只附着在受影响审批项或批量结果区
- **AND** 不阻断其他审批项继续处理
- **AND** 失败反馈可展示 `request_id` 或 `trace_id` 占位

#### Scenario: Expired and degraded states remain understandable
- **WHEN** 审批已过期或实时提醒不可用
- **THEN** 页面禁用不再允许的动作并说明过期策略或状态可能延迟
- **AND** 用户仍可通过 REST 快照或手动刷新继续理解当前审批状态

### Requirement: Workbench Implementation Keeps Route and Feature Boundaries

`apps/web` 中的审批工作台实现 SHALL 遵守 route 与 feature 分层，不继续堆在主链路占位页中。

#### Scenario: Route files only own search and page composition
- **WHEN** 实现 `src/routes/_app/(workspace)/approvals/index.tsx`
- **THEN** route 文件只负责 search 默认值、search 解析和页面装配
- **AND** 业务筛选、排序、批量选择和动作反馈进入 `features/approvals/` 的 hooks 与 components

#### Scenario: Mock-driven first version preserves future API swap boundary
- **WHEN** 后端审批 API contract 尚未落地
- **THEN** 审批工作台可以使用 `features/approvals/mock/` 下的受控 mock 数据驱动首版交互
- **AND** mock 只模拟审批请求状态变化，不模拟真实执行成功
- **AND** 后续接入 query / mutation 时无需改写 route 与组件职责边界

### Requirement: Approval Detail Preserves Core Approval Boundaries

审批详情 SHALL 承担单条 ApprovalRequest 的完整复核页，并把动作边界、回跳入口和审计语义固定下来。

#### Scenario: Detail page exposes complete review context
- **WHEN** 用户进入 `/approvals/:approvalId`
- **THEN** 页面展示事件摘要、建议动作、分析置信度、事件可信度、风险方向、确认等级、到期策略和触发摘要
- **AND** 页面提供返回审批工作台、关联事件、Runtime 摘要或审计入口的稳定跳转
- **AND** 页面文案继续强调批准只代表人工确认

#### Scenario: Detail page distinguishes interactive and deferred actions
- **WHEN** 页面渲染动作区
- **THEN** `approve`、`reject`、`request_reanalysis` 可以作为首版受控动作出现
- **AND** `amend` 只作为需要更细 contract 与审计 diff 的后续边界说明，不伪造本地成功结果
- **AND** `manual_only` 或需要 `strong_confirm` 的审批不会被弱确认入口替代

### Requirement: Approval Link Stays a Limited Link-Confirm Entry

一次性授权页 SHALL 只承接 `link_confirm` 语义下的最小必要确认上下文，不绕过核心 Approval 边界。

#### Scenario: Link page only reveals minimal context
- **WHEN** 用户打开 `/approval-link/:token`
- **THEN** 页面只展示最小必要的审批摘要、风险方向、确认等级、到期策略和 token 状态
- **AND** 页面不展示完整后台详情、敏感配置或完整 token 原文
- **AND** 页面不长期保存 token

#### Scenario: Link page rejects stronger confirmation levels
- **WHEN** 当前审批为 `manual_only` 或需要 `strong_confirm`
- **THEN** 一次性授权页不提供可提交的 approve / reject 入口
- **AND** 页面明确说明需要回到后台详情完成强确认
