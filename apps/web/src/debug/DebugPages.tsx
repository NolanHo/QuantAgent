import { Link, Outlet, useNavigate } from '@tanstack/react-router'

import { PageEmpty } from '../app/components/PageEmpty'
import { PageLoading } from '../app/components/PageLoading'
import { PlaceholderPanel } from '../app/components/PlaceholderPanel'
import { PluginConfigDebugPanel } from '../features/plugins'
import { loadRuntimeConfig } from '../shared/config'
import {
  debugPageRoutes,
  debugPageStateOptions,
  getDebugPageRoute,
} from './debugRouteModel'
import {
  actionRowStyle,
  debugPanelGridStyle,
  primaryButtonStyle,
  secondaryButtonStyle,
} from './debugRouteStyles'
import type { DebugPageRouteKey, DebugPageState, DebugRoutePreview } from './debugRouteTypes'

export function DebugWorkbenchPage() {
  return (
    <>
      <section className="page-header">
        <p className="page-kicker">仅开发环境</p>
        <h1 className="page-title">调试工作台</h1>
        <p className="page-description">
          用于集中承接页面状态预览、运行时配置检查、错误兜底验证和路由级实验的开发态工作台。
        </p>
      </section>

      <Outlet />
    </>
  )
}

export function DebugWorkbenchIndexPage() {
  return (
    <>
      <section style={debugPanelGridStyle} aria-label="调试路由索引">
        <PlaceholderPanel
          title="页面状态"
          copy="在不修改业务路由 query 参数的前提下，预览页面级 loading、empty 和 overview 状态。"
        />
        <PlaceholderPanel
          title="运行时配置"
          copy="查看前端可见的运行时配置解析结果，不暴露隐藏环境细节。"
        />
        <PlaceholderPanel
          title="错误兜底"
          copy="通过受控的本地失败路径触发应用级错误兜底。"
        />
        <PlaceholderPanel
          title="路由实验场"
          copy="验证路由 search params、未知状态处理和本地 fallback 行为。"
        />
        <PlaceholderPanel
          title="插件配置表单"
          copy="验证 schema-driven form、敏感字段掩码和 Zod 来源 schema 兼容边界。"
        />
      </section>

      <section style={actionRowStyle} aria-label="调试路由快捷入口">
        <Link to="/debug/page-states" style={primaryButtonStyle}>
          打开页面状态
        </Link>
        <Link to="/debug/runtime-config" style={secondaryButtonStyle}>
          查看运行时配置
        </Link>
        <Link to="/debug/error-fallback" style={secondaryButtonStyle}>
          触发错误兜底
        </Link>
        <Link to="/debug/route-playground" style={secondaryButtonStyle}>
          打开路由实验场
        </Link>
        <Link to="/debug/plugin-config-form" style={secondaryButtonStyle}>
          打开插件配置表单
        </Link>
      </section>
    </>
  )
}

export function DebugPluginConfigFormPage() {
  return (
    <>
      <section className="page-header">
        <p className="page-kicker">仅开发环境</p>
        <h1 className="page-title">插件配置调试表单</h1>
        <p className="page-description">
          用于在 `/debug` 下受控验证插件配置 schema-driven form 首版能力。当前优先覆盖
          Zod authoring -&gt; zod-to-json-schema 来源链路、敏感字段掩码和保存状态机，不作为正式
          `/plugins` 功能交付。
        </p>
      </section>

      <PluginConfigDebugPanel />
    </>
  )
}

export function DebugPageStatesPage({
  route,
  state,
}: {
  route: DebugPageRouteKey
  state: DebugPageState
}) {
  const current = getDebugPageRoute(route)

  return (
    <>
      <section className="page-header">
        <p className="page-kicker">仅开发环境</p>
        <h1 className="page-title">页面状态</h1>
        <p className="page-description">
          用于统一承接页面级 loading、empty 和 overview 预览。后续新增页面状态预览应优先放在这里，而不是继续叠加业务路由 query 参数。
        </p>
      </section>

      <section style={actionRowStyle} aria-label="页面路由选择">
        {debugPageRoutes.map((option) => (
          <Link
            key={option.key}
            to="/debug/page-states"
            search={{ route: option.key, state }}
            style={option.key === current.key ? primaryButtonStyle : secondaryButtonStyle}
          >
            {option.label}
          </Link>
        ))}
      </section>

      <section style={actionRowStyle} aria-label="页面状态选择">
        {debugPageStateOptions.map((option) => (
          <Link
            key={option}
            to="/debug/page-states"
            search={{ route: current.key, state: option }}
            style={option === state ? primaryButtonStyle : secondaryButtonStyle}
          >
            {option}
          </Link>
        ))}
      </section>

      <section style={{ marginTop: 'var(--qa-spacing-xl)' }}>
        <section className="page-header">
          <p className="page-kicker">{current.kicker}</p>
          <h2 className="page-title">{current.title}</h2>
          <p className="page-description">{current.description}</p>
        </section>

        {state === 'loading' ? <PageLoading message={current.loadingMessage} /> : null}

        {state === 'empty' ? (
          <PageEmpty title={current.emptyTitle} description={current.emptyDescription} />
        ) : null}

        {state === 'empty-cta' ? (
          <PageEmpty
            title={current.emptyTitle}
            description={current.emptyDescription}
            cta={
              current.ctaLabel ? (
                <button style={primaryButtonStyle} type="button">
                  {current.ctaLabel}
                </button>
              ) : undefined
            }
          />
        ) : null}

        {state === 'overview' ? (
          <section style={debugPanelGridStyle} aria-label={`${current.label} overview preview`}>
            {current.overview.map((panel) => (
              <PlaceholderPanel key={panel.title} title={panel.title} copy={panel.copy} />
            ))}
          </section>
        ) : null}
      </section>
    </>
  )
}

