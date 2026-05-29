import { describe, expect, it } from 'vitest'

import {
  saveDebugPluginConfig,
  validateDebugPluginConfig,
} from './mock'
import {
  createSchemaSnapshotFromJsonSchema,
  getDebugPluginFixture,
} from './debug-fixtures'
import {
  COMPLEX_PLUGIN_ID,
  SIMPLE_PLUGIN_ID,
  validateDebugPayload,
} from './debug-zod-schemas'

describe('plugin config debug mock validation', () => {
  it('flags invalid UUID and short secret for the complex fixture', async () => {
    const fixture = getDebugPluginFixture('quantagent.debug.plugin-form.complex')
    expect(fixture).not.toBeNull()

    const result = await validateDebugPluginConfig(fixture!.schema, {
      ...fixture!.config.values,
      pluginId: 'bad-uuid',
      'auth.clientSecret': 'short',
    })

    expect(result.ok).toBe(false)
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'pluginId' }),
        expect.objectContaining({ path: 'auth.clientSecret' }),
      ]),
    )
  })

  it('reports zod length, count, and range validation messages', async () => {
    const fixture = getDebugPluginFixture('quantagent.debug.plugin-form.complex')
    expect(fixture).not.toBeNull()

    const result = await validateDebugPluginConfig(fixture!.schema, {
      ...fixture!.config.values,
      'auth.clientId': 'abc',
      'auth.scopes': '',
      'advancedMetrics.alertThresholdRatio': '1',
    })

    expect(result.ok).toBe(false)
    expect(result.issues).toEqual(
      expect.arrayContaining([
        { path: 'auth.clientId', message: '至少需要 5 个字符。' },
        { path: 'auth.scopes', message: '该字段为必填项。' },
        { path: 'advancedMetrics.alertThresholdRatio', message: '数值不能大于 0.95。' },
      ]),
    )
  })

  it('treats cleared numeric fields as missing instead of silently falling back to defaults', async () => {
    const fixture = getDebugPluginFixture('quantagent.debug.plugin-form.complex')
    expect(fixture).not.toBeNull()

    const result = await validateDebugPluginConfig(fixture!.schema, {
      ...fixture!.config.values,
      'topology.maxRetryAttempts': '',
    })

    expect(result.ok).toBe(false)
    expect(result.issues).toEqual(
      expect.arrayContaining([
        { path: 'topology.maxRetryAttempts', message: '该字段为必填项。' },
      ]),
    )
  })

  it('reports required errors when required array input is empty', async () => {
    const fixture = getDebugPluginFixture('quantagent.debug.plugin-form.complex')
    expect(fixture).not.toBeNull()

    const result = await validateDebugPluginConfig(fixture!.schema, {
      ...fixture!.config.values,
      'advancedMetrics.monitoredKeys': '',
    })

    expect(result.ok).toBe(false)
    expect(result.issues).toEqual(
      expect.arrayContaining([
        { path: 'advancedMetrics.monitoredKeys', message: '该字段为必填项。' },
      ]),
    )
  })

  it('rejects production environment after trimming whitespace in save guard', async () => {
    const fixture = getDebugPluginFixture('quantagent.debug.plugin-form.complex')
    expect(fixture).not.toBeNull()

    await expect(
      saveDebugPluginConfig(fixture!.schema, {
        ...fixture!.config.values,
        environment: ' production ',
      }),
    ).rejects.toThrow('调试页 mock save 拒绝直接把环境切换为 production。')
  })

  it('accepts updated supported string arrays after add or remove operations', async () => {
    const fixture = getDebugPluginFixture('quantagent.debug.plugin-form.complex')
    expect(fixture).not.toBeNull()

    const result = await validateDebugPluginConfig(fixture!.schema, {
      ...fixture!.config.values,
      'auth.scopes': 'read:events,audit:logs',
      'advancedMetrics.monitoredKeys': 'latency.p95',
    })

    expect(result.ok).toBe(true)
    expect(result.issues).toEqual([])
  })

  it('maps malformed JSON text to structured field issues', async () => {
    const fixture = getDebugPluginFixture('quantagent.debug.plugin-form.complex')
    expect(fixture).not.toBeNull()

    const result = await validateDebugPluginConfig(fixture!.schema, {
      ...fixture!.config.values,
      'topology.routingRules': '{bad json',
    })

    expect(result.ok).toBe(false)
    expect(result.issues).toEqual([
      {
        path: 'topology.routingRules',
        message: '需要提供合法的 JSON 文本。',
      },
    ])
  })

  it('derives internal field definitions from standard JSON schema input', () => {
    const fixture = getDebugPluginFixture('quantagent.debug.plugin-form.complex')
    expect(fixture).not.toBeNull()

    const snapshot = createSchemaSnapshotFromJsonSchema(
      'quantagent.debug.plugin-form.complex',
      fixture!.jsonSchema,
    )

    expect(snapshot.schemaSource).toBe('registry-api')
    expect(snapshot.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'pluginId',
          label: '插件 ID',
          required: true,
          type: 'string',
        }),
        expect.objectContaining({
          path: 'topology.routingRules',
          support: 'degraded',
          type: 'record',
        }),
        expect.objectContaining({
          path: 'advancedMetrics.monitoredKeys',
          support: 'supported',
          type: 'array',
        }),
      ]),
    )
  })

  it('rejects unknown debug plugin ids instead of validating against the simple schema', () => {
    const complexFixture = getDebugPluginFixture(COMPLEX_PLUGIN_ID)
    const simpleFixture = getDebugPluginFixture(SIMPLE_PLUGIN_ID)
    expect(complexFixture).not.toBeNull()
    expect(simpleFixture).not.toBeNull()

    expect(() =>
      validateDebugPayload(
        {
          ...simpleFixture!.schema,
          pluginId: 'quantagent.debug.plugin-form.unknown',
        },
        { displayName: 'fallback?', enabled: true },
      ),
    ).toThrow('Unknown debug plugin schema: quantagent.debug.plugin-form.unknown')
  })
})
