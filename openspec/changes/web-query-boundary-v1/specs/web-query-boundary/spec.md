## ADDED Requirements

### Requirement: Shared Query Foundation Owns Web Query Base Conventions

系统 SHALL 为 `apps/web` 提供独立的共享 query 基础入口，用于承接共享 root key、最小类型安全 helper、默认策略 usage note 和目录边界说明，而不是继续让公共 query 规则散落在各个 feature 中。

#### Scenario: shared/query becomes the shared base entry
- **WHEN** 后续实现者为 `apps/web` 新增共享 query 基础能力
- **THEN** 共享入口位于 `src/shared/query/`
- **AND** 该目录负责共享 root key、最小 helper 和 README / usage note
- **AND** 该目录不承载业务 API、页面状态、FeatureApi endpoint、业务 query hook 或具体页面语义

#### Scenario: shared/query documents what it excludes
- **WHEN** 后续实现者新增或扩展 `src/shared/query/`
- **THEN** 目录说明必须写清负责什么、公开导出是什么、不要继续往里面放什么
- **AND** 不得把业务 invalidate 规则、页面筛选状态或具体 feature DTO 下沉到共享 query 基础层

### Requirement: QueryClient Defaults Are Explicit And Overrideable

系统 SHALL 通过 `createAppQueryClient()` 显式定义 Web QueryClient 的默认缓存策略，并允许调用方在同一入口上覆盖默认值，而不是继续依赖库默认行为隐式漂移。

#### Scenario: createAppQueryClient explicitly defines default query policy
- **WHEN** 应用运行时或测试创建 QueryClient
- **THEN** 必须通过 `createAppQueryClient()` 创建实例
- **AND** 默认策略至少显式定义 `queries.staleTime`、`queries.retry` 和 `queries.gcTime`
- **AND** 不依赖 TanStack Query 的隐式默认 `gcTime` 作为仓库长期行为

#### Scenario: callers can override defaults without bypassing the factory
- **WHEN** 测试或特定运行场景需要调整 QueryClient 默认策略
- **THEN** 调用方可以通过 `createAppQueryClient()` 的配置入口覆盖默认值
- **AND** 不需要绕过该工厂自行构造业务运行时 QueryClient

### Requirement: Business Query Calls Follow The Runtime API Chain

系统 SHALL 将 Web 业务查询调用链固定为 `app/runtime -> FeatureApi -> queries/mutations -> business hooks -> page components`，禁止 route、page 或 shared UI 直接承担业务查询和底层传输职责。

#### Scenario: feature query hooks use runtime-owned APIs
- **WHEN** 后续实现者新增业务 query hook 或 mutation hook
- **THEN** hook 通过 runtime 的稳定 `apis` 对象访问 FeatureApi
- **AND** 不在 hook 内局部创建业务 API 实例
- **AND** 不直接在 hook、page 或 shared UI 中持有底层 transport 细节

#### Scenario: route and page do not own business query boundaries
- **WHEN** 后续实现者新增或修改 route、page component 或 shared UI
- **THEN** route 只负责页面入口、search params、loader、beforeLoad 和页面组合
- **AND** page component 和 shared UI 不直接定义业务 query key、envelope unwrap 或 API 实例
- **AND** 不允许为了页面落地继续在 route 或 component 中散落新的临时业务查询边界

### Requirement: New Top-Level Resource Keys Must Register Through Shared Query Roots

系统 SHALL 将一级资源 query root key 的所有权收口到共享 query 基础入口，后续 feature 只能在共享 root key 之上继续扩展资源内部细分。

#### Scenario: new resources register shared root keys first
- **WHEN** 后续实现者新增 `models`、`events`、`plugins`、`runtime`、`approvals`、`skills`、`tools`、`industries` 或 `settings` 的业务查询能力
- **THEN** 对应一级资源的 root key 先在 `shared/query` 中定义并导出
- **AND** feature-local keys 基于共享 root key 扩展 list、detail、config、schema、timeline、health、overview 等资源内部层级

#### Scenario: feature-local keys keep internal ownership only
- **WHEN** feature 需要定义更细粒度的 list、detail、config 或 schema keys
- **THEN** 这些 keys 仍保留在所属 feature 的 `queries/*.keys.ts`
- **AND** feature-local key 只负责该资源内部细分和 mutation invalidation 所需的稳定片段
- **AND** 不得再次在 feature 内重新发明新的一级资源 root key 语义

### Requirement: Query Key Alignment Uses Incremental Migration With A Models Reference

系统 SHALL 采用“新增强约束、历史渐进迁移”的对齐策略，并以 `features/models` 作为 shared/query 接入样板，而不是要求一次性全量重写历史 query 文件。

#### Scenario: new work must adopt the shared entry even when legacy keys remain
- **WHEN** 仓库中仍存在历史 feature-local query key
- **THEN** 新增页面和新资源查询必须优先使用共享 root key 入口
- **AND** 历史 keys 可以暂时保留
- **AND** 不允许以历史债务为理由继续新增新的临时根层级 key

#### Scenario: models acts as the alignment reference
- **WHEN** 后续实现者需要一个现成样板来接入 shared/query
- **THEN** `features/models` 作为共享 root key 与 feature-local 细分 key 共存的正式示例
- **AND** 它继续保留 feature 内的 queries、mutations 和 invalidation 组织方式
- **AND** 其根层级对齐方式应成为后续 `/plugins`、`/runtime`、`/events` 等页面实现的复用参考

#### Scenario: plugins config-form may remain local until touched by broader plugin queries
- **WHEN** `features/plugins/config-form` 仅维护局部 schema/config 查询能力且未引入更广泛的插件页面查询重组
- **THEN** 它可以暂时保留局部 key
- **AND** 当插件列表、详情、配置等能力在同一实现中并行推进时
- **AND** 必须同步对齐到共享 `plugins` root key 边界
