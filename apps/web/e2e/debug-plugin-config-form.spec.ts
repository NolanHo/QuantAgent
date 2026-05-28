import { expect, test } from '@playwright/test'

test('renders the debug plugin config form route in development', async ({ page }) => {
  await page.route('**/api/v1/me', async (route) => {
    await route.fulfill({
      body: JSON.stringify({
        code: 0,
        data: {
          actor_id: 'local_dev',
          actor_type: 'development',
          capabilities: ['runtime.inspect', 'plugin.configure'],
          csrf_token: 'csrf-debug-form',
        },
        msg: 'ok',
      }),
      contentType: 'application/json',
      status: 200,
    })
  })

  await page.route('**/api/v1/auth/refresh', async (route) => {
    await route.fulfill({
      body: JSON.stringify({
        code: 0,
        data: {
          actor_id: 'local_dev',
          actor_type: 'development',
          capabilities: ['runtime.inspect', 'plugin.configure'],
          csrf_token: 'csrf-debug-form',
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          max_expires_at: Math.floor(Date.now() / 1000) + 7200,
        },
        msg: 'ok',
      }),
      contentType: 'application/json',
      status: 200,
    })
  })

  await page.route('**/api/v1/plugins/**/config-schema', async (route) => {
    await route.fulfill({
      body: JSON.stringify({
        code: 0,
        data: {
          $schema: 'http://json-schema.org/draft-07/schema#',
          type: 'object',
          title: 'PluginConfig',
          properties: {
            pluginId: {
              description: '插件唯一标识符|title:插件 ID;desc:系统自动生成的插件实例唯一 UUID',
              pattern:
                '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
              type: 'string',
            },
            environment: {
              description: '运行环境|title:部署环境;desc:当前插件实例运行的目标集群环境',
              enum: ['development', 'staging', 'production'],
              type: 'string',
            },
            advancedMetrics: {
              description: '高级监控|title:可观测性度量;desc:配置底层 Agent 行为及风险水位提示',
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
          required: ['pluginId', 'environment', 'advancedMetrics'],
        },
        msg: 'ok',
      }),
      contentType: 'application/json',
      status: 200,
    })
  })

  await page.goto('/debug/plugin-config-form')

  await expect(page.getByRole('heading', { name: '插件管理' })).toBeVisible()
  await expect(page.getByRole('region', { name: '全局插件列表' })).toBeVisible()
  await page.getByRole('button', { name: /设置/ }).first().click()
  await expect(page.getByRole('dialog', { name: /配置$/ })).toBeVisible()
  await expect(page.getByRole('button', { name: '保存改动' })).toBeVisible()
  await expect(page.getByRole('tab', { name: '样例配置 JSON' })).toBeVisible()
  await page.getByRole('tab', { name: '高级监控' }).click()
  await expect(page.getByRole('textbox', { name: '监控指标项 第 1 项' })).toBeVisible()
  await page.getByRole('button', { name: '关闭配置抽屉' }).click()

  await page.getByRole('link', { name: '调试工作台' }).click()

  await expect(page).toHaveURL(/\/debug\/?$/)
  await expect(page.getByRole('heading', { name: '调试工作台' })).toBeVisible()
  await expect(page.getByRole('button', { name: '打开插件配置表单' })).toBeVisible()
})
