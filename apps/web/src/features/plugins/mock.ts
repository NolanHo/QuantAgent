import type {
  PluginConfigDebugFixture,
  PluginConfigFieldDefinition,
  PluginConfigSaveResult,
  PluginConfigSchemaSnapshot,
  PluginConfigSnapshot,
  PluginConfigValidationIssue,
  PluginConfigValidationResult,
  PluginRecord,
} from './types'

const COMPLEX_PLUGIN_ID = 'quantagent.debug.plugin-form.complex'
const SIMPLE_PLUGIN_ID = 'quantagent.debug.plugin-form.simple'
const MASK_TOKEN = '********'

export const debugPluginRecords: PluginRecord[] = [
  {
    id: COMPLEX_PLUGIN_ID,
    name: '复杂 Zod 样例',
    source: 'official',
    status: 'valid',
  },
  {
    id: SIMPLE_PLUGIN_ID,
    name: '最小配置样例',
    source: 'official',
    status: 'valid',
  },
]

function field(
  definition: Omit<PluginConfigFieldDefinition, 'support'> & {
    support?: PluginConfigFieldDefinition['support']
  },
): PluginConfigFieldDefinition {
  return {
    support: definition.support ?? 'supported',
    ...definition,
  }
}

const complexSchema: PluginConfigSchemaSnapshot = {
  pluginId: COMPLEX_PLUGIN_ID,
  pluginName: '复杂 Zod 样例',
  schemaTitle: 'PluginConfig',
  schemaDescription:
    '用于验证 Zod -> zod-to-json-schema 复杂结构在 schema-driven form 首版中的兼容性。',
  schemaSource: 'debug-mock',
  fields: [
    field({
      path: 'pluginId',
      key: 'pluginId',
      label: '插件 ID',
      description: '系统自动生成的插件实例唯一 UUID',
      type: 'string',
      required: true,
      examples: ['4d5bc026-8f6b-4ea6-9ef4-4b95ac0b4b77'],
    }),
    field({
      path: 'version',
      key: 'version',
      label: '插件版本',
      description: '符合语义化版本（Semantic Versioning）规范的版本号',
      type: 'string',
      required: true,
      examples: ['1.4.2'],
    }),
    field({
      path: 'environment',
      key: 'environment',
      label: '部署环境',
      description: '当前插件实例运行的目标集群环境',
      type: 'string',
      required: true,
      enumValues: ['development', 'staging', 'production'],
    }),
    field({
      path: 'deploymentZone.zoneCode',
      key: 'zoneCode',
      label: '大区代码',
      description: '例如 cn-east, us-west',
      type: 'string',
      required: true,
    }),
    field({
      path: 'deploymentZone.zoneId',
      key: 'zoneId',
      label: '可用区编号',
      description: '物理可用区的内部数字资产编号',
      type: 'integer',
      required: true,
    }),
    field({
      path: 'auth.clientId',
      key: 'clientId',
      label: 'Client ID',
      description: '第三方凭证颁发机构提供的客户端标识',
      type: 'string',
      required: true,
    }),
    field({
      path: 'auth.clientSecret',
      key: 'clientSecret',
      label: 'Client Secret',
      description: '敏感字段。编辑时可直接输入新密钥，不修改请保持掩码状态',
      type: 'string',
      required: true,
      sensitive: true,
      placeholder: '保持掩码表示不修改',
    }),
    field({
      path: 'auth.scopes',
      key: 'scopes',
      label: 'OAuth 作用域',
      description: '使用逗号分隔的权限范围列表',
      type: 'array',
      required: true,
      examples: ['read:events,write:plugins'],
    }),
    field({
      path: 'auth.tokenEndpoint',
      key: 'tokenEndpoint',
      label: 'Token 刷新地址',
      description: '获取及刷新 Access Token 的标准 HTTPS URL',
      type: 'string',
      required: true,
      examples: ['https://oauth.example.com/token'],
    }),
    field({
      path: 'topology.enableHighAvailability',
      key: 'enableHighAvailability',
      label: '启用高可用',
      description: '是否开启多实例容灾与多活路由拓扑',
      type: 'boolean',
      required: true,
      defaultValue: true,
      examples: ['true'],
    }),
    field({
      path: 'topology.maxRetryAttempts',
      key: 'maxRetryAttempts',
      label: '重试阈值',
      description: '请求失败时的最大自动重试次数，范围 0-10',
      type: 'integer',
      required: true,
      defaultValue: 3,
      examples: ['3'],
    }),
    field({
      path: 'topology.routingRules',
      key: 'routingRules',
      label: '动态路由表',
      description: '基于请求 Path 的自定义下游转发规则方案',
      type: 'record',
      required: true,
      recordValueShape: '{ targetCluster, weight, timeoutMs }',
      support: 'degraded',
      supportNote: '首版以 JSON 文本区域编辑 record，并展示 key pattern 要求。',
      examples: ['{"/orders/*":{"targetCluster":"cluster-a","weight":80,"timeoutMs":1500}}'],
    }),
    field({
      path: 'topology.nodes',
      key: 'nodes',
      label: '活跃节点集群',
      description: '当前高可用拓扑方案中注册的实体节点实例',
      type: 'array',
      required: true,
      support: 'degraded',
      supportNote: '首版以 JSON 文本区域编辑复杂对象数组。',
      examples: [
        '[{"nodeId":"node-a","role":"leader","connection":{"protocol":"grpc","host":"10.0.0.8","port":50051,"useTls":true}}]',
      ],
    }),
    field({
      path: 'topology.nodes[].connection',
      key: 'connection',
      label: '通信协议配置',
      description: '根据选定协议动态切换底层网络参数',
      type: 'union',
      required: true,
      support: 'degraded',
      supportNote: '首版展示 discriminated union 摘要，不提供分支级专用子表单。',
      unionOptions: ['grpc', 'webhook'],
    }),
    field({
      path: 'advancedMetrics.monitoredKeys',
      key: 'monitoredKeys',
      label: '监控指标项',
      description: '指定系统运行时需要上报的核心可观测性指标',
      type: 'array',
      required: true,
      examples: ['latency.p95,error.rate'],
    }),
    field({
      path: 'advancedMetrics.alertThresholdRatio',
      key: 'alertThresholdRatio',
      label: '告警水位线',
      description: '触发系统资源熔断的百分比阈值，范围 0.10 - 0.95',
      type: 'number',
      required: true,
      examples: ['0.75'],
    }),
  ],
  supportMatrix: [
    { feature: '嵌套对象', level: 'supported', note: '以 dot path 展平渲染。' },
    { feature: '数组', level: 'supported', note: '简单 string 数组使用逗号输入。' },
    {
      feature: 'record',
      level: 'degraded',
      note: '以 JSON 文本区域承接，保留 key pattern 和对象结构说明。',
    },
    {
      feature: 'discriminated union',
      level: 'degraded',
      note: '首版展示分支摘要与 JSON 编辑区，不做动态子组件切换。',
    },
    { feature: 'default', level: 'supported', note: '默认值用于初始展示与 reset 提示。' },
    {
      feature: '敏感字段掩码',
      level: 'supported',
      note: '保留掩码展示和显式替换，不回显明文。',
    },
    {
      feature: '任意自定义前端组件',
      level: 'unsupported',
      note: '插件不能注入自定义前端组件。',
    },
  ],
}

