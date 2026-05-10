# 04. 技术架构

## 架构目标

技术架构需要支持事件实时接入、Agent 状态机编排、行业插件扩展、可解释推理和低延迟 UI 展示。

## 总体架构

```text
Data Sources
  -> Watcher / Crawlers / APIs
  -> MCP Industry Servers
  -> FastAPI Backend
  -> DeepAgents (LangGraph)
  -> PostgreSQL
  -> WebSocket Event Stream
  -> React Frontend
```

## 后端

### 技术选型

- 语言：Python 3.11+
- Web 框架：FastAPI
- 核心 Agent 引擎：DeepAgents (LangGraph)
- 状态机：使用 LangGraph 管理复杂推理流程和执行状态
- 存储：PostgreSQL

### 后端职责

- 接收来自 Watcher、MCP Server 或外部 API 的事件。
- 编排 Router Agent、行业插件和 Internal Debate。
- 管理事件状态流转。
- 存储事件、推理摘要、置信度、用户反馈和执行记录。
- 通过 WebSocket 向前端推送事件流和 Agent 进度。

### 存储要求

- PostgreSQL 存储结构化事件、执行状态、用户操作和审计记录。
- 敏感配置不得明文存储在数据库中。

## 推理与模型层

### 技术选型

- 推理加速：vLLM-mlx。
- 目标环境：优化 MacOS 上的 DeepSeek-R1 运行。
- 目标体验：支持秒级语义解析。

### 推理要求

- 支持实体提取、行业路由、二阶推理、反方观点生成和置信度评分。
- 对高风险决策进行多信源验证。
- 输出面向用户的推理摘要，而不是不可控的原始长链路。
- 记录模型版本、提示词版本和输入输出摘要，便于回溯。

## 前端

### 技术选型

- 框架：React 19。
- 样式：Tailwind CSS。
- 设计方向：Apple-quality 工业设计、玻璃拟态背景、高信息密度。
- 实时通信：WebSockets。

### 前端职责

- 展示实时事件流。
- 展示 Agent 思考过程和状态进度。
- 展示行业包管理看板。
- 展示交易建议弹窗和 HITL 操作。
- 展示通知记录、历史事件和用户反馈。

## 数据层

### 分布式爬虫

- 支持 Playwright 模拟浏览器行为。
- 支持针对反爬策略的可配置抓取策略。
- 支持抓取频率控制、关键词过滤和失败重试。

### API 接入

- 支持 X API。
- 支持 Financial Data Providers。
- 支持行业官网和新闻源。
- 所有 API 接入需记录来源、时间、权限和失败原因。

## MCP 集成

行业插件通过 MCP 向主 Agent 暴露工具集和资源。

### MCP Server 最小能力

- 暴露可调用工具，例如抓取、查询、行业推理、标的映射。
- 暴露资源，例如行业因果图谱、Ticker List、历史事件样例。
- 提供健康检查和版本信息。
- 返回结构化错误，避免主 Agent 只能收到自然语言失败描述。

## 可观测性要求

- 每个事件需有唯一 ID。
- 每次路由、推理、验证、辩论、执行都应记录状态和时间。
- WebSocket 推送需要具备断线重连后的状态恢复能力。
- 高风险异常需要可被用户和开发者追踪到数据源、模型输出和执行动作。

## 发布与部署约束

- 敏感配置仅存储于本地环境。
- 自动交易能力需要独立开关。
- 行业包应支持独立启停，避免单个插件异常影响整个系统。
- 爬虫和交易执行应具备限流与熔断能力。
