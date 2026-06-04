# 09. Agent 产物归属与协作边界

## 核心结论

MainAgent 不应该亲自完成所有分析细节，但 MVP 也不应该一开始拆出一堆专家 Agent。DeepAgents 已经提供 `write_todos`、`task`、workspace 和 skills，行业 MainAgent 应把自己定位为“总控 Planner + 最终合成 Executor”。

MVP 推荐形态：

```text
Industry MainAgent
  -> optional task: evidence_research_analyst
  -> evaluate_thesis
  -> build_action_plan
  -> submit_action_plan
```

也就是说，MVP 只固定一个可选 SubAgent：`evidence_research_analyst`。它解决 Tavily 检索、query 展开和证据压缩问题。行情反应、需求判断、供应链影响、风险挑战和交易计划草案先由 MainAgent prompt / 行业 skill / `evaluate_thesis` / `build_action_plan` 承接，不单独拆 Agent。

- MainAgent 负责理解路由输入、制定 run 计划、选择 SubAgent、收敛结论、决定是否进入行动提交。
- MVP SubAgent 只负责边界清晰的检索任务；更多专家 SubAgent 等真实瓶颈出现后再加。
- 工具负责访问外部世界、读取受控上下文、持久化有价值 artifact、触发受控动作。
- `submit_action_plan` 是唯一行动提交入口；通知、审批、Policy Gate、broker 和监控不直接暴露给 Agent。

## DeepAgents 协作约束

DeepAgents 的 SubAgent 是通过 `task` 创建的一次性执行单元。它适合隔离复杂任务，但不能依赖前一次 SubAgent 调用的记忆。

因此 MainAgent 调用 SubAgent 时必须给完整任务说明：

```text
task(
  agent="evidence_research_analyst",
  instruction="
    当前 run 绑定 NVDA 财报一手公告。
    目标：验证公告中的关键数字、查找公开对照材料、查找冲突或风险证据。
    可使用 get_run_context 和 search_web；最多 5 次检索。
    不要生成交易计划，不要读取账户。
    输出 EvidenceResearchReport，保存有价值证据板，并返回 artifact_id、safe_summary、gaps。
  "
)
```

自定义 SubAgent 不自动继承 MainAgent 的 tools / skills。行业包必须显式声明每个 SubAgent 的 tool profile 和 skills，避免“MainAgent 有什么，SubAgent 就有什么”的隐式假设。

## MainAgent 擅长什么

MainAgent 擅长：

- 读取 Router / Intake 交付的事件事实、路由上下文、行业 mapping 和 tool profile。
- 判断当前事件是否值得进入多 Agent 分析，还是只做轻量记录。
- 给 SubAgent 下发完整、可停止的任务说明。
- 对 SubAgent 报告做一致性检查，识别冲突、重复覆盖和信息缺口。
- 决定是否需要读取账户上下文。
- 决定是否调用 `evaluate_thesis`、`build_action_plan` 和 `submit_action_plan`。
- 产出最终 `IndustryAnalysis`，并保存与本 run 相关的 artifact 引用。

MVP 中 MainAgent 可以承担一部分专业合成，但不应该承担这些细节：

- 大量细粒度检索和 query 展开。
- 手写专业风险预算、仓位 sizing、止盈止损公式。
- 独立行情微结构判断。
- 账户隐私向 SubAgent 扩散。
- 绕过平台工具直接通知、审批、下单或创建监控。

## SubAgent 擅长什么

SubAgent 适合处理“边界窄、上下文干净、工具更专”的任务。但 MVP 只实现最有杠杆的 Research SubAgent，其他角色先不拆。

### MVP SubAgent

| SubAgent | 主要产物 | 适合工具 | 不做什么 |
| --- | --- | --- | --- |
| `evidence_research_analyst` | `EvidenceResearchReport`、`EvidenceBoard` | `get_run_context`、`search_web` | 不读账户、不生成交易计划 |

MVP 只有 Tavily 时，`evidence_research_analyst` 的价值足够明确：它可以把搜索策略、query 展开、来源分层、重复 URL 去重和证据压缩固化在自己的 prompt / skill 中，而不是让 MainAgent 的 prompt 变成搜索教程。

### 后续扩展候选

以下角色不是 MVP 必做项。只有当真实运行发现 MainAgent 在某个维度反复不稳定、上下文过大或需要专属工具时，再拆成 SubAgent。

| SubAgent | 主要产物 | 触发条件 |
| --- | --- | --- |
| `market_reaction_analyst` | `MarketReactionReport` | 已接入稳定行情工具，且市场反应判断反复影响交易质量 |
| `demand_analyst` | `DemandImpactReport` | 需求链条复杂到 MainAgent prompt 难以稳定覆盖 |
| `supply_chain_analyst` | `SupplyChainImpactReport` | 二阶供应链映射经常跨公司、产品和材料环节 |
| `risk_challenge_analyst` | `RiskChallengeReport` | 反方检查需要独立上下文或专属风险资料 |
| `trade_plan_analyst` | `RiskManagedTradePlanDraft` | `build_action_plan` 逻辑不足，需要更专业的组合风险规划 |

