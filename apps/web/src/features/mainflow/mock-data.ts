export interface DashboardMetric {
  label: string
  value: string
  trend: string
}

export interface EventSummary {
  id: string
  title: string
  source: string
  publishedAt: string
  publishedMinutesAgo: number
  priority: string
  credibility: string
  impactStrength: string
  timeliness: string
  status: string
  summary: string
  reason: string
  actionHint: string
  industries: string[]
}

export interface ApprovalSummary {
  id: string
  eventId: string
  eventTitle: string
  source: string
  actionLabel: string
  recommendation: string
  eventCredibility: string
  analysisConfidence: string
  riskDirection: string
  riskLevel: string
  expiresIn: string
  expirationAction: string
  confirmationLevel: string
  triggerSummary: string
}

export interface HealthAlert {
  id: string
  title: string
  severity: string
  summary: string
  traceHint: string
  relatedRunId?: string
}

export interface RuntimeHealthMetric {
  label: string
  value: string
  description: string
}

export interface RuntimeAgentRunStep {
  title: string
  copy: string
}

export interface RuntimeAgentRunSummary {
  id: string
  eventId: string
  runType: string
  status: string
  providerPolicy: string
  modelUsed: string
  tokenUsage: string
  costEstimate: string
  duration: string
  traceId: string
  summary: string
  timeline: RuntimeAgentRunStep[]
}

export interface RuntimeToolInvocationSummary {
  id: string
  eventId: string
  agentRunId: string
  toolId: string
  toolName: string
  pluginId: string
  riskLevel: string
  requiresHumanApproval: boolean
  status: string
  timeoutMs: string
  retryCount: string
  duration: string
  traceId: string
  requestId: string
  summary: string
  inputSummary: string
  outputSummary: string
  errorSummary: string
}

export interface RuntimeErrorSummary {
  id: string
  component: string
  severity: string
  title: string
  summary: string
  traceId: string
  eventId?: string
  pluginId?: string
  providerPolicy?: string
}

export interface PluginRecordSummary {
  id: string
  name: string
  type: string
  source: string
  version: string
  status: string
  summary: string
  blockedReason: string
  lastError: string
  capabilities: string[]
  relatedEventId?: string
}

export const dashboardMetrics: readonly DashboardMetric[] = [
  { label: '今日重点事件', value: '05', trend: '3 条处于 S/A 优先级' },
  { label: '待处理审批', value: '03', trend: '1 条将在 18 分钟内过期' },
  { label: '关键健康提醒', value: '02', trend: '1 条影响事件分析质量' },
  { label: '待复核分析', value: '02', trend: '含 1 条工具超时降级' },
]

export const featuredEvents: readonly EventSummary[] = [
  {
    id: 'evt-semiconductor-export',
    title: '北美半导体出口限制升级，设备链预期再下修',
    source: '全球财经快讯',
    publishedAt: '2026-05-28 10:24',
    publishedMinutesAgo: 96,
    priority: 'S',
    credibility: '82 / 100',
    impactStrength: '89 / 100',
    timeliness: '高',
    status: 'decision_ready',
    summary:
      '出口限制进一步收紧后，设备、材料与成熟制程链条的订单兑现预期同步转弱，市场正在重新计价未来两个季度的资本开支与替代节奏。',
    reason: '高可信 + 强影响 + 高时效',
    actionHint: '优先复核设备链仓位暴露与替代率假设',
    industries: ['半导体设备', '上游材料'],
  },
  {
    id: 'evt-semiconductor-memory',
    title: '存储厂启动新一轮报价试探，NAND 现货价格继续抬升',
    source: '渠道报价监测',
    publishedAt: '2026-05-28 09:12',
    publishedMinutesAgo: 168,
    priority: 'A',
    credibility: '76 / 100',
    impactStrength: '72 / 100',
    timeliness: '中高',
    status: 'analyzing',
    summary:
      '现货价格继续试探上沿，若报价在未来 2 到 3 个交易日仍能维持抬升，同时下游接单与渠道补库节奏没有转弱，存储链景气修复的可信度会继续增强。',
    reason: '报价持续抬升，等待第二信源确认',
    actionHint: '观察报价持续性与下游接单反馈是否同步改善',
    industries: ['存储芯片', '封测'],
  },
  {
    id: 'evt-semiconductor-foundry',
    title: '晶圆代工厂传出下季成熟制程议价松动，功率器件链承压',
    source: '产业链跟踪',
    publishedAt: '2026-05-28 08:47',
    publishedMinutesAgo: 193,
    priority: 'A',
    credibility: '68 / 100',
    impactStrength: '78 / 100',
    timeliness: '中',
    status: 'pending_approval',
    summary:
      '功率器件与 MCU 所在的成熟制程供需仍偏松，若下季议价继续松动，相关公司的毛利率修复时间点可能再次后移。',
    reason: '影响强但仍有二阶推导风险，需要人工确认',
    actionHint: '检查成熟制程敞口和盈利下修敏感度',
    industries: ['晶圆代工', '功率半导体'],
  },
]

