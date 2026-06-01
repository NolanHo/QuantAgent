import { expect, test } from '@playwright/experimental-ct-react'

import { PluginConfigDebugPanel } from '@/debug/plugin-config-form'
import { renderWithProviders } from '@/test/render'

test('shows remote schema load failures with request id instead of staying in loading', async ({ mount, page }) => {
  await page.route('http://debug-api.test/api/v1/plugins/**/config-schema', async (route) => {
    await route.fulfill({
      body: JSON.stringify({
        code: 500,
        data: null,
        msg: 'registry unavailable',
        request_id: 'req-schema-500',
      }),
      contentType: 'application/json',
      status: 500,
    })
  })

  const component = await renderWithProviders(mount, <PluginConfigDebugPanel />, {
    runtimeConfig: {
      apiBaseUrl: 'http://debug-api.test/api/v1',
    },
  })

  await expect(component.getByText('插件配置加载失败')).toBeVisible()
  await expect(component.getByText(/req-schema-500/)).toBeVisible()
  await expect(component.getByText('正在加载插件配置弹窗...')).toHaveCount(0)
})

test('renders plugin config workbench layout and surfaces validation errors', async ({ mount }) => {
  const component = await renderWithProviders(mount, <PluginConfigDebugPanel />)

  await expect(component.getByText('全局插件', { exact: true })).toBeVisible()
  await expect(component.getByRole('heading', { name: '插件管理' })).toBeVisible()
  await expect(component.getByRole('heading', { name: '复杂 Zod 样例' })).toBeVisible()

  await component.getByRole('button', { name: /设置/ }).first().click()

  await expect(component.getByRole('dialog', { name: '复杂 Zod 样例 配置' })).toBeVisible()
  await expect(component.getByRole('separator', { name: '调整抽屉宽度' })).toBeAttached()
  await expect(component.getByRole('tab', { name: '配置表单' })).toHaveAttribute('aria-selected', 'true')

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

test('shows concrete client secret format guidance when the value is invalid', async ({ mount }) => {
  const component = await renderWithProviders(mount, <PluginConfigDebugPanel />)
  await component.getByRole('button', { name: /设置/ }).first().click()

  await component.getByRole('tab', { name: '认证配置' }).click()
  const authGroup = component.locator('#plugin-group-auth')
  const clientSecretInput = authGroup.getByLabel('Client Secret')

  await component.getByRole('button', { name: '显示敏感值' }).click()
  await clientSecretInput.fill('short')

  await expect(
    authGroup.getByText('敏感字段必须保持掩码或输入不少于 16 位的新值。'),
  ).toBeVisible()
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

test('renders degraded JSON fields as highlighted code editors', async ({ mount }) => {
  const component = await renderWithProviders(mount, <PluginConfigDebugPanel />)
  await component.getByRole('button', { name: /设置/ }).first().click()

  await component.getByRole('tab', { name: '部署拓扑' }).click()
  const topologyGroup = component.locator('#plugin-group-topology')
  const routingRulesEditor = topologyGroup.getByLabel('动态路由表')
  const activeNodesEditor = topologyGroup.getByLabel('活跃节点集群')

  await expect(routingRulesEditor).toBeVisible()
  await expect(activeNodesEditor).toBeVisible()
  await expect(routingRulesEditor).toContainText('"targetCluster"')
  await expect(activeNodesEditor).toContainText('"nodeId"')
  await expect(topologyGroup.getByText('JSON', { exact: true }).first()).toBeVisible()
  await expect(topologyGroup.getByText('"targetCluster"').first()).toBeVisible()
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

test('reopens the same plugin with a fresh drawer session', async ({ mount }) => {
  const component = await renderWithProviders(mount, <PluginConfigDebugPanel />)

  const openSettingsButton = component.getByRole('button', { name: /设置/ }).first()
  await openSettingsButton.click()
  await component.getByRole('tab', { name: '认证配置' }).click()

  const tokenEndpointInput = component.getByRole('textbox', { name: 'Token 刷新地址' })
  await tokenEndpointInput.fill('https://stale.example/token')
  await component.getByRole('tab', { name: '样例配置 JSON' }).click()
  await component.getByRole('button', { name: '关闭配置抽屉' }).click()

  await expect(component.getByRole('dialog', { name: '复杂 Zod 样例 配置' })).toHaveCount(0)

  await openSettingsButton.click()

  await expect(component.getByRole('tab', { name: '配置表单' })).toHaveAttribute('aria-selected', 'true')
  await component.getByRole('tab', { name: '认证配置' }).click()
  await expect(component.getByRole('textbox', { name: 'Token 刷新地址' })).toHaveValue(
    'https://oauth.example.com/token',
  )
})

test('shows a top-right save button after edits and saves all changes', async ({ mount }) => {
  const component = await renderWithProviders(mount, <PluginConfigDebugPanel />)

  await component.getByRole('button', { name: /设置/ }).first().click()
  await component.getByRole('tab', { name: '认证配置' }).click()

  const tokenEndpointInput = component.getByRole('textbox', { name: 'Token 刷新地址' })
  const saveButton = component.getByRole('button', { name: '保存改动' })
  const resetButton = component.getByRole('button', { name: '重置草稿' })
  const originalValue = 'https://oauth.example.com/token'

  await expect(saveButton).toBeVisible()
  await expect(saveButton).toBeDisabled()
  await expect(resetButton).toBeEnabled()

  await tokenEndpointInput.fill('https://changed.example/token')
  await expect(saveButton).toBeEnabled()
  await expect(resetButton).toBeEnabled()

  await saveButton.click()

  await expect(saveButton).toBeVisible()
  await expect(saveButton).toBeDisabled()
  await expect(resetButton).toBeEnabled()
  await expect(tokenEndpointInput).toHaveValue('https://changed.example/token')

  await resetButton.click()

  await expect(tokenEndpointInput).toHaveValue(originalValue)
  await expect(saveButton).toBeEnabled()
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