MVP 中：

- 市场反应：由 Research SubAgent 搜公开材料，或后续 `get_market_snapshot` 工具直接返回。
- 需求 / 供应链影响：由 MainAgent 结合半导体 skill 合成。
- 反方观点：由 MainAgent 明确写入草案，并交给 `evaluate_thesis` 检查。
- 交易计划：由 `build_action_plan` 生成结构化 ActionPlan，不额外创建 TradePlan SubAgent。

## 有价值产物与噪音产物

不是所有工具输出都应该在 Agent 间传递。传递对象越大，成本越高，错误越多。

### 应保存并可跨 Agent 引用

| 产物 | 生产者 | 传递方式 | 用途 |
| --- | --- | --- | --- |
| `RunContextSnapshot` | `get_run_context` | `context_id` + 摘要 | 当前事件、路由、mapping、tool profile |
| `EvidenceBoard` | Research SubAgent 或 MainAgent | `artifact_id` + `safe_summary` | 事实、对照、冲突、关系判断 |
| `SubAgentReport` | Research SubAgent | `artifact_id` + compact report | 检索判断和证据缺口 |
| `ThesisEvaluation` | `evaluate_thesis` | `evaluation_id` 或 `thesis_evaluation_artifact_id` | 评分、风险、重复覆盖判断 |
| `ActionPlan` | `build_action_plan` | `action_plan_id` 或 `action_plan_artifact_id` | 平台提交前的结构化行动计划 |
| `SubmitActionPlanResult` | `submit_action_plan` | `submission_id` | 审批、通知、broker、监控结果 |
| `IndustryAnalysis` | MainAgent | `industry_analysis_id` 或 `industry_analysis_artifact_id` | 行业 run 最终输出 |

### 只进 ledger / audit，不默认传递

- 原始搜索结果大列表。
- 重复 URL 命中。
- Tavily answer 原文。
- 中间 query 尝试。
- SubAgent scratch notes。
- 被截断的大正文。
- 失败工具调用的完整错误堆栈。

这些内容仍然要可审计，但下游 Agent 默认只拿压缩报告和 artifact id。需要深挖时，再通过受控 artifact 读取工具读取指定产物。

## Artifact 引用 Schema

后续实现可以把 Agent 间传递统一成小 envelope。文档用 Pydantic 风格表达，方便迁移到后端 schema。

```python
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


ArtifactKind = Literal[
    "run_context",
    "search_result",
    "evidence_board",
    "subagent_report",
    "thesis_evaluation",
    "action_plan",
    "industry_analysis",
    "submission_result",
]


class ArtifactRef(StrictModel):
    artifact_id: str = Field(description="当前 AgentRun 内可审计 artifact ID。")
    kind: ArtifactKind = Field(description="artifact 类型，用于权限检查和下游读取。")
    producer_id: str = Field(description="生产者 ID，例如 tool id、MainAgent id 或 SubAgent id。")
    safe_summary: str = Field(description="可放入 prompt / 日志的压缩摘要，不包含 secret 和完整推理链。")
    confidence_score: float | None = Field(default=None, ge=0, le=1, description="生产者对该产物的置信度。")
    created_from_ids: list[str] = Field(default_factory=list, description="上游 artifact / context / search id。")


class SubAgentTaskResult(StrictModel):
    subagent_id: str = Field(description="执行任务的 SubAgent ID。")
    status: Literal["completed", "degraded", "failed"] = Field(description="任务状态。")
    report_summary: str = Field(description="MainAgent 可直接阅读的压缩报告。")
    artifact_refs: list[ArtifactRef] = Field(default_factory=list, description="有价值产物引用。")
    key_findings: list[str] = Field(default_factory=list, description="关键发现。")
    counterpoints: list[str] = Field(default_factory=list, description="反方观点或冲突信息。")
    gaps: list[str] = Field(default_factory=list, description="缺失或未验证信息。")
    recommended_next_step: str | None = Field(default=None, description="给 MainAgent 的下一步建议，不代表最终决策。")
```

## SubAgent 报告 Schema

SubAgent 产物应尽量复用同一基类，不为财报、政策、库存或其他单一场景定制字段。MVP 只需要 `EvidenceResearchReport`；其他报告 schema 放在后续扩展，不阻塞第一版。