export const approvalsQueue: readonly ApprovalSummary[] = [
  {
    id: 'apr-semiconductor-01',
    eventId: 'evt-semiconductor-export',
    eventTitle: '北美半导体出口限制升级，设备链预期再下修',
    source: '全球财经快讯',
    actionLabel: '降低半导体设备板块风险暴露',
    recommendation: '78 / 100',
    eventCredibility: '高可信',
    analysisConfidence: '74 / 100',
    riskDirection: 'increase_risk',
    riskLevel: '高',
    expiresIn: '18 分钟',
    expirationAction: 'expire_and_notify',
    confirmationLevel: 'strong_confirm',
    triggerSummary: '高价值事件触发的高风险减仓建议',
  },
  {
    id: 'apr-memory-02',
    eventId: 'evt-semiconductor-memory',
    eventTitle: '存储厂启动新一轮报价试探，NAND 现货价格继续抬升',
    source: '渠道报价监测',
    actionLabel: '请求重分析并补充库存去化验证',
    recommendation: '63 / 100',
    eventCredibility: '中高可信',
    analysisConfidence: '61 / 100',
    riskDirection: 'neutral',
    riskLevel: '中',
    expiresIn: '45 分钟',
    expirationAction: 'expire_and_archive',
    confirmationLevel: 'manual_only',
    triggerSummary: '分析存在数据缺口，先补齐证据再进入动作确认',
  },
  {
    id: 'apr-foundry-03',
    eventId: 'evt-semiconductor-foundry',
    eventTitle: '晶圆代工厂传出下季成熟制程议价松动，功率器件链承压',
    source: '产业链跟踪',
    actionLabel: '维持减仓建议并等待二次确认',
    recommendation: '70 / 100',
    eventCredibility: '中可信',
    analysisConfidence: '66 / 100',
    riskDirection: 'reduce_risk',
    riskLevel: '中',
    expiresIn: '2 小时',
    expirationAction: 'expire_and_notify',
    confirmationLevel: 'link_confirm',
    triggerSummary: '建议方向清晰，但需要受限确认入口完成二次确认',
  },
]

export const healthAlerts: readonly HealthAlert[] = [
  {
    id: 'health-source-1',
    title: '半导体资讯 source 插件连续失败',
    severity: '高',
    summary: '过去 20 分钟内 3 次抓取失败，可能影响事件覆盖完整度。',
    traceHint: 'trace_id: rt-source-412',
    relatedRunId: 'run-semiconductor-export-01',
  },
  {
    id: 'health-tool-2',
    title: '行业影响分析工具超时率升高',
    severity: '中',
    summary: '最近 10 次分析中 2 次超过 SLA，建议检查 provider fallback。',
    traceHint: 'trace_id: tool-impact-98',
    relatedRunId: 'run-semiconductor-memory-02',
  },
]

export const runtimeHealthSummary: readonly RuntimeHealthMetric[] = [
  { label: '运行中 AgentRun', value: '02', description: '含 1 条 analyzing、1 条 pending_approval' },
  { label: '最近失败数', value: '01', description: '最近 1 小时内存在 1 条 output_invalid' },
  { label: '工具错误数', value: '02', description: '1 条 timeout，1 条 blocked' },
  { label: '实时连接状态', value: '已降级', description: 'WebSocket 断连，REST 刷新仍可用' },
]

export const runtimeFilters = ['event_id', 'trace_id', 'plugin_id', 'status', '时间范围'] as const

export const runtimeAgentRuns: readonly RuntimeAgentRunSummary[] = [
  {
    id: 'run-semiconductor-export-01',
    eventId: 'evt-semiconductor-export',
    runType: 'industry_analysis',
    status: 'succeeded',
    providerPolicy: 'balanced',
    modelUsed: 'gpt-5-mini',
    tokenUsage: '12.4k',
    costEstimate: '$0.38',
    duration: '38s',
    traceId: 'trace-run-001',
    summary: '已完成结构化行业影响分析，并生成等待 strong_confirm 的最佳动作。',
    timeline: [
      { title: 'Router 完成', copy: '事件完成路由，命中 semiconductor analyst。' },
      { title: 'IndustryAgent 启动', copy: '使用 balanced policy 发起行业影响分析。' },
      { title: 'Tool 调用', copy: '调用 NewsVerificationTool 和 MarketContextTool。' },
      { title: '结构化输出通过校验', copy: '生成 DecisionResult 摘要并进入审批链路。' },
    ],
  },
  {
    id: 'run-semiconductor-memory-02',
    eventId: 'evt-semiconductor-memory',
    runType: 'reanalysis',
    status: 'output_invalid',
    providerPolicy: 'reasoning',
    modelUsed: 'claude-4.1-sonnet',
    tokenUsage: '18.7k',
    costEstimate: '$0.92',
    duration: '54s',
    traceId: 'trace-run-002',
    summary: '模型输出命中 schema validation 失败，当前建议仍需人工复核后重分析。',
    timeline: [
      { title: 'Router 完成', copy: '事件进入重分析链路。' },
      { title: 'IndustryAgent 启动', copy: '切换 reasoning policy 以提高复杂判断质量。' },
      { title: 'Tool 调用超时', copy: '库存验证工具一次超时后重试成功。' },
      { title: 'Schema validation 失败', copy: '输出字段缺失，保留失败摘要等待重试。' },
    ],
  },
]

