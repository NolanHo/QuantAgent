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

test('supports add and remove operations for supported string arrays', async ({ mount }) => {
  const component = await renderWithProviders(mount, <PluginConfigDebugPanel />)

  const firstMetricInput = component.getByRole('textbox', { name: '监控指标项 第 1 项' })
  await expect(firstMetricInput).toHaveValue('latency.p95')
  await expect(component.getByRole('textbox', { name: '监控指标项 第 2 项' })).toHaveValue('error.rate')

  await component.getByLabel('添加 监控指标项 项').click()
  const thirdMetricInput = component.getByRole('textbox', { name: '监控指标项 第 3 项' })
  await thirdMetricInput.fill('queue.depth')

  await expect(component.getByText('当前数组项：latency.p95 / error.rate / queue.depth')).toBeVisible()

  await component.getByLabel('移除 监控指标项 第 3 项').click()

  await expect(component.getByRole('textbox', { name: '监控指标项 第 3 项' })).toHaveCount(0)
  await expect(component.getByText('当前数组项：latency.p95 / error.rate')).toBeVisible()
})
