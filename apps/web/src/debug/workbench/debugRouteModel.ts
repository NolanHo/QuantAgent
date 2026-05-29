import type {
  DebugPageRouteDefinition,
  DebugPageRouteKey,
  DebugPageState,
  DebugRoutePreview,
} from './debugRouteTypes'

export const debugPageStateOptions: DebugPageState[] = ['overview', 'loading', 'empty', 'empty-cta']

export const debugPageRoutes: DebugPageRouteDefinition[] = [
  {
    key: 'events',
    label: '事件',
    kicker: '事件中心',
    title: '事件',
    description:
      '用于查看来源事件、分析状态和相关运行轨迹的事件接入与复核工作台。',
    loadingMessage: '正在加载事件工作台...',
    emptyTitle: '当前没有可处理事件',
    emptyDescription: '这个预览状态下还没有可供查看的来源事件。',
    overview: [
      { title: '待接入', copy: '已采集但尚未完成路由和分析的事件。' },
      { title: '处理中', copy: '已关联 Agent run、插件任务或人工处理流程的事件。' },
      { title: '已完成', copy: '已经形成决策、审计记录或审批结果的事件。' },
    ],
    ctaLabel: '预览操作',
  },
  {
    key: 'runtime',
    label: '运行时',
    kicker: '运行时',
    title: '运行时看板',
    description:
      '用于查看 Agent run、工具调用、调度器活动和运行时健康信号的运行看板。',
    loadingMessage: '正在加载运行时工作台...',
    emptyTitle: '当前没有运行时活动',
    emptyDescription:
      '这个预览状态下还没有 Agent run、工具调用或调度活动可供展示。',
    overview: [
      { title: 'Agent Runs', copy: '最近运行记录、状态流转和 trace 引用。' },
      { title: '工具调用', copy: '调用状态、重试情况、耗时和错误摘要。' },
      { title: '调度器', copy: '排队任务、已完成任务和运行失败情况。' },
    ],
  },
  {
    key: 'approvals',
    label: '审批',
    kicker: 'HITL',
    title: '审批',
    description:
      '用于处理待审批、即将过期、已处理和自动执行审批请求的人工授权队列。',
    loadingMessage: '正在加载审批工作台...',
    emptyTitle: '当前没有待处理审批',
    emptyDescription:
      '这个预览状态下还没有待处理、即将过期或已处理的审批请求可供展示。',
    overview: [
      { title: '待处理', copy: '等待批准、拒绝、重新分析或修订的请求。' },
      { title: '即将过期', copy: '需要在策略过期前尽快处理的短时效审批。' },
      { title: '已处理', copy: '已批准、已拒绝、已过期或执行后通知的决策记录。' },
    ],
  },
  {
    key: 'plugins',
    label: '插件',
    kicker: '插件',
    title: '插件管理',
    description:
      '用于查看来源、行业、策略、通知和执行器集成情况的插件清单。',
    loadingMessage: '正在加载插件清单...',
    emptyTitle: '当前没有可用插件',
    emptyDescription:
      '这个预览状态下还没有已安装集成或配置记录可供展示。',
    overview: [
      { title: '已安装', copy: '已注册插件的类型、版本和健康状态。' },
      { title: '配置', copy: '基于 schema 的设置、密钥引用、校验和审计轨迹。' },
      { title: '操作', copy: '启用、停用、重载以及依赖失败排查入口。' },
    ],
    ctaLabel: '预览安装流程',
  },
  {
    key: 'skills',
    label: '技能',
    kicker: '技能',
    title: '技能',
    description:
      '用于未来能力发现、配置检查和运行就绪性查看的技能注册工作台。',
    loadingMessage: '正在加载技能注册表...',
    emptyTitle: '当前没有已注册技能',
    emptyDescription:
      '这个预览状态下还没有能力条目或运行就绪信号可供展示。',
    overview: [
      { title: '目录', copy: '已注册技能和能力元数据会展示在这里。' },
      { title: '就绪性', copy: '后续会在这里检查依赖、权限和运行可用性。' },
      { title: '使用情况', copy: '用于查看技能采纳情况和执行模式的运行视角。' },
    ],
  },
  {
    key: 'tools',
    label: '工具',
    kicker: '工具注册表',
    title: '工具',
    description:
      '用于未来 schema 检查、运行可用性和集成边界核对的工具注册工作台。',
    loadingMessage: '正在加载工具注册表...',
    emptyTitle: '当前没有可用工具',
    emptyDescription:
      '这个预览状态下还没有已注册 schema、可用性信号或归属上下文可供展示。',
    overview: [
      { title: 'Schemas', copy: '工具定义、输入输出摘要会展示在这里。' },
      { title: '可用性', copy: '运行健康状态和兼容性信号会在这里查看。' },
      { title: '来源', copy: '插件和平台归属上下文会列在这里。' },
    ],
  },
  {
    key: 'industries',
    label: '行业包',
    kicker: '行业包',
    title: '行业包',
    description:
      '用于未来领域模块、市场覆盖和来源绑定上下文查看的行业包工作台。',
    loadingMessage: '正在加载行业包...',
    emptyTitle: '当前没有可用行业包',
    emptyDescription:
      '这个预览状态下还没有包覆盖范围、市场绑定或依赖信号可供展示。',
    overview: [
      { title: '包列表', copy: '行业模块和领域边界会汇总在这里。' },
      { title: '市场', copy: '市场覆盖和来源绑定上下文会在这里查看。' },
      { title: '依赖', copy: '后续的包就绪性和依赖信号会展示在这里。' },
    ],
  },
  {
    key: 'settings',
    label: '设置',
    kicker: '设置',
    title: '设置',
    description:
      '用于查看本地认证、通知渠道、密钥引用、授权策略和实时状态的设置工作台。',
    loadingMessage: '正在加载设置工作台...',
    emptyTitle: '当前没有已配置设置',
    emptyDescription:
      '这个预览状态下还没有访问策略、通知渠道或密钥引用可供展示。',
    overview: [
      { title: '访问', copy: '会话配置和能力可见性。' },
      { title: '通知', copy: '面向操作员提醒的渠道配置和投递健康状态。' },
      { title: '密钥', copy: '密钥引用和受策略控制的管理入口。' },
    ],
    ctaLabel: '预览设置操作',
  },
]

export function isDebugPageRouteKey(value: unknown): value is DebugPageRouteKey {
  return debugPageRoutes.some((route) => route.key === value)
}

export function isDebugPageState(value: unknown): value is DebugPageState {
  return debugPageStateOptions.includes(value as DebugPageState)
}

export function isDebugRoutePreview(value: unknown): value is DebugRoutePreview {
  return value === 'loading' || value === 'empty'
}

export function getDebugPageRoute(route: DebugPageRouteKey | undefined): DebugPageRouteDefinition {
  return debugPageRoutes.find((entry) => entry.key === route) ?? debugPageRoutes[0]
}