const complexConfig: PluginConfigSnapshot = {
  versionTag: 'complex-v1',
  maskedPaths: ['auth.clientSecret'],
  values: {
    pluginId: '4d5bc026-8f6b-4ea6-9ef4-4b95ac0b4b77',
    version: '1.4.2',
    environment: 'staging',
    'deploymentZone.zoneCode': 'cn-east',
    'deploymentZone.zoneId': '17',
    'auth.clientId': 'qa-debug-client',
    'auth.clientSecret': MASK_TOKEN,
    'auth.scopes': 'read:events,write:plugins',
    'auth.tokenEndpoint': 'https://oauth.example.com/token',
    'topology.enableHighAvailability': 'true',
    'topology.maxRetryAttempts': '3',
    'topology.routingRules':
      '{"/orders/*":{"targetCluster":"cluster-a","weight":80,"timeoutMs":1500},"/health":{"targetCluster":"cluster-b","weight":20,"timeoutMs":-1}}',
    'topology.nodes':
      '[{"nodeId":"node-a","role":"leader","connection":{"protocol":"grpc","host":"10.0.0.8","port":50051,"useTls":true},"metadata":{"tags":["primary"],"lastHeartbeat":"2026-05-20T12:45:00Z"}}]',
    'advancedMetrics.monitoredKeys': 'latency.p95,error.rate',
    'advancedMetrics.alertThresholdRatio': '0.75',
  },
}

