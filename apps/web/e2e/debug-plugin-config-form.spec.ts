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
          title: 'PluginConfig',
        },
        msg: 'ok',
      }),
      contentType: 'application/json',
      status: 200,
    })
  })

  await page.goto('/debug/plugin-config-form')

  await expect(page.getByRole('heading', { name: '插件配置调试表单' })).toBeVisible()
  await expect(page.getByRole('button', { name: '触发保存' })).toBeVisible()
  await expect(page.getByText('Schema Inspect')).toBeVisible()
})
