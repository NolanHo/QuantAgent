# 本地 Quick Start：跑通 NVDA Agent Chat、搜索和 Discord 通知

这份文档面向第一次启动 QuantAgent 的本地开发者。目标是从空环境跑到最小闭环：

```text
Web Agent Chat
  -> Semiconductor MainAgent 分析 NVDA 财报事件
  -> Tavily search_web 可用
  -> submit_action_plan 发布 action.requested
  -> worker 创建 approval
  -> Discord webhook 收到中文通知
  -> Web /approvals 查看审批和交易计划详情
```

本地闭环只允许 dry-run / mock / requested 摘要，不会执行真实 broker 交易。

## 1. 安装基础工具

需要先安装：

- Docker Desktop：[https://www.docker.com/products/docker-desktop/](https://www.docker.com/products/docker-desktop/)
- uv：[https://docs.astral.sh/uv/getting-started/installation/](https://docs.astral.sh/uv/getting-started/installation/)
- Bun：[https://bun.sh/docs/installation](https://bun.sh/docs/installation)

确认命令可用：

```bash
docker --version
uv --version
bun --version
```

## 2. 安装项目依赖

在仓库根目录执行：

```bash
uv sync --all-packages
bun install
```

如果 `uv sync --all-packages` 因 Python 版本或本地缓存失败，先确认当前 Python 满足仓库要求，再重跑同一个命令。

## 3. 准备本地环境变量

复制样例：

```bash
cp .env.example .env
```

生成模型和插件敏感配置入库用的加密主密钥：

```bash
uv run --package quantagent-core python -c "from quantagent.core.model_config import ModelConfigCrypto; print(ModelConfigCrypto.generate_key())"
```

把输出填到 `.env`：

```env
MODEL_CONFIG_ENCRYPTION_KEY=<上一步输出>
```

本地登录可以直接使用默认密码 `12345678`。如果你想跳过登录页面，可以在 `.env` 中设置：

```env
AUTH_ENABLED=false
VITE_AUTH_ENABLED=false
```

注意：Tavily key 和 Discord webhook URL 不要写进 `.env`。这两个必须在前端插件配置页保存。

## 4. 启动数据库和 Kafka

推荐本地开发只用 Docker 跑基础设施，API / worker / Web 用本机命令跑，方便看日志。

```bash
docker compose up -d db kafka
```

执行数据库迁移：

```bash
uv run db upgrade
```

可选：安装半导体 RSS SourceBinding，后续想从 RSS 自动进事件链路时需要它：

```bash
uv run source-bindings install-semiconductor-defaults
```

如果只调试 NVDA Agent Chat 页面，可以先跳过 scheduler。

## 5. 启动 API、worker 和 Web

开三个终端。

终端 1：API

```bash
uv run api
```

终端 2：worker

```bash
uv run worker
```

worker 必须运行；否则 Agent Chat 调用 `submit_action_plan` 后，只会把 `action.requested` 留在 Kafka，Discord 不会收到通知，`/approvals` 也不会新增审批。

终端 3：Web

```bash
bun run --cwd apps/web dev -- --host 127.0.0.1 --port 5174
```

打开 [http://localhost:5174](http://localhost:5174)。如果出现登录页，本地默认密码是 `12345678`。

## 6. 配置模型 Provider 和 preset

打开 Web 的 `/models` 页面：

1. 新增一个 OpenAI-compatible provider。
2. 填写 `base_url`、`api_key` 和模型信息。
3. 点击“检测连接”，确认基础连接成功。
4. 在 preset 区域把 `reasoning_text` 绑定到可用于 Agent Chat 的模型。
5. 如果要让 Router Agent 处理 RSS 事件，也把 `economy_text` 绑定到支持 OpenAI `response_format={"type":"json_object"}` 的模型。

Agent Chat 和 routed Agent Chat 主要依赖 `reasoning_text`。RSS Router intake 主要依赖 `economy_text`。

## 7. 配置 Tavily 插件

获取 Tavily API key：

1. 打开 [Tavily Dashboard](https://app.tavily.com/)。
2. 登录或注册账号。
3. 在 API keys 页面复制 key。

在 Web 中配置：

1. 打开 `/plugins`。
2. 找到 `quantagent.official.source.tavily`。
3. 进入详情页的配置区域。
4. 填写 `api_key`。
5. 保存并确认状态不再提示缺少必填配置。

这一步成功后，Agent Chat 里的 `search_web` 才能真实检索。不要用 `TAVILY_API_KEY` 环境变量作为主路径。

## 8. 配置 Discord 通知插件

创建 Discord webhook：

1. 在 Discord 服务器里选择目标频道。
2. 打开频道设置。
3. 进入 Integrations / Webhooks。
4. 新建 Webhook，并复制 Webhook URL。

在 Web 中配置：

1. 打开 `/plugins`。
2. 找到 `quantagent.official.notification.discord`。
3. 进入详情页的配置区域。
4. 填写 `webhook_url`。
5. 保存。

当前版本 Discord 只负责发送通知，不接收 approve / reject 回复。审批请在 Web `/approvals` 页面完成。

## 9. 跑 NVDA 财报 Agent Chat 测试

打开：

[http://localhost:5174/agent-chat?agent=quantagent.official.industry.semiconductor.agent.main&preset=nvda-earnings&routedEvent=nvda-earnings](http://localhost:5174/agent-chat?agent=quantagent.official.industry.semiconductor.agent.main&preset=nvda-earnings&routedEvent=nvda-earnings)

发送类似消息：

```text
调试事件：英伟达官方财报发布后 5 分钟内进入系统。
请按半导体 MainAgent 的真实链路分析这个事件，只有在判断为重大利好或重大利空且值得交易时，才进入行动计划和通知流程。
如果需要检索，请使用 Research Agent 补充市场预期和盘后反应。
```

预期现象：

- Agent Chat 页面能看到 MainAgent、Research Agent、tool call、todo 和报告产物。
- `search_web` 不再因为缺 Tavily key 失败。
- 如果 MainAgent 判断事件值得行动，会调用 `build_action_plan` 和 `submit_action_plan`。
- worker 日志能看到 `action.requested`、`notification.requested` 被消费。
- Discord 频道收到中文审批通知。
- `/approvals` 出现对应审批项。
- `/approvals/:approvalId` 能看到交易计划详情，包括订单、金额、组合占比、止损止盈、失效条件、监控主题和执行约束。

如果 Agent 判断事件不构成重大利好/重大利空，它应直接总结并停止，不应浪费搜索或行动工具调用。

## 10. Docker 全服务启动方式

如果想让 API、worker、scheduler 也跑在 Docker 中，可以用：

```bash
docker compose --profile migration run --rm migrate
docker compose up --build api worker scheduler
```

Web 仍建议本机跑：

```bash
bun run --cwd apps/web dev -- --host 127.0.0.1 --port 5174
```

如果只想 Docker 跑基础设施，继续使用：

```bash
docker compose up -d db kafka
uv run db upgrade
uv run api
uv run worker
bun run --cwd apps/web dev -- --host 127.0.0.1 --port 5174
```

## 11. 常见问题

### Discord 没收到消息

先看 worker 是否运行：

```bash
uv run worker
```

如果 Agent Chat 已经提交过 action，但当时 worker 没启动，启动 worker 后它会继续消费 Kafka 中尚未处理的消息。

再检查：

- `/plugins/quantagent.official.notification.discord` 是否已保存 `webhook_url`。
- API、worker 是否连接同一个 `DATABASE_URL`。
- API、worker 是否使用同一个 `MODEL_CONFIG_ENCRYPTION_KEY`。
- worker 日志里是否有 `notification.requested` 或 Discord 插件配置错误。

### Tavily 搜索 400 或失败

先确认 `/plugins/quantagent.official.source.tavily` 已保存 `api_key`。如果只有某些参数组合 400，说明工具 schema 和 Tavily API 参数兼容性还需要单独修复；但缺 key 时应该被渲染为可恢复工具失败，不应让整次 Agent run 崩溃。

### `/approvals` 没有审批

确认 MainAgent 是否真的调用了 `submit_action_plan`。如果 Agent 判断事件不值得交易，这是正常结果。若已经调用：

- worker 必须运行。
- Kafka 必须运行。
- `EVENT_BUS_BACKEND` 应保持 `kafka`，不要在多进程本地链路中设置为 `memory`。

### 想从 RSS 自动创建 session

启动 scheduler：

```bash
uv run scheduler
```

确保已经安装 SourceBinding：

```bash
uv run source-bindings install-semiconductor-defaults
```

链路是：

```text
scheduler 抓 RSS
  -> source.event.captured
  -> worker Router Agent
  -> event.routed
  -> worker 创建 Agent Chat session/run
  -> Semiconductor MainAgent 处理
```

可以用诊断命令查看最近事件链路：

```bash
uv run source-event-replay diagnose --limit 10
```
