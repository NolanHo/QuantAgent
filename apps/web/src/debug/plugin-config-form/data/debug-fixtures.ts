import { z } from 'zod'
import {
  flattenJsonSchema,
  isPlainObject,
} from '@/features/plugins/config-form'
import type {
  PluginConfigJsonSchema,
  PluginConfigSchemaSnapshot,
  PluginConfigSnapshot,
} from '@/features/plugins/config-form'
import type { PluginConfigDebugFixture, PluginRecord } from '../model'

import {
  COMPLEX_PLUGIN_ID,
  MASK_TOKEN,
  SIMPLE_PLUGIN_ID,
  complexPluginConfigSchema,
  simplePluginConfigSchema,
} from './debug-zod-schemas'

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

export const complexFieldMetadata = new Map([
  ['auth.clientSecret', { sensitive: true, placeholder: '保持掩码表示不修改' }],
  [
    'topology.routingRules',
    {
      support: 'degraded' as const,
      supportNote: '首版以 JSON 文本区域编辑 record，并展示 key pattern 要求。',
    },
  ],
  [
    'topology.nodes',
    {
      support: 'degraded' as const,
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

export const simpleFieldMetadata = new Map()

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

export function complexConfigSourceAtPath(path: string): unknown {
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

export function simpleConfigSourceAtPath(path: string): unknown {
  const source: Record<string, unknown> = {
    displayName: 'Debug Placeholder Plugin',
    enabled: true,
  }

  return path
    .split('.')
    .reduce<unknown>((current, segment) => (isPlainObject(current) ? current[segment] : undefined), source)
}

const complexPluginJsonSchema = z.toJSONSchema(complexPluginConfigSchema, {
  target: 'draft-7',
}) as PluginConfigJsonSchema

const simplePluginJsonSchema = z.toJSONSchema(simplePluginConfigSchema, {
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

const simpleConfig: PluginConfigSnapshot = {
  versionTag: 'simple-v1',
  maskedPaths: [],
  values: {
    displayName: 'Debug Placeholder Plugin',
    enabled: 'true',
  },
}

export const debugFixtures: Record<string, PluginConfigDebugFixture> = {
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
