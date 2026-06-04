# quantagent-core

`packages/core` 是 QuantAgent 的共享基础设施包。

当前这里包含：

- 插件 Registry / Runtime / Scheduling
- Event Bus（memory / kafka）
- 数据库与配置基础能力
- 一些最小的演示和验证入口

## 模块文档索引

| 模块 | 文档 | 说明 |
| --- | --- | --- |
| Approval | [approval/README.md](src/quantagent/core/approval/README.md) | HITL approval 编排、持久化真源边界、Event Bus topics、Policy Gate 和 approval scoped audit |
| Event Bus | [events/README.md](src/quantagent/core/events/README.md) | EventEnvelope、topic policy、memory / Kafka backend、publisher / consumer contract |
| Notifications | [notifications/README.md](src/quantagent/core/notifications/README.md) | notification requested / completed、sender、ingress fact、handoff 和 audit 边界 |
| Event Intake | [event_intake/README.md](src/quantagent/core/event_intake/README.md) | source event intake、decision、publisher 和 persistence 边界 |
| Raw Events | [raw_events/README.md](src/quantagent/core/raw_events/README.md) | raw event capture / persistence service 边界 |
| Worker Routing | [worker_routing/README.md](src/quantagent/core/worker_routing/README.md) | captured event routing、owner resolver、analysis request publisher |
| Registry | [registry/README.md](src/quantagent/core/registry/README.md) | 插件发现、manifest 校验和 registry service |
| Scheduling | [scheduling/README.md](src/quantagent/core/scheduling/README.md) | source binding 调度、运行记录和 scheduler loop service |
| Source Binding | [source_binding/README.md](src/quantagent/core/source_binding/README.md) | source binding 模板、配置合成和安装边界 |

## 演示入口

| Demo | 说明 |
| --- | --- |
| [quantagent-demo CLI](../docs/demo/quantagent-demo-cli.md) | 最小闭环：插件扫描 → 触发 → 事件发布 → 消费 |
| [插件底座 Demo](../docs/demo/plugin-registry-v1-pseudocode.md) | Registry → Runtime → Scheduling 全链路说明 |
