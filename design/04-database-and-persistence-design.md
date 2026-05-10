# 04. 数据库与持久化设计

## 文档状态

**状态**：草案 v0.1  
**范围**：数据库模型边界、持久化对象、迁移策略、审计数据、敏感配置  
**当前约定**：数据库使用 PostgreSQL，ORM 使用 SQLAlchemy 2.x + Alembic  
**不包含**：字段级 DDL、完整索引设计、向量检索、embedding 模型选型、生产归档策略

## 设计原则

- 数据库设计服务运行时闭环，不追求一次性覆盖所有未来能力。
- 关键状态必须可回放，尤其是 Event、插件状态、Decision、Approval、Audit。
- 结构化字段优先，JSONB 用于扩展和原始载荷，不把所有数据都塞进 JSONB。
- ORM model 不直接作为 API DTO 或插件 DTO 使用。
- 插件不能直接持有数据库 session，只能通过核心提供的 repository / storage port 访问数据。

## 问题 1：Event 表如何设计？

问题：Event 表是否采用单表加 JSONB，还是拆分原始事件、标准事件、状态流转表？

### 方案 A：单表 + JSONB

```text
events
  id
  source
  title
  content
  status
  payload_json
  metadata_json
```

优点：

- 实现最快。
- 适合原型阶段快速落地。
- 适配不同 source 插件的非标准字段。

缺点：

- 状态流转难审计。
- 原始事件和标准事件混在一起，后续排查困难。
- 查询和索引会逐渐变复杂。

### 方案 B：拆分 RawEvent、Event、EventStateTransition

```text
raw_events
events
event_state_transitions
```

优点：

- 原始输入、标准事件、状态流转边界清楚。
- 方便回放和排查 source 插件问题。
- 状态变化可以 append-only 记录，审计更可靠。

缺点：

- 初版表更多。
- 需要定义标准化流程。

### 方案 C：Event 主表 + 状态流转表，暂不拆 RawEvent

```text
events
event_state_transitions
```

优点：

- 比单表更可审计。
- 比三表更简单。
- 初版实现成本适中。

缺点：

- 原始事件和标准事件仍然混合。
- 后续接入复杂 source 时可能需要再拆 raw_events。

### 推荐

推荐采用 **方案 B：RawEvent + Event + EventStateTransition**。

原因：

- 当前项目的 source 插件会很多，RSS、URL、X API、Playwright 的原始载荷差异很大。
- 事件驱动系统最怕后续无法追踪“原始信息如何变成标准事件”。
- 状态流转是核心审计能力，不能只存在 Event 当前状态字段里。
- 虽然初版多两张表，但能显著降低后续重构成本。

## 问题 2：插件信息用文件存，还是数据库存？

问题：系统运行起来后，需要知道安装了哪些插件、每个插件是什么版本、当前是否启用、配置是什么。这里要区分两类信息：

- 插件包自带的静态元信息：例如 `plugin.yaml`、默认配置 schema、插件代码。
- 系统运行时状态：例如是否安装、是否启用、当前配置、安装来源、当前版本、最后一次错误。

### 方案 A：全部用文件存

```text
plugins/foo/plugin.yaml
runtime/plugins/bar/plugin.yaml
runtime/config/plugins/foo.yaml
```

优点：

- 简单直观。
- 便于手工编辑和备份。
- 很适合单机开发阶段。

缺点：

- 系统启动后要扫描文件才能知道状态。
- 多用户后台管理时，配置修改、启停、热重载很难保证一致性。
- 审计和历史版本追踪弱。
- 多容器或未来微服务化时，文件状态同步会变复杂。

适合场景：

- 纯本地工具。
- 没有后台插件管理。
- 不需要记录插件安装、启停、配置变更历史。

### 方案 B：全部用数据库存

```text
plugin_records
plugin_versions
plugin_configs
```

优点：

- 系统运行状态查询稳定。
- 后台管理、热重载、启停、审计更容易。
- 多容器共享状态更自然。

缺点：

