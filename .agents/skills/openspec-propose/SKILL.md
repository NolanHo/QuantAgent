---
name: openspec-propose
description: 为 QuantAgent 创建新的 OpenSpec change，并一次性生成可评审、可校验、可实施的 proposal、design、specs 和 tasks。用户要求提 proposal、创建 change、生成 OpenSpec、规划行为/架构/契约变更时使用。
license: MIT
compatibility: Requires openspec CLI.
metadata:
  author: openspec
  version: "1.0"
  generatedBy: "1.3.1"
---

为新的 change 生成 OpenSpec artifacts。默认输出中文正文，同时保留 OpenSpec CLI 必需的英文结构关键字。

需要生成的 artifacts：
- `proposal.md`：为什么现在做、改什么、范围和非目标。
- `design.md`：如何落地、边界、数据流、失败路径和验证。
- `specs/**/spec.md`：可校验的行为需求和场景。
- `tasks.md`：按依赖拆分的实施任务。

准备实现时再使用 `openspec-apply-change`。

---

**输入**: 用户请求应包含 kebab-case change name，或清楚描述要构建/修复的内容。

**QuantAgent 质量门槛**: 生成 artifacts 前必须读取直接相关的项目真源：
- `AGENTS.md` 和受影响路径最近层级的 `AGENTS.md`。
- 用户或任务引用的 `docs/design/*.md`、`docs/prd/*.md`、既有 `openspec/changes/*`、issue 评论和 PR 讨论。
- `.agents/skills/references/engineering-quality-gate.md`.
- `.agents/skills/references/openspec-chinese-artifact-gate.md`.
- 涉及 `apps/web/**` 时读取 `.agents/skills/references/web-architecture-gate.md`。
- Web 变更涉及 feature 结构、复杂 route、shared 能力或文件拆分时读取 `.agents/skills/references/web-file-responsibility-and-feature-structure.md`。
- 涉及 `apps/api/**` 时读取 `.agents/skills/references/api-architecture-gate.md`。
- 涉及 `packages/core/**`、`packages/plugin-sdk/**` 或 `plugins/**` 时读取 `.agents/skills/references/core-and-plugin-architecture-gate.md`。

生成的 artifacts 必须具体到能指导实现，不要产出泛泛的 proposal/design/tasks。凡是影响架构、行为、契约、前端 UI、后端 service、持久化、权限或审计的 change，都必须记录目录/文件规划、分层架构、职责、核心模型、API/DTO/schema/event/config/database 字段草案、复用点、数据流、失败路径和验证入口。

Web 变更必须显式应用 `web-architecture-gate.md`：route 边界、app runtime 所有权、`apiClient -> BaseApi -> FeatureApi`、TanStack Query hooks、业务 hooks、view components、README / usage notes、中文注释和目录分组。复杂 Web feature 还必须应用 `web-file-responsibility-and-feature-structure.md`，让 `design.md` 和 `tasks.md` 写出具体目标文件及职责。不要把这些判断留给实现阶段临场决定。

**中文 OpenSpec 门槛**: 写 artifacts 前必须读取 `.agents/skills/references/openspec-chinese-artifact-gate.md`。Artifact 正文默认中文，但 OpenSpec 语法标记保留英文：`ADDED/MODIFIED/REMOVED/RENAMED Requirements`、`Requirement`、`Scenario`、`SHALL`、`MUST`、`WHEN`、`THEN`、`AND`、`FROM:`、`TO:`。生成或大幅更新 change 后运行 `openspec validate <name> --type change --strict --json`，失败则回改 artifacts 直到通过或说明真实阻塞。

**步骤**

1. **如果输入不清楚，先问要做什么**

   询问：
   > “你想创建哪个 change？请描述要构建或修复的内容。”

   从描述中推导 kebab-case name，例如“增加用户认证” -> `add-user-auth`。

   **重要**：没有理解目标前不要继续。

2. **读取 QuantAgent 真源上下文**

   只读取与本轮直接相关的质量门槛和项目真源。至少包括：
   - Root `AGENTS.md`
   - The nearest `AGENTS.md` for affected app/package/plugin paths
   - `.agents/skills/references/engineering-quality-gate.md`
   - `.agents/skills/references/openspec-chinese-artifact-gate.md`
   - `.agents/skills/references/web-architecture-gate.md` when affected paths or requested scope involve `apps/web/**`
   - `.agents/skills/references/web-file-responsibility-and-feature-structure.md` when a Web change needs feature structure or file splitting decisions
   - `.agents/skills/references/api-architecture-gate.md` when affected paths involve `apps/api/**`
   - `.agents/skills/references/core-and-plugin-architecture-gate.md` when affected paths involve `packages/core/**`, `packages/plugin-sdk/**`, or `plugins/**`
   - Related design/PRD/OpenSpec/issue/PR context named by the user or required by the affected boundary

   如果上下文冲突，把冲突和取舍写入 artifacts，不要静默选择。

3. **创建 change 目录**
   ```bash
   openspec new change "<name>"
   ```
   该命令会在 `openspec/changes/<name>/` 创建带 `.openspec.yaml` 的 scaffold。

