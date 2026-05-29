import { describe, expect, it, vi } from 'vitest'

import { buildPluginConfigPreviewPayload } from '@/features/plugins/config-form'
import {
  fetchPluginConfigSchema,
  savePluginConfigDraft,
  validatePluginConfigDraft,
} from './api'

describe('fetchPluginConfigSchema', () => {
  it('converts remote json schema into internal field definitions', async () => {
    const loadRemoteSchema = vi.fn().mockResolvedValue({
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      title: 'RemotePluginConfig',
      properties: {
        pluginId: {
          description: '插件唯一标识符|title:插件 ID;desc:系统自动生成的插件实例唯一 UUID',
          type: 'string',
        },
        advancedMetrics: {
          properties: {
            monitoredKeys: {
              description: '指标键名|title:监控指标项;desc:指定系统运行时需要上报的核心可观测性指标',
              items: { type: 'string' },
              type: 'array',
            },
          },
          required: ['monitoredKeys'],
          type: 'object',
        },
      },
      required: ['pluginId', 'advancedMetrics'],
    })

    const result = await fetchPluginConfigSchema(loadRemoteSchema, 'quantagent.debug.plugin-form.complex')

    expect(result.schemaSource).toBe('registry-api')
    expect(result.schemaTitle).toBe('RemotePluginConfig')
    expect(result.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'pluginId',
          required: true,
          type: 'string',
        }),
        expect.objectContaining({
          path: 'advancedMetrics.monitoredKeys',
          support: 'supported',
          type: 'array',
        }),
      ]),
    )
  })

  it('marks local JSON schema fallback as debug mock source', async () => {
    const loadRemoteSchema = vi.fn().mockRejectedValue(new Error('network down'))

    const result = await fetchPluginConfigSchema(loadRemoteSchema, 'quantagent.debug.plugin-form.complex')

    expect(result.schemaSource).toBe('debug-mock')
    expect(result.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'pluginId', type: 'string' }),
      ]),
    )
  })

  it('validates and saves registry schema drafts against the rendered schema fields', async () => {
    const loadRemoteSchema = vi.fn().mockResolvedValue({
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      title: 'RemotePluginConfig',
      properties: {
        pluginId: {
          description: '插件唯一标识符|title:插件 ID;desc:系统自动生成的插件实例唯一 UUID',
          type: 'string',
        },
        remoteOnlyFlag: {
          description: '远端字段|title:远端开关;desc:仅存在于 registry schema 的布尔字段',
          type: 'boolean',
        },
      },
      required: ['pluginId', 'remoteOnlyFlag'],
    })

    const schema = await fetchPluginConfigSchema(loadRemoteSchema, 'quantagent.debug.plugin-form.complex')

    expect(schema.schemaSource).toBe('registry-api')
    expect(schema.fields.map((field) => field.path)).toContain('remoteOnlyFlag')

    const result = await validatePluginConfigDraft(schema, {
      pluginId: 'remote-plugin-id',
      remoteOnlyFlag: 'true',
    })

    expect(result).toEqual({ ok: true, issues: [] })
    await expect(
      savePluginConfigDraft(schema, {
        pluginId: 'remote-plugin-id',
        remoteOnlyFlag: 'true',
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        versionTag: expect.any(String),
      }),
    )
  })

  it('derives a generic record shape for non-fixture record schemas', async () => {
    const loadRemoteSchema = vi.fn().mockResolvedValue({
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      title: 'RemotePluginConfig',
      properties: {
        pluginId: {
          description: '插件唯一标识符|title:插件 ID;desc:系统自动生成的插件实例唯一 UUID',
          type: 'string',
        },
        dynamicRules: {
          description: '动态规则|title:动态规则;desc:用于测试通用 record 摘要',
          type: 'object',
          additionalProperties: {
            type: 'object',
            properties: {
              endpoint: { type: 'string' },
              retry: { type: 'integer' },
            },
          },
        },
      },
      required: ['pluginId', 'dynamicRules'],
    })

    const schema = await fetchPluginConfigSchema(loadRemoteSchema, 'quantagent.debug.plugin-form.complex')

    expect(schema.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'dynamicRules',
          type: 'record',
          recordValueShape: '{ endpoint, retry }',
        }),
      ]),
    )
  })

  it('returns field issues for required, length, count, and range errors', async () => {
    const loadRemoteSchema = vi.fn().mockResolvedValue({
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      title: 'RemotePluginConfig',
      properties: {
        displayName: {
          description: '展示名称|title:展示名称;desc:用于测试字符数限制',
          minLength: 3,
          maxLength: 8,
          type: 'string',
        },
        optionalMemo: {
          description: '备注|title:备注;desc:可选字段允许为空',
          minLength: 2,
          type: 'string',
        },
        codeName: {
          description: '代号|title:大写代号;desc:用于测试格式限制',
          pattern: '^[A-Z]+$',
          type: 'string',
        },
        retryCount: {
          description: '重试次数|title:重试次数;desc:用于测试数字范围',
          minimum: 1,
          maximum: 3,
          type: 'integer',
        },
        scopes: {
          description: '权限|title:权限列表;desc:用于测试数组数量',
          items: { type: 'string' },
          minItems: 2,
          maxItems: 3,
          type: 'array',
        },
      },
      required: ['displayName', 'codeName', 'retryCount', 'scopes'],
    })

    const schema = await fetchPluginConfigSchema(loadRemoteSchema, 'quantagent.debug.plugin-form.complex')

    expect(schema.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'displayName',
          required: true,
          constraints: expect.objectContaining({ minLength: 3, maxLength: 8 }),
        }),
        expect.objectContaining({
          path: 'optionalMemo',
          required: false,
        }),
      ]),
    )

    const result = await validatePluginConfigDraft(schema, {
      displayName: 'ab',
      codeName: 'abc',
      optionalMemo: '',
      retryCount: '5',
      scopes: 'read',
    })

    expect(result.ok).toBe(false)
    expect(result.issues).toEqual(
      expect.arrayContaining([
        { path: 'displayName', message: '至少需要 3 个字符。' },
        { path: 'codeName', message: '格式不符合要求。' },
        { path: 'retryCount', message: '数值不能大于 3。' },
        { path: 'scopes', message: '至少需要 2 项。' },
      ]),
    )
    expect(result.issues).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ path: 'optionalMemo' })]),
    )

    const missingRequired = await validatePluginConfigDraft(schema, {
      displayName: '',
      codeName: 'ABC',
      retryCount: '2',
      scopes: 'read,write',
    })

    expect(missingRequired.issues).toEqual(
      expect.arrayContaining([
        { path: 'displayName', message: '该字段为必填项。' },
      ]),
    )
  })

  it('surfaces invalid numeric draft values in preview payload instead of stringifying NaN to null', async () => {
    const loadRemoteSchema = vi.fn().mockResolvedValue({
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      title: 'RemotePluginConfig',
      properties: {
        retryCount: {
          description: '重试次数|title:重试次数;desc:用于测试数字解析失败',
          type: 'integer',
        },
      },
      required: ['retryCount'],
    })

    const schema = await fetchPluginConfigSchema(loadRemoteSchema, 'quantagent.debug.plugin-form.complex')
    const preview = buildPluginConfigPreviewPayload(schema, {
      retryCount: 'not-a-number',
    })

    expect(preview).toContain('"error": "字段 retryCount 无法解析"')
    expect(preview).not.toContain('null')
  })

  it('surfaces cleared required numeric fields in preview payload instead of restoring defaults', async () => {
    const loadRemoteSchema = vi.fn().mockResolvedValue({
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      title: 'RemotePluginConfig',
      properties: {
        retryCount: {
          default: 3,
          description: '重试次数|title:重试次数;desc:用于测试清空后的必填数值处理',
          maximum: 10,
          minimum: 0,
          type: 'integer',
        },
      },
      required: ['retryCount'],
    })

    const schema = await fetchPluginConfigSchema(loadRemoteSchema, 'quantagent.debug.plugin-form.complex')
    const preview = buildPluginConfigPreviewPayload(schema, {
      retryCount: '',
    })

    expect(preview).toContain('"error": "字段 retryCount 无法解析"')
    expect(preview).not.toContain('"retryCount": 3')
  })
})