- 插件代码和 manifest 仍然天然存在于文件系统或包仓库里，强行全部入库不自然。
- 插件安装和代码加载仍需要文件路径或包路径。
- 初版会增加实现复杂度。

适合场景：

- 插件市场。
- 多用户后台管理。
- 多实例部署。
- 强审计和强状态管理。

### 方案 C：文件作为插件包来源，数据库作为运行时状态真源

```text
plugin.yaml                 # 插件包自带，描述插件是什么
config.schema.json          # 插件包自带，描述配置长什么样

plugin_records              # 系统记录装了什么
plugin_versions             # 系统记录当前版本和历史版本
plugin_configs              # 系统记录当前配置和配置历史
audit_logs                  # 系统记录谁改了什么
```

优点：

- 符合插件系统的自然模型：插件包在文件/仓库中，运行状态在数据库中。
- 后台管理可以稳定查询数据库，不需要每次扫目录。
- 支持热重载、安装、卸载、启停、配置变更审计。
- 未来多容器时，数据库可以作为共享状态中心。

缺点：

- 需要处理文件和数据库的一致性。
- 安装流程要明确：先解析文件，再写入数据库。

适合场景：

- 当前项目。
- 官方插件 + 第三方插件 + 私有插件混合。
- 需要后台管理插件。
- 后续可能多容器和微服务化。

### 推荐

推荐采用 **方案 C：文件作为插件包来源，数据库作为运行时状态真源**。

具体规则：

- `plugin.yaml`、插件代码、默认 schema 放在文件系统或插件包里。
- 安装插件时，Registry 读取 `plugin.yaml`，校验后写入数据库。
- 系统运行时以数据库中的 `plugin_records`、`plugin_versions`、`plugin_configs` 判断插件状态。
- 文件系统是插件代码来源，不是运行状态真源。
- 数据库记录当前启用版本、配置、安装来源、安装路径、状态和最后错误。

原因：

- 只用文件会让后台管理和审计很弱。
- 只用数据库又不符合 Python 插件代码加载的现实。
- 混合方案是插件系统常见且实用的做法：包元信息随代码走，运行状态由系统管理。

## 问题 3：分析结果完整入库还是保存摘要？

问题：IndustryAnalysis、ScoredAnalysis、DecisionResult 是否完整入库，还是只保存摘要？

### 方案 A：完整入库

优点：

- 回放能力最强。
- 方便调试 Agent 输出。
- 便于后续评估和回测。

缺点：

- 数据量可能很大。
- 可能存入过多模型输出和敏感推理内容。
- schema 变化会影响存储结构。

### 方案 B：只保存摘要

优点：

- 数据量小。
- UI 和审计够用。
- 隐私和安全压力较低。

缺点：

- 无法完整复盘 Agent 行为。
- 后续评估和回测数据不足。
- 出问题时很难定位是哪一步推理异常。

### 方案 C：结构化摘要 + 原始载荷 JSONB 可选保存

```text
industry_analyses
scored_analyses
decision_results
```

每张表保存核心结构化字段，同时保留 `payload_json` 或 `raw_output_json`。

优点：

- UI、查询、审计依赖结构化字段。
- 调试和回放可以使用 JSONB。
- 允许后续逐步结构化更多字段。

缺点：

- 需要定义哪些字段是核心字段。
- 需要控制 JSONB 中不要保存不该保存的敏感内容。

### 推荐

推荐采用 **方案 C：结构化摘要 + JSONB 原始载荷**。

原因：

- Agent 输出在早期一定会频繁变化，完全结构化会拖慢迭代。
- 只保存摘要又会损失排查和评估能力。
- PostgreSQL JSONB 很适合承载演进中的半结构化分析结果。
- 核心字段仍要结构化，例如 `confidence_score`、`risk_flags`、`recommended_actions`、`decision_action`。

## 问题 4：审计日志是否使用 append-only 表？

问题：审计日志是否使用 append-only 表？

### 方案 A：普通日志表，可更新

优点：

