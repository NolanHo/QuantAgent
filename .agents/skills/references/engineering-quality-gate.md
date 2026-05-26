# Engineering Quality Gate

本文件是 QuantAgent gh / OpenSpec skills 共用的工程质量门槛。它不是模板素材，而是执行前必须通过的检查清单。

## 真源读取

开始 issue、OpenSpec、实现或 PR 前，必须先读与本轮范围直接相关的真源：

- 根目录 `AGENTS.md` 和被修改路径最近层级的 `AGENTS.md`。
- 关联 issue 正文、评论、PR 讨论和 review finding。
- 相关 `docs/design/`、`docs/prd/`、`openspec/changes/<change-id>/` 或 stable spec。
- 目标模块现有实现、测试和 README；涉及较新库时再查 lockfile、已安装版本和官方文档。

如果真源之间冲突，先说明冲突和取舍，不得直接按模型记忆或个人偏好实现。

## 架构分层检查

新功能、跨文件改动或行为变化必须在进入实现前说清：

- 职责边界：哪些逻辑属于 route/page、service/provider、repository/port、schema/DTO、shared UI 或 package。
- 目录蓝图：计划新增或修改哪些目录、文件和模块，每个文件承担什么职责，是否需要新增 `AGENTS.md`、README、测试或生成入口。
- 复用点：哪些能力已经存在，哪些需要新增共享抽象，哪些不应提前抽象。
- 模型与接口：核心 model、DTO、schema、API、事件、配置、数据库字段或 TypeScript 类型的字段草案和所有权。
- 数据流：输入、状态真源、输出、错误路径和恢复方式。
- 失败路径：权限不足、外部依赖失败、配置缺失、并发或幂等风险。
- 验证入口：最小测试、契约检查、构建或人工验收方式。

禁止把页面、路由、服务、DTO、状态管理、API 调用和业务规则混写成一个大文件。只有存在多实现、稳定接口、外部适配、可替换策略、生命周期或持久化边界时，才引入 service、repository、port、adapter、strategy、registry、base class 等结构；不要为了设计模式本身制造抽象。

## 前端质量门槛

涉及 `apps/web` 时必须检查：

- HeroUI v3 是基础组件库；按钮、输入、弹窗、表格、菜单、tabs、toast、tooltip 等优先 HeroUI。
- 样式默认使用 TailwindCSS 和现有 token；`*.module.css` 只用于 Tailwind 明显不适合的局部复杂样式。
- route 只负责页面入口、loader、search params 和组合；业务 query、mutation、组件、局部类型进入 `features/*`；跨模块基础能力进入 `shared/*`。
- 页面出现可复用区块、复杂状态、表单、表格、timeline、risk panel、权限状态、错误/空/加载态时，必须拆成命名组件和必要 hooks。
- 服务端状态必须通过 TanStack Query；页面不得裸 `fetch` 或手写后端 envelope / error 处理。
- 新 UI 必须覆盖 loading、empty、error、permission denied、sensitive masked 等状态，并保持管理台风格。

## 后端质量门槛

涉及 Python/API/core 时必须检查：

- FastAPI router 保持薄层，只处理 HTTP 参数、DTO、状态码、响应信封、依赖注入和异常映射。
- 业务流程、状态变化、插件生命周期、审计、权限、数据库写入或外部适配必须有明确 service/provider/repository/port 边界。
- DTO、ORM model、领域对象、插件 DTO、API envelope 分层独立，不能互相替代。
- 跨 app 复用能力优先下沉到 package；API 私有能力保留在 `apps/api`。
- Repository / storage port 只在存在真实持久化、跨调用复用或插件隔离需求时引入。
- 关键状态变化、高风险动作和人工确认必须可审计。

## 注释门槛

代码不需要解释显而易见的语句，但这些地方必须写短注释说明意图或取舍：

- 安全边界、权限、审计、状态机、并发、幂等、重试、降级和敏感信息脱敏。
- 协议适配、第三方 API 差异、框架限制、生成物边界和非显然兼容策略。
- 为避免提前抽象而刻意保留简单实现，或为复用/扩展而引入抽象的理由。

注释应说明“为什么这样做”，不要复述代码在做什么。

## OpenSpec 质量门槛

OpenSpec artifacts 必须能指导实现，不能只是空泛愿景：

- `proposal.md` 说明 why now、当前缺口、非目标和风险边界。
- `design.md` 是实现蓝图，必须说明目录/文件规划、分层架构、模块职责、核心模型、DTO/schema/API/事件/配置/数据库字段草案、数据流、失败路径、复用/不复用的取舍和验证策略。
- `specs/**/spec.md` 用 requirement 和 scenario 描述可验证行为，不写实现流水账。
- `tasks.md` 体现依赖关系、可并行边界、写入范围、review gate 和验证动作。

如果 artifacts 没有说明目录/文件规划、职责边界、核心模型与接口字段、复用点、失败路径或验证方式，不能进入实现；先补强 artifacts 或向维护者追问。

## PR 证据链门槛

PR 说明必须写清：

- 关联 issue / OpenSpec change / 设计文档依据。
- 为什么这样拆分，为什么新增或不新增抽象。
- 改动摘要按边界组织，不按文件流水账。
- 实际运行的验证命令和结果。
- 未验证项、残余风险、非目标，以及跳过组件拆分、注释或抽象的理由。
