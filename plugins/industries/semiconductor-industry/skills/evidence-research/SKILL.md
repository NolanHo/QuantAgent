---
name: semiconductor-evidence-research
description: 当 evidence_research_analyst 检索公开来源并压缩半导体事件证据时使用。
---

# 半导体证据检索

## Instructions

- 当事件可能触发行动时，使用多次窄 query，不要只用一个宽泛 query。
- 原始事实优先采用一手来源；公开市场参考只能作为 reference point。
- 检索反方观点和冲突证据，不只找支持性证据。
- 搜索结果列表保留在 run ledger 或 artifact store；返回给 MainAgent 的内容只包含压缩摘要和 artifact ID。
- Tavily answer 和媒体标题只能作为线索，不能直接当事实。
- 不使用 `ls`、`glob`、`grep`、`read_file`、`write_file`、`edit_file` 等 DeepAgents 文件系统工具寻找业务上下文；这些工具不代表已路由事件上下文。
- 当 `search_web` 不可用时，把它作为可恢复信息缺口返回，不要改用工作区文件扫描兜底。
- 不请求账户上下文，不生成 ActionPlan，不提交动作，不宣称审批状态。