```python
class EvidenceRef(StrictModel):
    artifact_id: str = Field(description="证据或报告 artifact ID。")
    claim_ids: list[str] = Field(default_factory=list, description="可选 claim ID，用于引用 EvidenceBoard 中的具体陈述。")
    reason: str = Field(description="为什么该证据支持本报告。")


class BaseSubAgentReport(StrictModel):
    report_id: str = Field(description="报告 ID。")
    subagent_id: str = Field(description="生产报告的 SubAgent ID。")
    role: str = Field(description="角色名，例如 evidence_research_analyst。")
    summary: str = Field(description="MainAgent 可直接阅读的短摘要。")
    findings: list[str] = Field(default_factory=list, description="关键发现。")
    counterpoints: list[str] = Field(default_factory=list, description="反方观点。")
    gaps: list[str] = Field(default_factory=list, description="缺失或未验证信息。")
    risk_flags: list[str] = Field(default_factory=list, description="风险标签。")
    evidence_refs: list[EvidenceRef] = Field(default_factory=list, description="引用的证据 artifact 和 claim。")
    confidence_score: float = Field(ge=0, le=1, description="SubAgent 对报告的置信度。")
    metadata: dict[str, str] = Field(default_factory=dict, description="少量非敏感扩展字段；不能放大 JSON。")
    artifact_id: str | None = Field(default=None, description="保存为 run artifact 后的 ID。")


class EvidenceResearchReport(BaseSubAgentReport):
    search_ids: list[str] = Field(default_factory=list, description="本报告使用的搜索调用 ID；完整结果留在 search ledger。")
    evidence_board_artifact_id: str | None = Field(default=None, description="产出的 EvidenceBoard artifact ID。")
    source_quality_summary: str = Field(description="来源可靠性、时效性和冲突情况摘要。")
```

`MarketReactionReport`、`ImpactReport` 和 `RiskManagedTradePlanDraft` 是扩展候选，不在 MVP 写成代码式契约。需求、供应链和风险判断先进入 MainAgent 的 `IndustryAnalysis`，交易计划进入 `build_action_plan` 输出的 `ActionPlan`。只有真实实现发现这些报告字段长期稳定、且多个行业包复用时，再把它们提升为正式 schema。

## 英伟达财报样例中的产物归属

| 流程产物 | 应由谁产出 | 原因 |
| --- | --- | --- |
| run 计划 / todo | MainAgent | 只有 MainAgent 看全局目标、预算和停止条件 |
| 第一手财报事实摘要 | `get_run_context` + MainAgent 校验 | 事件事实已由 Source / Router 绑定，Main 只读取和确认 |
| 市场对照材料和冲突证据 | `evidence_research_analyst` | 需要多 query、来源分层和证据压缩，适合专门搜索 prompt |
| `EvidenceBoard` | Research SubAgent 产出，MainAgent 可补充关系判断 | 它是可复用证据产物，不应只是搜索工具返回 |
| 盘后反应和波动风险 | Research SubAgent 或 MainAgent | MVP 先用 Tavily 公开材料降级，不拆 Market SubAgent |
| AI GPU 需求影响 | MainAgent | 用半导体 skill 合成，后续再拆 Demand SubAgent |
| HBM / 先进封装 / 代工链二阶影响 | MainAgent | 用 mapping 和 skill 合成，后续再拆 SupplyChain SubAgent |
| 反方观点 | MainAgent + `evaluate_thesis` | 防止只围绕利好证据合成 |
| 账户、仓位、近期动作、通知 | MainAgent 调 `get_account_context` | 账户上下文敏感，默认不扩散给普通 SubAgent |
| 仓位大小、止盈止损、失效条件 | `build_action_plan` | MVP 不拆 TradePlan SubAgent，先用一个结构化工具收敛计划 |
| 最终 `ActionPlan` | `build_action_plan` | 结构化、可审计、可被 Policy Gate 消费 |
| 提交、通知、审批、dry-run、监控 | `submit_action_plan` | 外部行动必须走统一平台状态机 |
| 最终 `IndustryAnalysis` | MainAgent | MainAgent 对全 run 负责，引用全部关键 artifact |

## 传递规则

MVP 中 Research SubAgent 返回给 MainAgent 的内容应是：

```text
compact report
artifact_refs
key_findings
counterpoints
gaps
recommended_next_step
```

MainAgent 传给下游 SubAgent 或工具时应优先传：

```text
evidence_board_artifact_id
subagent_report_artifact_ids
thesis_evaluation_artifact_id
account_context_id
action_plan_artifact_id
safe_summary
```

不要传：

```text
完整搜索结果列表
完整账户对象
完整工具调用日志
SubAgent 的 scratch notes
大段正文
```

## 何时由 MainAgent 直接做

不是所有事件都需要 SubAgent。MainAgent 可以直接处理：

- 低优先级、明显无关或只需记录的事件。
- 单次 `get_run_context` 就能判断是重复报道的事件。
- 只需要一两次 `search_web` 验证来源的轻量事件。

但当事件满足任一条件时，应优先委派 SubAgent：

- 可能触发交易、减仓、平仓或监控变更。
- 涉及一手材料，需要补市场对照和冲突证据。
- 涉及多标的、多行业链条或二阶影响。
- 需要专业仓位、止盈止损和失效条件。
- 证据来源多且容易重复或互相矛盾。

这能保持 MainAgent prompt 精简，也让行业包开发者可以通过新增 SubAgent / skill 逐步增强能力，而不必重写通用 PlannerExecutor 框架。
