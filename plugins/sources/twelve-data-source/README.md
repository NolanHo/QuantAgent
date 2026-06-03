# Twelve Data Quote Source

官方 `quantagent.official.source.twelve_data` source 插件。

## 当前支持

- 通过 `plugin.yaml` + `config.schema.json` 注册为官方 `source` 插件。
- 只提供 `source.fetch` 能力，返回 `SourceFetchResult`，不负责事件入库、调度或生命周期托管。
- 拉取 Twelve Data `quote` 接口，支持单 symbol 和批量 symbol。
- 处理 gzip 响应、JSON 解析、429 / 5xx / `URLError` 指数退避重试。
- 通过单元测试覆盖成功路径、部分失败、重试、HTTP 错误和非 JSON 响应。
- 与项目现有 `EffectiveSourceConfig` / scheduler 链路兼容，支持运行时 `env://...` secret reference 解引用。

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
- 平台应先解引用 `twelve_data_api_key_ref`，再把真实值注入运行时 `effective_config.twelve_data_api_key`。
- 当前项目 scheduler 兼容层会把 `EffectiveSourceConfig.config.twelve_data_api_key_ref` 中的 `env://<ENV_NAME>` 解引用成运行时字符串，并以扁平 `context.config` 传给插件；插件同时兼容 `twelve_data_api_key` 和已解引用的 `twelve_data_api_key_ref`。

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
- `items[*].metadata`: provider、symbol、price、currency、market、quote_timestamp

## 失败与重试

- `429`、`5xx`、`URLError`：最多重试 3 次，默认退避 `1s -> 2s -> 4s`。
- 非 `429` 的 `4xx`：直接失败，不重试。
- 非 JSON 响应：直接失败，并附带预览片段。
- 批量请求中单个 symbol 错误：跳过该 symbol，其余 symbol 继续返回。
- HTTP 请求在插件内部下沉到线程执行，避免阻塞项目 runtime 的事件循环。

## 验证

最小单测命令：

```bash
python -m pytest -q plugins/sources/twelve-data-source/tests/test_twelve_data_source.py
```