const simpleSchema: PluginConfigSchemaSnapshot = {
  pluginId: SIMPLE_PLUGIN_ID,
  pluginName: '最小配置样例',
  schemaTitle: 'Placeholder Source Plugin Config',
  schemaDescription: '用于验证 empty / success / failure 路径的最小样例。',
  schemaSource: 'debug-mock',
  fields: [
    field({
      path: 'displayName',
      key: 'displayName',
      label: '展示名称',
      description: '用于在插件管理视图中显示的名称',
      type: 'string',
      required: true,
    }),
    field({
      path: 'enabled',
      key: 'enabled',
      label: '是否启用',
      description: '控制该示例插件是否参与调试流程',
      type: 'boolean',
      required: true,
      defaultValue: true,
      examples: ['true'],
    }),
  ],
  supportMatrix: [
    { feature: '简单对象', level: 'supported', note: '用于验证最小表单路径。' },
  ],
}

const simpleConfig: PluginConfigSnapshot = {
  versionTag: 'simple-v1',
  maskedPaths: [],
  values: {
    displayName: 'Debug Placeholder Plugin',
    enabled: 'true',
  },
}

const debugFixtures: Record<string, PluginConfigDebugFixture> = {
  [COMPLEX_PLUGIN_ID]: {
    schema: complexSchema,
    config: complexConfig,
  },
  [SIMPLE_PLUGIN_ID]: {
    schema: simpleSchema,
    config: simpleConfig,
  },
}

function delay(ms = 120): Promise<void> {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, ms)
  })
}

export function getDebugPluginFixture(pluginId: string): PluginConfigDebugFixture | null {
  return debugFixtures[pluginId] ?? null
}

export function listDebugPluginFixtures(): PluginRecord[] {
  return debugPluginRecords
}

export async function loadDebugPluginSchema(
  pluginId: string,
): Promise<PluginConfigSchemaSnapshot> {
  await delay()
  const fixture = getDebugPluginFixture(pluginId)
  if (!fixture) {
    throw new Error(`Unknown debug plugin fixture: ${pluginId}`)
  }

  return fixture.schema
}

export async function loadDebugPluginConfig(
  pluginId: string,
): Promise<PluginConfigSnapshot> {
  await delay()
  const fixture = getDebugPluginFixture(pluginId)
  if (!fixture) {
    throw new Error(`Unknown debug plugin fixture: ${pluginId}`)
  }

  return fixture.config
}

function parseBooleanValue(value: string): boolean | null {
  if (value === 'true') {
    return true
  }
  if (value === 'false') {
    return false
  }
  return null
}

function validateJsonField(path: string, value: string, issues: PluginConfigValidationIssue[]) {
  try {
    JSON.parse(value)
  } catch {
    issues.push({
      path,
      message: '需要提供合法的 JSON 文本。',
    })
  }
}