4. **获取 artifact 生成顺序**
   ```bash
   openspec status --change "<name>" --json
   ```
   解析 JSON，获取：
   - `applyRequires`：实现前必须完成的 artifact id 列表，例如 `["tasks"]`。
   - `artifacts`：所有 artifacts 的状态和依赖。

5. **按顺序创建 artifacts，直到达到 apply-ready**

   按依赖顺序遍历 artifacts（先处理没有未完成依赖的 artifact）：

   a. **对每个 `ready` artifact（依赖已满足）**：
      - 获取 instructions：
        ```bash
        openspec instructions <artifact-id> --change "<name>" --json
        ```
      - instructions JSON 包含：
        - `context`：项目背景，只作为约束，不复制到输出。
        - `rules`：artifact 专属规则，只作为约束，不复制到输出。
        - `template`：输出文件结构。
        - `instruction`：该 artifact 类型的 schema 指引。
        - `outputPath`：artifact 写入路径。
        - `dependencies`：需要读取的已完成依赖 artifacts。
      - 读取已完成的依赖文件作为上下文。
      - 用 `template` 作为结构创建 artifact 文件。
      - 应用 `.agents/skills/references/openspec-chinese-artifact-gate.md`：
        - 正文默认中文。
        - OpenSpec 结构关键字保留英文。
        - `specs/**/spec.md` 使用合法 delta sections 和 4 个 `#` 的 `#### Scenario:`。
        - `ADDED` 和 `MODIFIED` requirement 正文包含 `SHALL` 或 `MUST`。
        - scenario 行保留 `WHEN` / `THEN` / `AND` 标签。
      - 应用 `.agents/skills/references/engineering-quality-gate.md`：
        - `proposal.md` must cover why now, current gap, non-goals, and risk boundary.
        - `design.md` must be an implementation blueprint covering directory/file planning, layered architecture, module responsibilities, core models, DTO/schema/API/event/config/database field drafts, data flow, failure paths, reuse decisions, and validation strategy.
        - `specs/**/spec.md` must describe verifiable requirements and scenarios, not implementation chores.
        - `tasks.md` must show dependencies, parallel boundaries, write scopes, review gates, and validation actions.
      - Web 变更应用 `.agents/skills/references/web-architecture-gate.md`，让 `design.md` 和 `tasks.md` 写清 route、runtime/API、query/mutation、business hook、component、README、comment 和 validation 边界。
      - 复杂 Web feature 应用 `.agents/skills/references/web-file-responsibility-and-feature-structure.md`，让 artifacts 写清具体 route、api、contracts、query keys、queries、mutations、hooks、components、types、utils 和 README 文件。
      - API 变更应用 `.agents/skills/references/api-architecture-gate.md`，让 `design.md` 和 `tasks.md` 写清 router、service、repository、DTO/envelope、DB operations、caching、concurrency、error handling 和 audit 边界。
      - Core/Plugin 变更应用 `.agents/skills/references/core-and-plugin-architecture-gate.md`，让 `design.md` 和 `tasks.md` 写清 package 依赖方向、plugin layers、DTO contracts、Registry 边界、ORM/Repository 和 performance 边界。
      - 把 `context` 和 `rules` 作为约束使用，但不要复制进 artifact 文件。
      - Show brief Chinese progress: `已创建 <artifact-id>`

   b. **持续创建，直到所有 `applyRequires` artifacts 完成**
      - 每创建一个 artifact 后重新运行 `openspec status --change "<name>" --json`。
      - 检查 `applyRequires` 中每个 artifact id 在 `artifacts` 数组里都是 `status: "done"`。
      - 所有 `applyRequires` 完成后停止。

   c. **如果 artifact 需要用户输入**（关键上下文不清楚）：
      - 先向用户确认
      - 然后继续创建。

6. **校验并展示最终状态**
   ```bash
   openspec validate <name> --type change --strict --json
   openspec status --change "<name>"
   ```
   如果校验失败，先修 artifacts 并重复校验，直到通过或确认存在真实阻塞。

**输出**

完成后用中文总结：
- change name 和位置
- 已创建 artifacts 及用途
- strict validate 结果
- 是否已准备进入实现

**Artifact 创建规则**

- 遵守 `openspec instructions` 返回的 `instruction` 字段。
- schema 决定 artifact 应包含什么，不能自创结构。
- 创建新 artifact 前先读取依赖 artifacts。
- 用 `template` 作为输出结构，并填充各 section。
- 保留模板中的英文 OpenSpec 语法，但把 placeholder 正文改写为中文。
- **重要**：`context` 和 `rules` 是写作约束，不是文件内容。
- 不要把 `<context>`、`<rules>`、`<project_context>` 块复制进 artifact。
- 这些内容只指导写作，不应出现在输出文件里。

**护栏**
- 创建 schema `apply.requires` 定义的全部实现前置 artifacts。
- 创建新 artifact 前必须读取依赖 artifacts。
- 关键上下文不清楚时向用户确认；非关键细节优先做合理判断保持推进。
- 同名 change 已存在时，先确认是继续该 change 还是换名新建。
- 写入后确认 artifact 文件实际存在，再处理下一个。
- 报告完成前运行 `openspec validate <name> --type change --strict --json`。