- 实现简单。
- 可以修正错误记录。

缺点：

- 审计可信度弱。
- 很难证明某个操作历史没有被覆盖。

### 方案 B：append-only audit 表

优点：

- 审计可信度高。
- 适合记录插件安装、配置变更、用户确认、状态变化。
- 与事件驱动系统天然匹配。

缺点：

- 数据会持续增长。
- 查询当前状态需要依赖主表，不能只看 audit 表。

### 方案 C：主表保存当前状态，audit 表 append-only 保存变化

优点：

- 当前状态查询简单。
- 历史变化可追踪。
- 工程上最平衡。

缺点：

- 需要保证写主表和写 audit 的一致性。

### 推荐

推荐采用 **方案 C：主表当前状态 + append-only audit 表**。

原因：

- 系统需要后台管理体验，查询当前插件状态、事件状态要快。
- 同时交易建议、人工确认、插件配置变更必须可审计。
- 只用 append-only 会增加所有查询复杂度；只用可更新主表又不够可信。

## 问题 5：插件配置中的敏感字段如何处理？

问题：插件配置中的敏感字段如何处理，是否需要加密或引用外部 secret？

### 方案 A：配置明文入库

优点：

- 实现最简单。
- 开发调试方便。

缺点：

- 不适合 API key、交易密钥、私有策略参数。
- 日志和备份风险高。

### 方案 B：敏感字段加密后入库

优点：

- 比明文安全。
- 仍然可以由系统统一管理配置。

缺点：

- 需要密钥管理。
- 如果密钥也在同一环境，安全性有限。
- 需要处理轮换和解密失败。

### 方案 C：数据库只保存 secret reference

```text
config_json:
  api_key_ref: secret://x_api/main
```

优点：

- 数据库不保存真实密钥。
- 后续可以接入 Secret Manager。
- 适合私有插件和交易执行插件。

缺点：

- 初版需要实现本地 secret store 或约定环境变量引用。
- 配置体验稍复杂。

### 推荐

推荐采用 **方案 C 为主，方案 B 为辅**。

初版策略：

- 数据库默认只保存 secret reference。
- 本地开发可以使用 `runtime/config/secrets.*` 或环境变量作为 secret 来源。
- 确实需要入库的敏感字段必须加密。
- 插件 schema 需要能标记字段是否敏感。

原因：

- 项目明确存在私有交易策略、爬虫关键词、交易 API key 等敏感内容。
- 未来可能接入外部 Secret Manager，现在先用 reference 模式更容易演进。
- 不建议把“加密后入库”作为唯一方案，因为密钥管理会成为新的复杂点。

## 问题 6：向量检索和 embedding 是否进入初版？

问题：系统未来可能需要相似事件检索、历史案例召回和 RAG，但这些能力是否应该进入当前数据库主线？

### 方案 A：初版直接引入向量检索

优点：

- 后续相似事件检索起步快。
- 可以较早验证语义检索体验。

缺点：

- 会引入 embedding 模型、生成时机、重算策略等额外复杂度。
- 当前主线是事件采集、插件系统、Agent 分析、人工确认，不依赖向量检索。
- 容易让数据库设计过早绑定尚未验证的 AI 检索需求。

### 方案 B：完全移除向量能力，不再考虑

优点：

- 当前设计最简单。
- 避免团队分心。

缺点：

- 后续如果要做历史相似事件和 RAG，可能需要补设计。

### 方案 C：初版不实现，只保留后续可选扩展

优点：

- 不影响当前主线。
- 保留未来扩展空间。
- 避免过早选择 embedding 模型和向量表结构。

缺点：

- 后续做相似事件检索时需要单独补设计。

### 推荐

推荐采用 **方案 C：初版不实现，只保留后续可选扩展**。

原因：

- 向量检索不是当前系统主线。
- 当前优先级应该是事件管线、插件 registry、配置管理、审计、Decision 和人工确认。
- 等系统积累足够事件和分析数据后，再判断是否需要向量检索、embedding 和相似事件能力。

