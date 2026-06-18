## ADDED Requirements

### Requirement: 插件配置值 API
系统 SHALL 为插件配置表单提供正式配置值 API，用于读取、校验和保存指定插件的配置值，并与现有插件 detail 配置视图区分开。

#### Scenario: 读取插件配置值
- **WHEN** 受保护客户端请求 `GET /api/v1/plugins/{plugin_id}/config-values`
- **THEN** API 返回统一 envelope，其中 `data.values` 包含可回填到配置表单的非敏感配置值
- **AND** `data.masked_paths` 标明已经保存但不能回显明文的敏感字段路径
- **AND** API 不返回任何 secret 明文

#### Scenario: 校验插件配置草稿
- **WHEN** 受保护客户端请求 `POST /api/v1/plugins/{plugin_id}/config:validate` 并提交配置草稿
- **THEN** API 使用该插件 Registry JSON Schema 校验配置草稿
- **AND** API 返回 `ok` 和字段级 `issues`
- **AND** 校验失败不会写入配置持久化记录

#### Scenario: 保存插件配置值
- **WHEN** 受保护客户端请求 `PUT /api/v1/plugins/{plugin_id}/config-values` 并提交通过 schema 校验的配置值
- **THEN** API 保存该插件的配置值并返回 `updated_at` 和 `version_tag`
- **AND** 敏感字段必须加密或等价保护后保存
- **AND** 响应、日志和错误详情不得包含敏感字段明文

### Requirement: 插件配置状态恢复
系统 SHALL 能根据已保存配置值恢复插件配置状态，使控制台和运行时能判断插件是否已经具备必要配置。

#### Scenario: 必填字段已保存
- **WHEN** 插件 schema 的所有必填字段已经保存且通过校验
- **THEN** 配置状态表现为可用或有效
- **AND** 详情视图中的配置摘要能反映缺失必填项数量为 0

#### Scenario: 必填字段缺失
- **WHEN** 插件 schema 存在未保存的必填字段
- **THEN** 配置状态表现为缺少必填项或未配置
- **AND** 配置值 API 返回足够的字段级信息，供前端展示缺失字段
