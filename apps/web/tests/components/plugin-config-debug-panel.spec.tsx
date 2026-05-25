import { expect, test } from '@playwright/experimental-ct-react'

import { PluginConfigDebugPanel } from '@/features/plugins'
import { renderWithProviders } from '@/test/render'

test('renders debug plugin config panel and surfaces validation errors', async ({ mount }) => {
  const component = await renderWithProviders(mount, <PluginConfigDebugPanel />)

  await expect(component.getByRole('heading', { name: '复杂 Zod 样例' })).toBeVisible()
  await expect(component.getByText('Schema Inspect')).toBeVisible()
  await expect(component.getByLabel('Client Secret')).toHaveAttribute('type', 'password')

  const pluginIdInput = component.getByLabel('插件 ID')
  await pluginIdInput.fill('bad-uuid')

  await component.getByRole('button', { name: '先做校验' }).click()

  await expect(component.getByText('插件 ID 必须是 UUID 形式。')).toBeVisible()
  await expect(
    component.getByText('Validation Error · 字段级校验失败，需先修正表单。'),
  ).toBeVisible()
})
