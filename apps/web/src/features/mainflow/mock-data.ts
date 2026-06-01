export interface DashboardMetric {
  label: string
  value: string
  trend: string
}

export interface HealthAlert {
  id: string
  title: string
  severity: string
  summary: string
  traceHint: string
}

export interface WalletMetric {
  label: string
  value: string
  tone: 'negative' | 'neutral' | 'positive'
  detail: string
}

export interface WalletBarDatum {
  day: string
  pnl: number
}

export const dashboardMetrics: readonly DashboardMetric[] = [
  { label: '今日半导体事件', value: '05', trend: '较昨日 +2' },
  { label: '待处理审批', value: '03', trend: '1 条将在 20 分钟内过期' },
  { label: '关键健康提醒', value: '02', trend: '1 条影响事件分析成功率' },
  { label: '钱包回撤关注', value: '04', trend: '2 个仓位处于日内亏损区间' },
]

export const healthAlerts: readonly HealthAlert[] = [
  {
    id: 'health-source-1',
    title: '半导体资讯 source 插件连续失败',
    severity: '高',
    summary: '过去 20 分钟内 3 次抓取失败，可能影响事件覆盖完整度。',
    traceHint: 'trace_id: rt-source-412',
  },
  {
    id: 'health-tool-2',
    title: '行业影响分析工具超时率升高',
    severity: '中',
    summary: '最近 10 次分析中 2 次超过 SLA，建议检查 provider fallback。',
    traceHint: 'trace_id: tool-impact-98',
  },
]

export const walletMetrics: readonly WalletMetric[] = [
  {
    label: '账户净值',
    value: '¥ 2,486,300',
    tone: 'neutral',
    detail: '较昨日收盘 -1.8%',
  },
  {
    label: '当日盈亏',
    value: '-¥ 43,200',
    tone: 'negative',
    detail: '亏损主要集中在设备链与功率半导体',
  },
  {
    label: '本周最大回撤',
    value: '-3.9%',
    tone: 'negative',
    detail: '周二午后开始扩大，尚未修复到安全区',
  },
]

export const walletTrend: readonly WalletBarDatum[] = [
  { day: 'Mon', pnl: 18_000 },
  { day: 'Tue', pnl: -24_000 },
  { day: 'Wed', pnl: -39_000 },
  { day: 'Thu', pnl: 12_000 },
  { day: 'Fri', pnl: -43_200 },
]
