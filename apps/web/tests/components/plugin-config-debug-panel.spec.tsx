import { expect, test } from '@playwright/experimental-ct-react'

import { PluginConfigDebugPanel } from '@/debug/plugin-config-form'
import { renderWithProviders } from '@/test/render'

test('renders plugin config workbench layout and surfaces validation errors', async ({ mount }) => {
  const component = await renderWithProviders(mount, <PluginConfigDebugPanel />)

  await expect(component.getByText('全局插件', { exact: true })).toBeVisible()
  await expect(component.getByRole('heading', { name: '插件管理' })).toBeVisible()
  await expect(component.getByRole('heading', { name: '复杂 Zod 样例' })).toBeVisible()

  await component.getByRole('button', { name: /设置/ }).first().click()

  await expect(component.getByRole('dialog', { name: '复杂 Zod 样例 配置' })).toBeVisible()
  await expect(component.getByRole('separator', { name: '调整抽屉宽度' })).toBeAttached()
  await expect(component.getByRole('tab', { name: '配置表单' })).toHaveAttribute('aria-selected', 'true')
  await expect(component.getByRole('heading', { name: '配置表单' })).toBeVisible()

  await component.getByRole('tab', { name: '认证配置' }).click()
  const authGroup = component.locator('#plugin-group-auth')
  await expect(authGroup.getByText('oauth2', { exact: true })).toBeVisible()
  await expect(authGroup.getByRole('textbox', { name: '认证协议' })).toHaveCount(0)

  const tokenEndpointInput = authGroup.getByRole('textbox', { name: 'Token 刷新地址' })
  await tokenEndpointInput.fill('not-a-valid-url')
  await expect(component.getByRole('button', { name: '保存改动' })).toBeVisible()

  await component.getByRole('button', { name: '校验插件' }).click()

  await component.getByRole('tab', { name: '样例配置 JSON' }).click()
  await expect(component.getByRole('heading', { name: '样例配置 JSON' })).toBeVisible()
  await expect(component.getByText('"type": "oauth2"')).toBeVisible()
  await expect(component.getByText('Token 地址必须是合法 URL。').first()).toBeVisible()
  await expect(component.getByText('待修复问题')).toBeVisible()
  await expect(component.getByRole('heading', { name: '错误处理' })).toBeVisible()
})

test('supports toggling sensitive input visibility for client secret', async ({ mount }) => {
  const component = await renderWithProviders(mount, <PluginConfigDebugPanel />)
  await component.getByRole('button', { name: /设置/ }).first().click()

  await component.getByRole('tab', { name: '认证配置' }).click()
  const authGroup = component.locator('#plugin-group-auth')
  const clientSecretInput = authGroup.getByLabel('Client Secret')
  await expect(clientSecretInput).toHaveAttribute('type', 'password')

  await component.getByRole('button', { name: '显示敏感值' }).click()
  await expect(clientSecretInput).toHaveAttribute('type', 'text')

  await component.getByRole('button', { name: '隐藏敏感值' }).click()
  await expect(clientSecretInput).toHaveAttribute('type', 'password')
})

test('renders switch for boolean fields and slider for bounded numeric fields', async ({ mount }) => {
  const component = await renderWithProviders(mount, <PluginConfigDebugPanel />)
  await component.getByRole('button', { name: /设置/ }).first().click()

  await component.getByRole('tab', { name: '部署拓扑' }).click()
  const topologyGroup = component.locator('#plugin-group-topology')
  await expect(topologyGroup.getByRole('switch', { name: '启用高可用' })).toBeVisible()

  await component.getByRole('tab', { name: '高级监控' }).click()
  const metricsGroup = component.locator('#plugin-group-advancedMetrics')
  await expect(metricsGroup.getByRole('group', { name: '告警水位线 滑块' })).toBeVisible()

  const ratioInput = metricsGroup.getByRole('textbox', { name: '告警水位线' })
  await ratioInput.fill('1.4')
  await expect(component.getByRole('button', { name: '保存改动' })).toBeVisible()
  await component.getByRole('button', { name: '校验插件' }).click()
  await component.getByRole('tab', { name: '样例配置 JSON' }).click()
  await expect(component.getByText('数值不能大于 0.95。').first()).toBeVisible()
})

