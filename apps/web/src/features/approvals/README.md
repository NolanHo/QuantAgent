## approvals feature

负责 QuantAgent Web 审批工作台 V1：

- `/approvals`
- `/approvals/:approvalId`
- `/approval-link/:token`
- Dashboard 中的审批摘要卡片复用

入口：

- route: `src/routes/_app/(workspace)/approvals/**`
- public route: `src/routes/(public)/approval-link/$token.tsx`

当前职责：

- `api/`: `/api/v1/approvals` DTO、endpoint 和 UI model mapper
- `queries/`: 审批列表、详情和概览读取入口
- `mutations/`: 审批动作提交与 query invalidation
- `mock/`: 测试 fixture 和首版 approval-link token 占位数据，不作为 `/approvals` 默认页面数据源
- `hooks/`: 审批工作台页面级业务 hook，组织筛选、批量选择和动作编排
- `components/`: 列表、详情、授权页、状态组件和动作弹窗
- `types/`: 审批 UI 局部类型与 search 类型
- `utils/`: 排序、标签、批量资格判断等纯函数

不负责：

- live trading、broker 执行结果或 Policy Gate 后端实现
- Dashboard 其他业务域逻辑

不要继续放入：

- 不要在 route 文件里直接堆审批列表主体 JSX
- 不要让 `/approvals` 工作台 query 回退到 mock store
- 不要把真实 API 假设、执行成功文案、可误触发的批量动作或外部消息审批入口直接混进首版页面
