# config-form

`config-form` 是 `apps/web` 内用于承接插件配置 `schema-driven form` 的共享模块。

它的目标不是做一个通用低代码表单平台，而是为 QuantAgent 当前的插件配置场景提供一套可复用的前端表单能力：

- 输入：受控的 `PluginConfigJsonSchema` / `PluginConfigSchemaSnapshot`
- 输出：可渲染的字段定义、表单草稿值、字段级校验结果、保存前 payload 解析能力
- UI：统一的表单组件、字段渲染和支持矩阵展示

## 适用范围

适合复用到这些场景：

- 插件配置编辑页
- 插件配置预览页
- 未来其他需要消费相同插件配置 schema 的受控页面

不适合直接拿来做这些事情：

- 任意 JSON Schema playground
- 插件自定义前端组件注入
- 与正式插件配置无关的通用业务表单

## 公开入口

统一从 [index.ts](./index.ts) 导入。

### 组件

- `PluginConfigForm`
  - 表单主壳，负责字段分组、字段区和支持矩阵布局
- `PluginConfigField`
  - 单字段渲染
- `PluginConfigSupportMatrix`
  - 支持矩阵卡片展示

### Queries / Mutations / Hooks

- `usePluginConfigSchemaQuery`
  - 受控 schema 查询壳
- `usePluginCurrentConfigQuery`
  - 当前配置查询壳
- `usePluginConfigValidationMutation`
  - 表单校验 mutation 壳
- `usePluginConfigSaveMutation`
  - 表单保存 mutation 壳
- `usePluginConfigDraftState`
  - `schema + config -> draftValues` 初始化同步、字段更新、issue 映射、草稿重置

### Schema / 表单模型工具

- `flattenJsonSchema`
  - 将受控 JSON Schema 展平为字段定义
- `normalizeInitialValues`
  - 根据字段定义和当前配置生成草稿初值
- `validateSchemaFields`
  - 字段级约束校验
- `parseConfigDraftPayload`
  - 将平铺草稿值解析回嵌套 payload
- `maskSensitiveValues`
  - 根据字段定义和 `maskedPaths` 回写敏感字段掩码

### 关键类型

- `PluginConfigJsonSchema`
- `PluginConfigSchemaSnapshot`
- `PluginConfigFieldDefinition`
- `PluginConfigSnapshot`
- `PluginConfigValueMap`
- `PluginConfigValidationResult`

## 推荐复用方式

复用时建议按下面的分层：

1. 在页面或 feature 数据层准备 schema/config/query/save/validate 数据源
2. 用 `usePluginConfigSchemaQuery`、`usePluginCurrentConfigQuery`、`usePluginConfigDraftState` 组合页面状态
3. 将 `schema`、`draftValues`、`issueLookup`、`updateDraft` 传给 `PluginConfigForm`
4. 如需保存前端保护，可先跑 `usePluginConfigValidationMutation`
5. 如需提交配置，按场景接自己的 `saveDraft(schema, values)`

最小骨架示例：

```tsx
import {
  PluginConfigForm,
  usePluginConfigDraftState,
  usePluginConfigSchemaQuery,
  usePluginCurrentConfigQuery,
} from '@/features/plugins/config-form'

function Example({ pluginId }: { pluginId: string }) {
  const schemaQuery = usePluginConfigSchemaQuery(pluginId, loadSchema)
  const configQuery = usePluginCurrentConfigQuery(pluginId, loadConfig)
  const {
    draftValues,
    issueLookup,
    updateDraft,
  } = usePluginConfigDraftState(schemaQuery.data ?? null, configQuery.data ?? null)

  if (!schemaQuery.data || !configQuery.data) {
    return null
  }

  return (
    <PluginConfigForm
      issueLookup={issueLookup}
      onValueChange={updateDraft}
      schema={schemaQuery.data}
      values={draftValues}
    />
  )
}
```

## 当前约束

当前模块是“受控可复用”，不是“全能力通用”：

- 只承诺受控的 `PluginConfigJsonSchema` 输入边界
- `record`、复杂对象数组、`union` 当前仍以 degraded 方式承接
- 不支持插件注入自定义前端组件
- 字段文案依赖 `description` 中约定的 `label/title/desc` 结构
- 默认字段级校验文案面向当前插件配置场景，不等于通用国际化方案

## 复用时的边界建议

- 页面级状态机、空态、权限提示和业务消息，留在调用方页面或 feature 内
- `config-form` 只承接共享表单能力，不承接页面专属数据源语义或页面业务状态
- 如果新增逻辑只对某个页面成立，不要直接塞回 `config-form`
- 如果新增逻辑会被两个以上页面复用，再按职责放进 `queries/`、`mutations/`、`hooks/`、`utils/` 或 `components/`

## 给 AI / 维护者的建议

- 优先复用 `types/plugin-config.types.ts`、`queries/`、`mutations/`、`hooks/`、`utils/plugin-config-draft.ts`、`utils/schema-json.ts`
- 不要在页面里重写 `draftValues -> payload`、字段约束校验或敏感字段掩码逻辑
- 不要把页面专属状态机或数据源规则下沉回 `config-form`
- 如果需要新增共享逻辑，先判断它是否脱离具体页面也成立；只有成立时才进入本模块

## 目录说明

- `components/`: schema-driven form 的展示组件和字段控件；不放 query、mutation 或数据源 adapter。
- `queries/`: TanStack Query 查询壳和 query key；只负责读取 schema/config 的服务端状态。当前仍保留局部 key 形状，等插件列表 / 详情 / 配置查询能力一起触及时，再统一对齐到共享 `plugins` root key。
- `mutations/`: 表单校验和保存 mutation 壳；不承接页面状态机或 toast。
- `hooks/`: 页面可复用的表单草稿状态 hook；只组合本地草稿、issue 映射和 reset。
- `types/`: 插件配置表单局部类型；不放运行时代码。
- `utils/`: JSON Schema 展平、草稿解析、字段校验、敏感字段掩码等无 UI 副作用工具。
