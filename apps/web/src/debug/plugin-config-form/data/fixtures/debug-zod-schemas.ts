import { z } from 'zod/v3'
import type {
  PluginConfigSchemaSnapshot,
  PluginConfigValidationIssue,
  PluginConfigValidationResult,
} from '@/features/plugins/config-form'


export const COMPLEX_PLUGIN_ID = 'quantagent.debug.plugin-form.complex'
export const SIMPLE_PLUGIN_ID = 'quantagent.debug.plugin-form.simple'
export const MASK_TOKEN = '********'

export const complexPluginConfigSchema = z.object({
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
          z.string().regex(/^\/[a-zA-Z0-9_\-*/]+$/),
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
              .describe('路由权重|title:流量比例;desc:该路由节点分配的流量权重百分比 (0-100)'),
            timeoutMs: z
              .union([z.number().positive().max(30000), z.literal(-1)])
              .describe('超时时间|title:超时毫秒数;desc:请求超时时间，设置为 -1 表示永不超时'),
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
                  host: z
                    .string()
                    .ip({ version: 'v4' })
                    .describe('主机地址|title:IPv4 地址;desc:后端服务私网弹性 IP'),
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
                    .describe('回调地址|title:WebHook URL;desc:接收事件推送的完整 HTTP/HTTPS 公网端点'),
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
                .describe('心跳时间|title:最后心跳;desc:系统最近一次捕获该节点活跃状态的时间戳'),
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

export const simplePluginConfigSchema = z.object({
  displayName: z
    .string()
    .min(1)
    .describe('展示名称|title:展示名称;desc:用于在插件管理视图中显示的名称'),
  enabled: z
    .boolean()
    .default(true)
    .describe('启用状态|title:是否启用;desc:控制该示例插件是否参与调试流程'),
})

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

function messageFromZodIssue(issue: z.ZodIssue): string | null {
  if (issue.code === z.ZodIssueCode.too_small) {
    const minimum = issue.minimum
    if (issue.type === 'string') {
      return `至少需要 ${minimum} 个字符。`
    }
    if (issue.type === 'array') {
      return `至少需要 ${minimum} 项。`
    }
    if (issue.type === 'number') {
      return issue.inclusive ? `数值不能小于 ${minimum}。` : `数值必须大于 ${minimum}。`
    }
  }

  if (issue.code === z.ZodIssueCode.too_big) {
    const maximum = issue.maximum
    if (issue.type === 'string') {
      return `最多允许 ${maximum} 个字符。`
    }
    if (issue.type === 'array') {
      return `最多允许 ${maximum} 项。`
    }
    if (issue.type === 'number') {
      return issue.inclusive ? `数值不能大于 ${maximum}。` : `数值必须小于 ${maximum}。`
    }
  }

  if (issue.code === z.ZodIssueCode.invalid_type) {
    return '输入类型不符合要求。'
  }

  return null
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
    if (issue.code === z.ZodIssueCode.invalid_enum_value && issue.options.length > 0) {
      return {
        path,
        message: `可选值为：${issue.options.join(' / ')}`,
      }
    }

    return {
      path,
      message: messageFromZodIssue(issue) ?? normalizeZodIssueMessage(path, issue.message),
    }
  })
}

export function validateDebugPayload(
  schema: PluginConfigSchemaSnapshot,
  payload: Record<string, unknown>,
): PluginConfigValidationResult {
  const parsed = resolveDebugPayloadSchema(schema.pluginId).safeParse(payload)

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

function resolveDebugPayloadSchema(pluginId: string) {
  if (pluginId === COMPLEX_PLUGIN_ID) {
    return complexPluginConfigSchema
  }

  if (pluginId === SIMPLE_PLUGIN_ID) {
    return simplePluginConfigSchema
  }

  throw new Error(`Unknown debug plugin schema: ${pluginId}`)
}
