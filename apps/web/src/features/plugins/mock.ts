import { z } from 'zod'

import type {
  PluginConfigDebugFixture,
  PluginConfigFieldDefinition,
  PluginConfigJsonSchema,
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

const descriptionPattern = /^(?<label>[^|]+?)(?:\|title:(?<title>[^;|]+))?(?:;desc:(?<desc>.+))?$/

type FieldMetadata = {
  description?: string
  label?: string
  placeholder?: string
  sensitive?: boolean
  support?: PluginConfigFieldDefinition['support']
  supportNote?: string
}

type JsonSchemaContext = {
  metadataByPath: Map<string, FieldMetadata>
  sampleAtPath: (path: string) => unknown
}

const debugPluginRecords: PluginRecord[] = [
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

const complexFieldMetadata = new Map<string, FieldMetadata>([
  ['auth.clientSecret', { sensitive: true, placeholder: '保持掩码表示不修改' }],
  [
    'topology.routingRules',
    {
      support: 'degraded',
      supportNote: '首版以 JSON 文本区域编辑 record，并展示 key pattern 要求。',
    },
  ],
  [
    'topology.nodes',
    {
      support: 'degraded',
      supportNote: '首版以 JSON 文本区域编辑复杂对象数组。',
    },
  ],
  [
    'auth.scopes',
    {
      placeholder: 'read:events,write:plugins',
    },
  ],
  [
    'advancedMetrics.monitoredKeys',
    {
      placeholder: 'latency.p95,error.rate',
    },
  ],
])

const simpleFieldMetadata = new Map<string, FieldMetadata>()

const complexSupportMatrix: PluginConfigSchemaSnapshot['supportMatrix'] = [
  { feature: '嵌套对象', level: 'supported', note: '以 dot path 展平渲染。' },
  { feature: '数组', level: 'supported', note: '简单 string 数组支持显式增删操作。' },
  {
    feature: 'record',
    level: 'degraded',
    note: '以 JSON 文本区域承接，保留 key pattern 和对象结构说明。',
  },
  {
    feature: 'discriminated union',
    level: 'degraded',
    note: '首版通过复杂对象数组 JSON 输入验证 union 分支，不做动态子组件切换。',
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
]

const simpleSupportMatrix: PluginConfigSchemaSnapshot['supportMatrix'] = [
  { feature: '简单对象', level: 'supported', note: '用于验证最小表单路径。' },
]

function parseDescribeMetadata(description: string | undefined): FieldMetadata {
  if (!description) {
    return {}
  }

  const match = description.match(descriptionPattern)
  if (!match?.groups) {
    return { description }
  }

  return {
    label: match.groups.title?.trim() || match.groups.label.trim(),
    description: match.groups.desc?.trim() || match.groups.label.trim(),
  }
}

function createField(
  definition: Omit<PluginConfigFieldDefinition, 'support'> & {
    support?: PluginConfigFieldDefinition['support']
  },
): PluginConfigFieldDefinition {
  return {
    ...definition,
    support: definition.support ?? 'supported',
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toPath(parentPath: string, segment: string): string {
  return parentPath ? `${parentPath}.${segment}` : segment
}

function makeExamples(
  value: unknown,
  fieldType: PluginConfigFieldDefinition['type'],
): string[] | undefined {
  if (value === undefined) {
    return undefined
  }

  if (fieldType === 'array' || fieldType === 'record' || fieldType === 'union' || isPlainObject(value)) {
    return [JSON.stringify(value)]
  }

  return [String(value)]
}

function inferFieldTypeFromJsonSchema(
  schema: PluginConfigJsonSchema,
): PluginConfigFieldDefinition['type'] {
  if (Array.isArray(schema.oneOf) && schema.oneOf.length > 0) {
    return 'union'
  }

  if (schema.type === 'array') {
    return 'array'
  }

  if (schema.type === 'boolean') {
    return 'boolean'
  }

  if (schema.type === 'integer') {
    return 'integer'
  }

  if (schema.type === 'number') {
    return 'number'
  }

  if (schema.type === 'object') {
    if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
      return 'record'
    }
    return 'object'
  }

  return 'string'
}

function schemaSupportsDegradedMode(schema: PluginConfigJsonSchema): boolean {
  return (
    inferFieldTypeFromJsonSchema(schema) === 'record' ||
    inferFieldTypeFromJsonSchema(schema) === 'union' ||
    (inferFieldTypeFromJsonSchema(schema) === 'array' &&
      schema.items?.type === 'object')
  )
}

function unionOptionsFromJsonSchema(schema: PluginConfigJsonSchema): string[] | undefined {
  if (!Array.isArray(schema.oneOf)) {
    return undefined
  }

  const options = schema.oneOf
    .map((option) => option.properties?.protocol?.const)
    .filter((value): value is string => typeof value === 'string')

  return options.length > 0 ? options : undefined
}

function flattenJsonSchema(
  schema: PluginConfigJsonSchema,
  context: JsonSchemaContext,
  parentPath = '',
): PluginConfigFieldDefinition[] {
  const fields: PluginConfigFieldDefinition[] = []
  const properties = schema.properties ?? {}
  const required = new Set(schema.required ?? [])

  for (const [key, childSchema] of Object.entries(properties)) {
    const path = toPath(parentPath, key)
    const metadata = {
      ...parseDescribeMetadata(childSchema.description),
      ...context.metadataByPath.get(path),
    }
    const fieldType = inferFieldTypeFromJsonSchema(childSchema)
    const sample = context.sampleAtPath(path)
    const examples =
      metadata.placeholder !== undefined
        ? [metadata.placeholder]
        : makeExamples(sample, fieldType)

    if (childSchema.const !== undefined) {
      continue
    }

    if (fieldType === 'object') {
      fields.push(...flattenJsonSchema(childSchema, context, path))
      continue
    }

    fields.push(
      createField({
        path,
        key,
        label: metadata.label ?? key,
        description: metadata.description,
        type: fieldType,
        required: required.has(key),
        sensitive: metadata.sensitive,
        placeholder: metadata.placeholder,
        defaultValue: childSchema.default,
        enumValues: Array.isArray(childSchema.enum)
          ? childSchema.enum.filter((value): value is string => typeof value === 'string')
          : undefined,
        recordValueShape:
          fieldType === 'record' ? '{ targetCluster, weight, timeoutMs }' : undefined,
        unionOptions: unionOptionsFromJsonSchema(childSchema),
        examples,
        support: metadata.support ?? (schemaSupportsDegradedMode(childSchema) ? 'degraded' : undefined),
        supportNote:
          metadata.supportNote ??
          (fieldType === 'record'
            ? '首版以 JSON 文本区域编辑 record，并展示 key pattern 要求。'
            : fieldType === 'union'
              ? '首版展示 discriminated union 摘要，不提供分支级专用子表单。'
              : fieldType === 'array' && childSchema.items?.type === 'object'
                ? '首版以 JSON 文本区域编辑复杂对象数组。'
                : undefined),
      }),
    )
  }

  return fields
}

function complexConfigSourceAtPath(path: string): unknown {
  const source: Record<string, unknown> = {
    pluginId: '4d5bc026-8f6b-4ea6-9ef4-4b95ac0b4b77',
    version: '1.4.2',
    environment: 'staging',
    deploymentZone: {
      zoneCode: 'cn-east',
      zoneId: 17,
    },
    auth: {
      type: 'oauth2',
      clientId: 'qa-debug-client',
      clientSecret: MASK_TOKEN,
      scopes: ['read:events', 'write:plugins'],
      tokenEndpoint: 'https://oauth.example.com/token',
    },
    topology: {
      enableHighAvailability: true,
      maxRetryAttempts: 3,
      routingRules: {
        '/orders/*': {
          targetCluster: 'cluster-a',
          weight: 80,
          timeoutMs: 1500,
        },
        '/health': {
          targetCluster: 'cluster-b',
          weight: 20,
          timeoutMs: -1,
        },
      },
      nodes: [
        {
          nodeId: 'node-a',
          role: 'leader',
          connection: {
            protocol: 'grpc',
            host: '10.0.0.8',
            port: 50051,
            useTls: true,
          },
          metadata: {
            tags: ['primary'],
            lastHeartbeat: '2026-05-20T12:45:00Z',
          },
        },
      ],
    },
    advancedMetrics: {
      monitoredKeys: ['latency.p95', 'error.rate'],
      alertThresholdRatio: 0.75,
    },
  }

  return path
    .split('.')
    .reduce<unknown>((current, segment) => (isPlainObject(current) ? current[segment] : undefined), source)
}

function simpleConfigSourceAtPath(path: string): unknown {
  const source: Record<string, unknown> = {
    displayName: 'Debug Placeholder Plugin',
    enabled: true,
  }

  return path
    .split('.')
    .reduce<unknown>((current, segment) => (isPlainObject(current) ? current[segment] : undefined), source)
}

const complexPluginConfigSchema = z.object({
  pluginId: z
    .string()
    .uuid({ message: '格式错误' })
    .describe('插件唯一标识符|title:插件 ID;desc:系统自动生成的插件实例唯一 UUID'),
  version: z
    .string()
    .regex(/^\d+\.\d+\.\d+$/, { message: '格式必须为 X.Y.Z' })
    .describe('版本号|title:插件版本;desc:符合语义化版本（Semantic Versioning）规范的版本号'),
  environment: z
    .enum(['development', 'staging', 'production'])
    .describe('运行环境|title:部署环境;desc:当前插件实例运行的目标集群环境'),
  deploymentZone: z
    .object({
      zoneCode: z
        .string()
        .min(2)
        .describe('区域代码|title:大区代码;desc:例如 cn-east, us-west'),
      zoneId: z
        .number()
        .int()
        .positive()
        .describe('可用区 ID|title:可用区编号;desc:物理可用区的内部数字资产编号'),
    })
    .describe('部署拓扑区域|title:可用区配置;desc:插件部署的地理与逻辑区域限制'),
  auth: z
    .object({
      type: z.literal('oauth2').describe('鉴权类型|title:认证协议;desc:当前固定为 oauth2'),
      clientId: z
        .string()
        .min(5)
        .describe('客户端 ID|title:Client ID;desc:第三方凭证颁发机构提供的客户端标识'),
      clientSecret: z
        .string()
        .regex(/^(\*{6,}|.{16,})$/, { message: '必须保持掩码或长度不少于 16 位' })
        .describe(
          '客户端密钥|title:Client Secret;desc:敏感字段。编辑时可直接输入新密钥，不修改请保持掩码状态',
        ),
      scopes: z
        .array(z.string())
        .min(1)
        .describe('权限范围|title:OAuth 作用域;desc:该插件申请的权限范围列表'),
      tokenEndpoint: z
        .string()
        .url({ message: '需要提供合法的 URL。' })
        .describe('令牌端点|title:Token 刷新地址;desc:获取及刷新 Access Token 的标准 HTTPS URL'),
    })
    .describe('鉴权配置|title:安全认证;desc:插件与外部服务通信时的身份凭证配置'),
  topology: z
    .object({
      enableHighAvailability: z
        .boolean()
        .default(true)
        .describe('高可用开关|title:启用高可用;desc:是否开启多实例容灾与多活路由拓扑'),
      maxRetryAttempts: z
        .number()
        .min(0)
        .max(10)
        .int()
        .default(3)
        .describe('最大重试次数|title:重试阈值;desc:请求失败时的最大自动重试次数，范围 0-10'),
      routingRules: z
        .record(
          z.string().regex(/^\/[a-zA-Z0-9_\-*\/]+$/),
          z.object({
            targetCluster: z
              .string()
              .min(1)
              .describe('目标集群|title:对端集群名;desc:路由导向的后端集群标识'),
            weight: z
              .number()
              .min(0)
              .max(100)
              .int()
              .describe(
                '路由权重|title:流量比例;desc:该路由节点分配的流量权重百分比 (0-100)',
              ),
            timeoutMs: z
              .union([z.number().positive().max(30000), z.literal(-1)])
              .describe(
                '超时时间|title:超时毫秒数;desc:请求超时时间，设置为 -1 表示永不超时',
              ),
          }),
        )
        .describe('路由规则映射|title:动态路由表;desc:基于请求 Path 的自定义下游转发规则方案'),
      nodes: z
        .array(
          z.object({
            nodeId: z
              .string()
              .min(3)
              .describe('节点标识|title:Node ID;desc:集群内节点的唯一英文代号'),
            role: z
              .enum(['leader', 'follower', 'arbiter'])
              .describe('节点角色|title:拓扑角色;desc:节点在共识流中承担的角色'),
            connection: z
              .discriminatedUnion('protocol', [
                z.object({
                  protocol: z.literal('grpc').describe('协议|title:传输协议'),
                  host: z.ipv4().describe('主机地址|title:IPv4 地址;desc:后端服务私网弹性 IP'),
                  port: z
                    .number()
                    .int()
                    .gte(1024)
                    .lte(65535)
                    .describe('端口|title:服务端口;desc:端口有效范围 1024-65535'),
                  useTls: z
                    .boolean()
                    .describe('安全传输|title:开启 TLS 加密;desc:传输层是否启用证书加密'),
                }),
                z.object({
                  protocol: z.literal('webhook').describe('协议|title:传输协议'),
                  endpoint: z
                    .string()
                    .url({ message: '需要提供合法的 URL。' })
                    .describe(
                      '回调地址|title:WebHook URL;desc:接收事件推送的完整 HTTP/HTTPS 公网端点',
                    ),
                }),
              ])
              .describe('连接凭证|title:通信协议配置;desc:根据选定的协议动态切换底层网络参数'),
            metadata: z.object({
              tags: z
                .array(z.string())
                .max(5)
                .optional()
                .describe('标签组|title:节点标签;desc:用于编排调度和分组隔离的元数据标签'),
              lastHeartbeat: z
                .string()
                .datetime()
                .nullable()
                .describe(
                  '心跳时间|title:最后心跳;desc:系统最近一次捕获该节点活跃状态的时间戳',
                ),
            }),
          }),
        )
        .min(1)
        .describe('拓扑节点列表|title:活跃节点集群;desc:当前高可用拓扑方案中注册的实体节点实例'),
    })
    .describe('拓扑配置|title:高可用拓扑;desc:管理多节点高可用以及流量路由行为'),
  advancedMetrics: z
    .object({
      monitoredKeys: z
        .array(z.string().min(2))
        .min(1)
        .describe('指标键名|title:监控指标项;desc:指定系统运行时需要上报的核心可观测性指标'),
      alertThresholdRatio: z
        .number()
        .min(0.1)
        .max(0.95)
        .describe('告警阈值|title:告警水位线;desc:触发系统资源熔断的百分比阈值，范围 0.10 - 0.95'),
    })
    .describe('高级监控|title:可观测性度量;desc:配置底层 Agent 行为及风险水位提示'),
})

const complexPluginJsonSchema = z.toJSONSchema(complexPluginConfigSchema, {
  target: 'draft-7',
}) as PluginConfigJsonSchema

const complexSchema: PluginConfigSchemaSnapshot = {
  pluginId: COMPLEX_PLUGIN_ID,
  pluginName: '复杂 Zod 样例',
  schemaTitle: complexPluginJsonSchema.title ?? 'PluginConfig',
  schemaDescription:
    '用于验证 Zod authoring -> JSON Schema 复杂结构在 schema-driven form 首版中的兼容性。',
  schemaSource: 'debug-mock',
  fields: flattenJsonSchema(complexPluginJsonSchema, {
    metadataByPath: complexFieldMetadata,
    sampleAtPath: complexConfigSourceAtPath,
  }),
  supportMatrix: complexSupportMatrix,
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

const simplePluginConfigSchema = z.object({
  displayName: z
    .string()
    .min(1)
    .describe('展示名称|title:展示名称;desc:用于在插件管理视图中显示的名称'),
  enabled: z
    .boolean()
    .default(true)
    .describe('启用状态|title:是否启用;desc:控制该示例插件是否参与调试流程'),
})

const simplePluginJsonSchema = z.toJSONSchema(simplePluginConfigSchema, {
  target: 'draft-7',
}) as PluginConfigJsonSchema

const simpleSchema: PluginConfigSchemaSnapshot = {
  pluginId: SIMPLE_PLUGIN_ID,
  pluginName: '最小配置样例',
  schemaTitle: simplePluginJsonSchema.title ?? 'Placeholder Source Plugin Config',
  schemaDescription: '用于验证 empty / success / failure 路径的最小样例。',
  schemaSource: 'debug-mock',
  fields: flattenJsonSchema(simplePluginJsonSchema, {
    metadataByPath: simpleFieldMetadata,
    sampleAtPath: simpleConfigSourceAtPath,
  }),
  supportMatrix: simpleSupportMatrix,
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
    jsonSchema: complexPluginJsonSchema,
    schema: complexSchema,
    config: complexConfig,
  },
  [SIMPLE_PLUGIN_ID]: {
    jsonSchema: simplePluginJsonSchema,
    schema: simpleSchema,
    config: simpleConfig,
  },
}

function delay(ms = 120): Promise<void> {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, ms)
  })
}

function setPathValue(target: Record<string, unknown>, path: string[], value: unknown) {
  let current: Record<string, unknown> = target

  for (const segment of path.slice(0, -1)) {
    const next = current[segment]
    if (!isPlainObject(next)) {
      current[segment] = {}
    }
    current = current[segment] as Record<string, unknown>
  }

  current[path.at(-1) ?? ''] = value
}

function parseArrayInput(value: string): string[] {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function parseScalarValue(definition: PluginConfigFieldDefinition, rawValue: string): unknown {
  switch (definition.type) {
    case 'boolean':
      return rawValue === 'true'
    case 'integer':
    case 'number':
      return Number(rawValue)
    case 'array':
      return definition.support === 'degraded' ? JSON.parse(rawValue) : parseArrayInput(rawValue)
    case 'record':
    case 'union':
      return JSON.parse(rawValue)
    default:
      return rawValue
  }
}

function parseFormValues(
  schema: PluginConfigSchemaSnapshot,
  values: Record<string, string>,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {}

  if (schema.pluginId === COMPLEX_PLUGIN_ID) {
    setPathValue(payload, ['auth', 'type'], 'oauth2')
  }

  for (const definition of schema.fields) {
    const rawValue = values[definition.path] ?? ''
    const trimmedValue = rawValue.trim()

    if (trimmedValue.length === 0) {
      continue
    }

    setPathValue(payload, definition.path.split('.'), parseScalarValue(definition, trimmedValue))
  }

  return payload
}

function normalizeZodIssueMessage(path: string, message: string): string {
  if (path === 'pluginId' && message === '格式错误') {
    return '插件 ID 必须是 UUID 形式。'
  }

  if (path === 'version' && message === '格式必须为 X.Y.Z') {
    return '版本号必须符合 X.Y.Z。'
  }

  if (path === 'auth.clientSecret' && message === '必须保持掩码或长度不少于 16 位') {
    return '敏感字段必须保持掩码或输入不少于 16 位的新值。'
  }

  if (path === 'auth.tokenEndpoint' && message === '需要提供合法的 URL。') {
    return 'Token 地址必须是合法 URL。'
  }

  return message
}

function formatIssuePath(path: ReadonlyArray<PropertyKey>): string {
  return path
    .map((segment) =>
      typeof segment === 'number' || typeof segment === 'string' ? String(segment) : '',
    )
    .filter(Boolean)
    .join('.')
}

function mapZodIssues(error: z.ZodError): PluginConfigValidationIssue[] {
  return error.issues.map((issue) => {
    const path = formatIssuePath(issue.path)
    if (issue.code === 'invalid_value' && Array.isArray(issue.values) && issue.values.length > 0) {
      return {
        path,
        message: `可选值为：${issue.values.join(' / ')}`,
      }
    }

    return {
      path,
      message: normalizeZodIssueMessage(path, issue.message),
    }
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

export function getDebugPluginJsonSchema(pluginId: string): PluginConfigJsonSchema | null {
  return getDebugPluginFixture(pluginId)?.jsonSchema ?? null
}

export function createSchemaSnapshotFromJsonSchema(
  pluginId: string,
  jsonSchema: PluginConfigJsonSchema,
): PluginConfigSchemaSnapshot {
  const fixture = getDebugPluginFixture(pluginId)

  if (!fixture) {
    throw new Error(`Unknown debug plugin fixture: ${pluginId}`)
  }

  const baseSchema = fixture.schema

  return {
    ...baseSchema,
    schemaSource: 'registry-api',
    schemaTitle: jsonSchema.title ?? baseSchema.schemaTitle,
    fields: flattenJsonSchema(jsonSchema, {
      metadataByPath:
        pluginId === COMPLEX_PLUGIN_ID ? complexFieldMetadata : simpleFieldMetadata,
      sampleAtPath:
        pluginId === COMPLEX_PLUGIN_ID ? complexConfigSourceAtPath : simpleConfigSourceAtPath,
    }),
  }
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

export async function validateDebugPluginConfig(
  schema: PluginConfigSchemaSnapshot,
  values: Record<string, string>,
): Promise<PluginConfigValidationResult> {
  await delay()

  const payload = parseFormValues(schema, values)
  const parsed =
    schema.pluginId === COMPLEX_PLUGIN_ID
      ? complexPluginConfigSchema.safeParse(payload)
      : simplePluginConfigSchema.safeParse(payload)

  if (parsed.success) {
    return {
      ok: true,
      issues: [],
    }
  }

  return {
    ok: false,
    issues: mapZodIssues(parsed.error),
  }
}

export async function saveDebugPluginConfig(
  schema: PluginConfigSchemaSnapshot,
  values: Record<string, string>,
): Promise<PluginConfigSaveResult> {
  await delay(220)

  if ((values.environment ?? '').trim().toLowerCase() === 'production') {
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
  if (
    (nextValues['auth.clientSecret'] ?? '').trim().length > 0 &&
    nextValues['auth.clientSecret'] !== MASK_TOKEN
  ) {
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
