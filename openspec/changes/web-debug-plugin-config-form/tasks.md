# Tasks: Web Debug Plugin Config Form

## 1. OpenSpec And Contract Alignment

- [ ] 1.1 复核 issue #119、#99、#115、#116、#117 与现有 `web-debug-route-workbench` spec，确认 `/debug` 首版插件配置表单的范围、非目标和阻塞项。
- [ ] 1.2 完成 `web-debug-plugin-config-form` change 的 proposal、design、specs 和 tasks，并通过 `openspec validate web-debug-plugin-config-form --type change --strict --json`。
- [ ] 1.3 在 OpenSpec-only PR 说明中明确 Zod 优先来源链路、mock 允许边界、production 排除边界和“不是正式 `/plugins` 功能”的证据链。

## 2. Route Shell And Boundary Setup

- [ ] 2.1 在 `apps/web/src/routes/**` 新增 development-only `/debug/plugin-config-form` 子路由，并在 `/debug` 根页增加入口索引。
- [ ] 2.2 复用现有 debug route gating，确保 production router 不注册该路由且 production bundle 不包含页面模块。
- [ ] 2.3 为调试页定义最小页面骨架与状态分区，保证 schema 预览、表单区和状态反馈不会污染正式导航与业务页面。

## 3. Shared Data Flow And Mock Isolation

- [ ] 3.1 在 `apps/web/src/shared/api/**` 或 `apps/web/src/features/plugins/**` 中定义 `config-schema`、当前配置、校验、保存的共享 API/query/mutation 边界。
- [ ] 3.2 如果后端接口未 ready，增加仅供 debug/测试使用的稳定 mock adapter，并避免页面组件直接分叉真实接口与 mock 逻辑。
- [ ] 3.3 统一字段级校验错误映射、保存成功/失败反馈和 request error 展示方式，保持与既有 API envelope 处理一致。

## 4. Schema-Driven Renderer And Sensitive Field Semantics

- [ ] 4.1 选择并实现首版受控 schema-driven form renderer，不允许插件注入自定义前端组件。
- [ ] 4.2 以内置复杂 Zod 样例验证嵌套对象、数组、record、discriminated union、default、敏感字段掩码等结构的渲染结果。
- [ ] 4.3 为 unsupported 或 degraded 的 schema 结构提供显式提示，而不是静默失败或插件特例分支。
- [ ] 4.4 落实敏感字段“掩码展示 + 显式替换”语义，确保页面、日志、错误提示和测试快照不泄露 secret 明文。

## 5. Verification And Documentation

- [ ] 5.1 补充最小测试，覆盖 debug 路由可达性、复杂 schema 字段映射、字段级校验错误、保存流程和敏感字段脱敏。
- [ ] 5.2 运行与改动范围匹配的验证命令：`bun run --cwd apps/web test:unit`、`bun run --cwd apps/web test:ct`、`bun run --cwd apps/web test:e2e`、`bun run lint`、`bun run build --filter=web`。
- [ ] 5.3 更新 `apps/web/README.md` 或等价说明，记录该 debug 页用途、Zod 首版兼容范围、mock 使用边界和迁入正式页面前的限制。