export const runtimeToolInvocations: readonly RuntimeToolInvocationSummary[] = [
  {
    id: 'tool-semiconductor-news-001',
    eventId: 'evt-semiconductor-export',
    agentRunId: 'run-semiconductor-export-01',
    toolId: 'news_verification_tool',
    toolName: 'NewsVerificationTool',
    pluginId: 'plugin-source-global-wire',
    riskLevel: 'low',
    requiresHumanApproval: false,
    status: 'succeeded',
    timeoutMs: '8000',
    retryCount: '0',
    duration: '1.8s',
    traceId: 'trace-tool-001',
    requestId: 'req-tool-001',
    summary: '完成双信源校验，提升事件可信度并补充来源权威度摘要。',
    inputSummary: '输入为事件摘要与候选来源列表。',
    outputSummary: '输出双信源确认结果和冲突检查摘要。',
    errorSummary: '无',
  },
  {
    id: 'tool-semiconductor-inventory-002',
    eventId: 'evt-semiconductor-memory',
    agentRunId: 'run-semiconductor-memory-02',
    toolId: 'inventory_signal_tool',
    toolName: 'InventorySignalTool',
    pluginId: 'plugin-industry-memory',
    riskLevel: 'medium',
    requiresHumanApproval: false,
    status: 'timed_out',
    timeoutMs: '5000',
    retryCount: '1',
    duration: '5.0s',
    traceId: 'trace-tool-002',
    requestId: 'req-tool-002',
    summary: '库存去化验证工具首轮超时，重试后仍只返回部分摘要。',
    inputSummary: '输入为价格趋势与库存去化问题摘要。',
    outputSummary: '输出部分库存趋势结论，缺少交叉验证字段。',
    errorSummary: 'timeout after 5000ms',
  },
]

export const runtimeErrors: readonly RuntimeErrorSummary[] = [
  {
    id: 'err-runtime-provider-001',
    component: 'provider',
    severity: 'critical',
    title: 'reasoning policy fallback exhausted',
    summary: '高质量模型调用在限流后 fallback 失败，导致重分析输出无效。',
    traceId: 'trace-run-002',
    eventId: 'evt-semiconductor-memory',
    providerPolicy: 'reasoning',
  },
  {
    id: 'err-runtime-plugin-002',
    component: 'plugin',
    severity: 'high',
    title: 'source plugin fetch failed',
    summary: '全球线索抓取插件连续失败，影响事件覆盖完整度。',
    traceId: 'trace-source-412',
    pluginId: 'plugin-source-global-wire',
  },
]

export const pluginRecords: readonly PluginRecordSummary[] = [
  {
    id: 'plugin-source-global-wire',
    name: 'Global Wire Source',
    type: 'source',
    source: 'official',
    version: '0.4.2',
    status: 'failed',
    summary: '负责全球财经快讯采集，当前连续抓取失败，影响事件覆盖完整度。',
    blockedReason: '最近 20 分钟出现 3 次 fetch 失败',
    lastError: 'HTTP 429 after upstream burst',
    capabilities: [
      'Source: fetch / subscribe / normalize',
      'Health: 最近抓取失败与噪音熔断摘要',
      'Used by: semiconductor industry plugin',
    ],
    relatedEventId: 'evt-semiconductor-export',
  },
  {
    id: 'plugin-industry-semiconductor',
    name: 'Semiconductor Industry Pack',
    type: 'industry',
    source: 'official',
    version: '0.9.1',
    status: 'healthy',
    summary: '负责半导体行业路由、分析、Skill / Tool 注册和 MarketMapping 摘要。',
    blockedReason: '无',
    lastError: '无',
    capabilities: [
      'SourceBinding: global wire / channel pricing',
      'AgentDefinition: semiconductor analyst',
      'Skill / Tool: valuation brief / inventory signal',
      'MarketMapping: 设备链、存储链、成熟制程链',
    ],
    relatedEventId: 'evt-semiconductor-foundry',
  },
  {
    id: 'plugin-broker-simulated',
    name: 'Simulated Broker Gateway',
    type: 'broker',
    source: 'runtime',
    version: '0.2.0',
    status: 'installed_but_blocked',
    summary: '仅提供 dry_run / mock 执行能力，受 Approval / Policy Gate 约束。',
    blockedReason: 'broker_runtime_mode=disabled，初版不支持真实执行',
    lastError: '无',
    capabilities: [
      'Broker: disabled / dry_run / mock',
      'Policy Gate: requires approval + capability check',
      'Audit: 保留最近 dry_run 记录和阻断原因',
    ],
  },
]