test('shows inline field error immediately when bounded numeric input exceeds maximum', async ({ mount }) => {
  const component = await renderWithProviders(mount, <PluginConfigDebugPanel />)
  await component.getByRole('button', { name: /设置/ }).first().click()

  await component.getByRole('tab', { name: '部署拓扑' }).click()
  const topologyGroup = component.locator('#plugin-group-topology')
  const retryInput = topologyGroup.getByRole('textbox', { name: '重试阈值' })

  await retryInput.fill('11111')

  await expect(topologyGroup.getByText('数值不能大于 10。').first()).toBeVisible()
})

test('shows add affordance and supports remove operations for supported string arrays', async ({ mount }) => {
  const component = await renderWithProviders(mount, <PluginConfigDebugPanel />)
  await component.getByRole('button', { name: /设置/ }).first().click()

  await component.getByRole('tab', { name: '高级监控' }).click()
  const metricsGroup = component.locator('#plugin-group-advancedMetrics')
  const firstMetricInput = metricsGroup.getByRole('textbox', { name: '监控指标项 第 1 项' })
  await expect(firstMetricInput).toHaveValue('latency.p95')
  await expect(metricsGroup.getByRole('textbox', { name: '监控指标项 第 2 项' })).toHaveValue('error.rate')

  await expect(metricsGroup.getByRole('button', {
    name: '在 监控指标项 第 2 项后添加',
    exact: true,
  }).first()).toBeVisible()

  await metricsGroup.getByLabel('移除 监控指标项 第 2 项').click()
  await expect(component.getByRole('button', { name: '保存改动' })).toBeVisible()

  await expect(metricsGroup.getByRole('textbox', { name: '监控指标项 第 2 项' })).toHaveCount(0)
})

test('closes the drawer from the top-right close button', async ({ mount }) => {
  const component = await renderWithProviders(mount, <PluginConfigDebugPanel />)

  await component.getByRole('button', { name: /设置/ }).first().click()
  await expect(component.getByRole('dialog', { name: '复杂 Zod 样例 配置' })).toBeVisible()

  await component.getByRole('button', { name: '关闭配置抽屉' }).click()

  await expect(component.getByRole('dialog', { name: '复杂 Zod 样例 配置' })).toHaveCount(0)
})

test('shows a top-right save button after edits and saves all changes', async ({ mount }) => {
  const component = await renderWithProviders(mount, <PluginConfigDebugPanel />)

  await component.getByRole('button', { name: /设置/ }).first().click()
  await component.getByRole('tab', { name: '认证配置' }).click()

  const tokenEndpointInput = component.getByRole('textbox', { name: 'Token 刷新地址' })
  await tokenEndpointInput.fill('https://changed.example/token')
  const saveButton = component.getByRole('button', { name: '保存改动' })
  await expect(saveButton).toBeVisible()

  await saveButton.click()

  await expect(component.getByText(/已写入 debug mock snapshot/)).toBeVisible()
  await expect(component.getByRole('button', { name: '保存改动' })).toHaveCount(0)
  await expect(tokenEndpointInput).toHaveValue('https://changed.example/token')
})

test('keeps the form usable in compact mode', async ({ mount, page }) => {
  await page.setViewportSize({ width: 760, height: 900 })
  const component = await renderWithProviders(mount, <PluginConfigDebugPanel />)

  await component.getByRole('button', { name: /设置/ }).first().click()

  const dialog = component.getByRole('dialog', { name: '复杂 Zod 样例 配置' })
  const separator = component.getByRole('separator', { name: '调整抽屉宽度' })
  await expect(dialog).toBeVisible()
  await expect(separator).toBeAttached()

  const baseTab = component.getByRole('tab', { name: '基础信息' })
  await expect(baseTab).toBeVisible()
  await baseTab.click()
  await expect(component.locator('#plugin-group-base')).toBeVisible()
})