export async function validateDebugPluginConfig(
  schema: PluginConfigSchemaSnapshot,
  values: Record<string, string>,
): Promise<PluginConfigValidationResult> {
  await delay()
  const issues: PluginConfigValidationIssue[] = []

  for (const definition of schema.fields) {
    const rawValue = values[definition.path] ?? ''
    const trimmedValue = rawValue.trim()

    if (definition.required && trimmedValue.length === 0) {
      issues.push({
        path: definition.path,
        message: '该字段为必填项。',
      })
      continue
    }

    if (trimmedValue.length === 0) {
      continue
    }

    if (definition.path === 'pluginId' && !/^[0-9a-f-]{36}$/i.test(trimmedValue)) {
      issues.push({
        path: definition.path,
        message: '插件 ID 必须是 UUID 形式。',
      })
    }

    if (definition.path === 'version' && !/^\d+\.\d+\.\d+$/.test(trimmedValue)) {
      issues.push({
        path: definition.path,
        message: '版本号必须符合 X.Y.Z。',
      })
    }

    if (definition.path === 'auth.clientSecret' && trimmedValue !== MASK_TOKEN && trimmedValue.length < 16) {
      issues.push({
        path: definition.path,
        message: '敏感字段必须保持掩码或输入不少于 16 位的新值。',
      })
    }

    if (definition.type === 'boolean' && parseBooleanValue(trimmedValue) === null) {
      issues.push({
        path: definition.path,
        message: '布尔字段只能填写 true 或 false。',
      })
    }

    if ((definition.type === 'integer' || definition.type === 'number') && Number.isNaN(Number(trimmedValue))) {
      issues.push({
        path: definition.path,
        message: '该字段需要数字格式。',
      })
    }

    if (
      definition.type === 'string' &&
      definition.enumValues &&
      !definition.enumValues.includes(trimmedValue)
    ) {
      issues.push({
        path: definition.path,
        message: `可选值为：${definition.enumValues.join(' / ')}`,
      })
    }

    if (
      definition.path === 'auth.tokenEndpoint' &&
      !/^https?:\/\//.test(trimmedValue)
    ) {
      issues.push({
        path: definition.path,
        message: 'Token 地址必须以 http:// 或 https:// 开头。',
      })
    }

    if (
      definition.path === 'advancedMetrics.alertThresholdRatio' &&
      (Number(trimmedValue) < 0.1 || Number(trimmedValue) > 0.95)
    ) {
      issues.push({
        path: definition.path,
        message: '告警阈值需要在 0.10 到 0.95 之间。',
      })
    }

    if (
      definition.type === 'record' ||
      definition.type === 'union' ||
      (definition.type === 'array' && definition.support === 'degraded')
    ) {
      validateJsonField(definition.path, trimmedValue, issues)
    }
  }

  return {
    ok: issues.length === 0,
    issues,
  }
}

export async function saveDebugPluginConfig(
  schema: PluginConfigSchemaSnapshot,
  values: Record<string, string>,
): Promise<PluginConfigSaveResult> {
  await delay(220)

  if (values.environment === 'production') {
    throw new Error('调试页 mock save 拒绝直接把环境切换为 production。')
  }

  if (values['auth.clientId']?.trim() === 'simulate-save-failure') {
    throw new Error('已按调试输入触发保存失败分支。')
  }

  const fixture = getDebugPluginFixture(schema.pluginId)
  if (!fixture) {
    throw new Error(`Unknown debug plugin fixture: ${schema.pluginId}`)
  }

  const nextValues = { ...values }
  if ((nextValues['auth.clientSecret'] ?? '').trim().length > 0 && nextValues['auth.clientSecret'] !== MASK_TOKEN) {
    nextValues['auth.clientSecret'] = MASK_TOKEN
  }

  fixture.config = {
    maskedPaths: fixture.config.maskedPaths,
    versionTag: `${fixture.config.versionTag}-saved`,
    values: nextValues,
  }

  return {
    updatedAt: new Date().toISOString(),
    versionTag: fixture.config.versionTag,
  }
}
