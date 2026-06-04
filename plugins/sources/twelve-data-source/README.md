# Twelve Data Quote Source

官方 `quantagent.official.source.twelve_data` source 插件。

## 当前支持

- 通过 `plugin.yaml` + `config.schema.json` 注册为官方 `source` 插件。
- 只提供 `source.fetch` 能力，返回 `SourceFetchResult`，不负责事件入库、调度或生命周期托管。
- 只拉取 Twelve Data latest `quote` 接口，不扩展到历史数据、新闻联动或 WebSocket 行情流。
- 拉取 Twelve Data `quote` 接口，支持单 symbol 和批量 symbol。
- 处理 gzip 响应、JSON 解析、429 / 5xx / `URLError` 指数退避重试。
- 通过单元测试覆盖成功路径、部分失败、重试、HTTP 错误、缺失时间戳和非 JSON 响应。
- 与当前 runtime 配置注入链路兼容，支持运行时 `env://...` secret reference 解引用后的扁平配置。

## 配置

`config.schema.json` 当前暴露这些字段：

- `symbols`: 必填，股票代码列表。
- `twelve_data_api_key_ref`: 可选，指向 Twelve Data API key 的 secret reference。
- `market`: 可选，覆盖返回结果里的市场字段。
- `timeout_seconds`: 可选，请求超时，默认 `10`，最大 `30`。

示例配置：

```json
{
  "symbols": ["AAPL", "MSFT"],
  "twelve_data_api_key_ref": {
    "secret_ref": "env://TWELVE_DATA_API_KEY"
  },
  "timeout_seconds": 10
}
```

注意：

- 不要把真实 API key 写进 `config.schema.json`、README 或持久化配置。
- `twelve_data_api_key_ref` 是公开 schema 中的 secret reference 字段；`twelve_data_api_key` 仅作为宿主运行时注入字段使用，不进入公开 schema。
- 平台应先解引用 `twelve_data_api_key_ref`，再把真实值注入运行时 `effective_config.twelve_data_api_key`。
- 当前项目兼容层会把已解引用的 secret 扁平传给 `context.config`；插件同时兼容 `twelve_data_api_key` 和已解引用为字符串的 `twelve_data_api_key_ref`。

## 调用语义

`source.fetch` 支持用 request input 覆盖本次调用参数，例如：

```json
{
  "symbols": ["TSLA"],
  "market": "NASDAQ"
}
```

插件会消费合并后的 `effective_config`，并返回标准 `SourceFetchResult`：

- `items[*].external_id`: `twelve_data:<symbol>:<quote_timestamp>`
- `items[*].title`: `<symbol> @ <price>`
- `items[*].content`: 原始 quote JSON 字符串
- `items[*].raw_payload`: 包含 `source_plugin_id`、`source_type=market_quote` 和原始 provider 响应
- `items[*].metadata`: provider、source_plugin_id、source_type、symbol、price、currency、market、quote_timestamp

首版约束：

- `external_id` 固定采用 `provider:symbol:quote_timestamp`
- 当 Twelve Data 响应缺失 `quote_timestamp` 时直接失败，不做 fallback

## 失败与重试

- `429`、`5xx`、`URLError`：最多重试 3 次，默认退避 `1s -> 2s -> 4s`。
- 非 `429` 的 `4xx`：直接失败，不重试。
- 缺失 `quote_timestamp` 或 price 字段：直接失败，避免生成不稳定 quote 标识。
- 非 JSON 响应：直接失败，并附带预览片段。
- 批量请求中单个 symbol 错误：跳过该 symbol，其余 symbol 继续返回。
- HTTP 请求在插件内部下沉到线程执行，避免阻塞项目 runtime 的事件循环。

## 验证

最小单测命令：

```bash
python -m pytest -q plugins/sources/twelve-data-source/tests/test_twelve_data_source.py
```