初版结论：

- 不在技术栈中列向量数据库能力。
- 不创建 embedding 表。
- 不把相似事件检索作为 PRD 主线能力。
- 后续如需要，单独建立向量检索设计文档。

## 问题 7：Alembic migration 目录放在哪里？

问题：Alembic migration 目录放在 `apps/api` 还是 `packages/quant/core`？

### 方案 A：放在 `apps/api`

优点：

- FastAPI 项目常见做法。
- API 启动和迁移关系清楚。

缺点：

- worker、scheduler 也依赖数据库，放在 api 会让数据库看起来属于 API。
- 后续拆服务时不自然。

### 方案 B：放在 `packages/quant/core`

优点：

- 数据模型属于核心领域，不属于某个 app。
- api、worker、scheduler 都能共享。
- 适合 monorepo 和未来多入口。

缺点：

- Alembic 配置需要处理 package 路径。
- 对 Python 新手稍复杂。

### 方案 C：放在 `infra/migrations`

优点：

- 基础设施视角清晰。
- 与 Docker 部署和数据库生命周期接近。

缺点：

- 容易和 ORM model 分离过远。
- 开发体验一般。

### 推荐

推荐采用 **方案 B：放在 `packages/quant/core`**。

原因：

- 数据模型是核心领域的一部分，不应该归属于 `apps/api`。
- `apps/worker` 和未来 scheduler 同样需要数据库结构。
- 后续如果拆服务，core migration 仍然是共享基础。

建议结构：

```text
packages/quant/core/
  src/quantagent_core/
    db/
      models/
      repositories/
  migrations/
    env.py
    versions/
```

## 问题 8：是否需要软删除、数据保留周期和归档策略？

问题：是否需要软删除、数据保留周期和归档策略？

### 方案 A：初版不做软删除和归档

优点：

- 实现简单。
- 开发快。

缺点：

- 插件、配置、事件被删除后难以审计。
- 数据增长后再补归档会麻烦。

### 方案 B：所有表都做软删除

优点：

- 删除安全。
- 恢复容易。

缺点：

- 查询条件复杂。
- 对 audit、state transition 这类 append-only 表没有意义。

### 方案 C：关键主表软删除，审计和状态流转 append-only，归档策略暂缓

优点：

- 平衡安全和复杂度。
- 插件、配置、事件不会被物理误删。
- 审计类数据保持不可变。

缺点：

- 仍需约定哪些表支持软删除。
- 数据保留周期后续还要单独设计。

### 推荐

推荐采用 **方案 C：关键主表软删除，审计 append-only，归档策略暂缓**。

初版规则：

- `events`、`plugin_records`、`plugin_configs` 等主表支持软删除。
- `event_state_transitions`、`audit_logs` 不做软删除，只 append。
- 真实物理删除只允许用于本地开发或明确的维护脚本。
- 数据保留周期和归档策略后续等数据规模和合规要求明确后再定。

## 初版推荐表分组

### Event 相关

```text
raw_events
events
event_state_transitions
```

### Plugin 相关

```text
plugin_records
plugin_versions
plugin_configs
plugin_dependency_records
```

### Analysis 相关

```text
routing_decisions
industry_analyses
scored_analyses
decision_results
```

### Human / Notification 相关

```text
approval_records
notification_records
```

### Audit / Runtime 相关

```text
audit_logs
runtime_errors
```

## 初版落地顺序

1. 建立 SQLAlchemy Base、session、repository 基础结构。
2. 建立 Alembic migration 目录。
3. 建立 Event 相关表。
4. 建立 Plugin registry 相关表。
5. 建立 Decision、Approval、Audit 相关表。
6. 根据实际开发情况补充必要索引和查询优化。

原因：

- Event 和 Plugin 是运行时主路径。
- Decision 和 Approval 是闭环必需。
- 向量检索暂不进入初版，不应该阻塞核心事件管线落地。

## 待确认问题

暂无。用户已确认采用本文档推荐方案，向量检索和 embedding 后续再考虑。
