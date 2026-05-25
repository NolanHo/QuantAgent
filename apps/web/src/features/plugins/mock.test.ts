import { describe, expect, it } from 'vitest'

import {
  getDebugPluginFixture,
  saveDebugPluginConfig,
  validateDebugPluginConfig,
} from './mock'

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
})