export function DebugRuntimeConfigPage() {
  const runtimeConfig = loadRuntimeConfig()

  return (
    <>
      <section className="page-header">
        <p className="page-kicker">仅开发环境</p>
        <h1 className="page-title">运行时配置</h1>
        <p className="page-description">
          展示前端可见的运行时配置解析结果。本页只会渲染已经暴露给 Web 应用的值。
        </p>
      </section>

      <section style={debugPanelGridStyle} aria-label="运行时配置快照">
        <PlaceholderPanel title="API 基础地址" copy={runtimeConfig.apiBaseUrl || '（空字符串）'} />
        <PlaceholderPanel title="WebSocket 地址" copy={runtimeConfig.websocketUrl || '（空字符串）'} />
        <PlaceholderPanel title="运行模式" copy={runtimeConfig.mode} />
        <PlaceholderPanel title="是否开启认证" copy={runtimeConfig.authEnabled ? '是' : '否'} />
      </section>
    </>
  )
}

export function DebugErrorFallbackIndexPage() {
  const navigate = useNavigate()

  return (
    <>
      <section className="page-header">
        <p className="page-kicker">仅开发环境</p>
        <h1 className="page-title">错误兜底</h1>
        <p className="page-description">
          通过受控的本地错误路径触发应用级错误边界，不依赖后端请求。
        </p>
      </section>

      <section style={actionRowStyle}>
        <button
          style={primaryButtonStyle}
          type="button"
          onClick={() => {
            void navigate({ to: '/debug/error-fallback/throw' })
          }}
        >
          触发受控渲染错误
        </button>
      </section>

      <section style={{ marginTop: 'var(--qa-spacing-lg)' }}>
        <PlaceholderPanel
          title="预期结果"
          copy="应用应切换到现有错误兜底页面，保持安全的错误展示方式，并提供恢复操作。"
        />
      </section>

      <Outlet />
    </>
  )
}

export function DebugErrorFallbackThrowPage() {
  throw new Error('已从 /debug/error-fallback 触发调试错误兜底。')
}

export function DebugRoutePlaygroundPage({ preview }: { preview?: DebugRoutePreview }) {
  return (
    <>
      <section className="page-header">
        <p className="page-kicker">仅开发环境</p>
        <h1 className="page-title">路由实验场</h1>
        <p className="page-description">
          在不修改正式业务路由的前提下，验证 search params、未知状态 fallback 和路由级预览行为。
        </p>
      </section>

      <section style={actionRowStyle}>
        <Link to="/debug/route-playground" style={!preview ? primaryButtonStyle : secondaryButtonStyle}>
          默认概览
        </Link>
        <Link
          to="/debug/route-playground"
          search={{ preview: 'loading' }}
          style={preview === 'loading' ? primaryButtonStyle : secondaryButtonStyle}
        >
          preview=loading
        </Link>
        <Link
          to="/debug/route-playground"
          search={{ preview: 'empty' }}
          style={preview === 'empty' ? primaryButtonStyle : secondaryButtonStyle}
        >
          preview=empty
        </Link>
        <Link
          to="/debug/route-playground"
          search={{ preview: 'loading' as never, ignored: '1' as never }}
          style={secondaryButtonStyle}
        >
          添加忽略参数
        </Link>
      </section>

      {preview === 'loading' ? <PageLoading message="正在加载路由实验场预览..." /> : null}

      {preview === 'empty' ? (
        <PageEmpty
          title="当前没有选中路由状态"
          description="这个空态预览用于确认路由实验场只依赖本地 search params 就能切换分支。"
        />
      ) : null}

      {!preview ? (
        <section style={debugPanelGridStyle} aria-label="路由实验场概览">
          <PlaceholderPanel
            title="Search Param 分支"
            copy="在受控预览状态之间切换，并验证本地 fallback 行为。"
          />
          <PlaceholderPanel
            title="忽略值"
            copy="意外的 search params 应该被忽略，而不是破坏路由。"
          />
          <PlaceholderPanel
            title="路由隔离"
            copy="用这个页面验证路由语义，而不是把临时行为塞进正式业务路由。"
          />
        </section>
      ) : null}
    </>
  )
}
