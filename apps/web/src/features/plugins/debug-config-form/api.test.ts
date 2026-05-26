import { describe, expect, it, vi } from 'vitest'

import {
  fetchPluginConfigSchema,
  savePluginConfigDraft,
  validatePluginConfigDraft,
} from './api'

describe('fetchPluginConfigSchema', () => {
  it('converts remote json schema into internal field definitions', async () => {
    const apiClient = {
      get: vi.fn().mockResolvedValue({
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
      }),
    }

    const result = await fetchPluginConfigSchema(
      apiClient as never,
      'quantagent.debug.plugin-form.complex',
    )

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
    const apiClient = {
      get: vi.fn().mockRejectedValue(new Error('network down')),
    }

    const result = await fetchPluginConfigSchema(
      apiClient as never,
      'quantagent.debug.plugin-form.complex',
    )

    expect(result.schemaSource).toBe('debug-mock')
    expect(result.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'pluginId', type: 'string' }),
      ]),
    )
  })

  it('validates and saves registry schema drafts against the rendered schema fields', async () => {
    const apiClient = {
      get: vi.fn().mockResolvedValue({
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
      }),
    }

    const schema = await fetchPluginConfigSchema(
      apiClient as never,
      'quantagent.debug.plugin-form.complex',
    )

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
})
