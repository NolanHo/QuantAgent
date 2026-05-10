# 06. Source Plugin 设计

## 文档状态

**状态**：占位草案  
**范围**：数据源插件接口、抓取流程、去重、限流、错误处理  
**当前约定**：Source Plugin 是固定插件类型之一，通过 `plugin.yaml` 注册

## 后续需要讨论的问题

1. Source Plugin 是否分为 pull、push、stream 三类？
2. RSS、URL watcher、X API、Playwright crawler 是否共用统一输出事件结构？
3. 抓取频率、关键词、账号列表等配置属于 source 插件，还是行业包引用时覆盖？
4. 数据去重用 URL、content hash、source event id，还是组合策略？
5. Playwright crawler 是否独立容器运行？
6. 反爬、限流、代理、失败重试如何抽象？
7. 原始内容是否入库，还是只保存摘要和链接？
8. Source Plugin 是否允许直接触发行业包，还是必须先进入 Event Bus？

## 暂不决策

- 具体数据源实现。
- 抓取频率默认值。
- 代理和反爬方案。
- 原始网页快照存储方案。
