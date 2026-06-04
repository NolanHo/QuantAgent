---
name: openspec-apply-change
description: 按 QuantAgent OpenSpec change 实施任务。用户要求开始实现、继续实现、推进 tasks、或基于已审核 OpenSpec 写代码时使用；实现前会检查中文 artifacts、工程质量 gate 和 strict validate 状态。
license: MIT
compatibility: Requires openspec CLI.
metadata:
  author: openspec
  version: "1.0"
  generatedBy: "1.3.1"
---

按 OpenSpec change 实施任务。实现前必须确认 artifacts 是中文正文、英文 OpenSpec 语法、并能通过 strict validate。

**输入**: 可指定 change name。未指定时从上下文推断；如果不明确，必须让用户选择。

**QuantAgent 质量门槛**: 实现前读取 `.agents/skills/references/engineering-quality-gate.md` 和 `.agents/skills/references/openspec-chinese-artifact-gate.md`，确认所选 change artifacts 已准备好实施并通过 strict validate。涉及 `apps/web/**` 时读取 `.agents/skills/references/web-architecture-gate.md`。复杂 Web feature、route、shared 能力或文件拆分还要读取 `.agents/skills/references/web-file-responsibility-and-feature-structure.md`。涉及 `apps/api/**` 时读取 `.agents/skills/references/api-architecture-gate.md`。涉及 `packages/core/**`、`packages/plugin-sdk/**` 或 `plugins/**` 时读取 `.agents/skills/references/core-and-plugin-architecture-gate.md`。如果 artifacts 正文主要是英文，先更新为 QuantAgent 中文 artifact 风格。如果 artifacts 没有说明目录/文件规划、职责、核心模型、接口字段、复用点、数据流、失败路径和验证入口，先暂停并建议补 artifacts，不要直接写代码。

**步骤**

1. **选择 change**

   如果用户提供了 name，直接使用。否则：
   - 用户在上下文中提到 change 时，从上下文推断。
   - 只有一个 active change 时可以自动选择。
   - 多个候选且不明确时运行 `openspec list --json`，列出候选并让用户选择。

   始终说明：`使用 change: <name>`，以及如何改用其他 change。

2. **检查状态并理解 schema**
   ```bash
   openspec status --change "<name>" --json
   ```
   解析 JSON，理解：
   - `schemaName`：当前 workflow，例如 `spec-driven`。
   - 哪个 artifact 包含 tasks；spec-driven 通常是 `tasks`，其他 schema 以 status 为准。

3. **获取 apply instructions**

   ```bash
   openspec instructions apply --change "<name>" --json
   ```

   返回内容包括：
   - `contextFiles`：artifact id 到具体文件路径数组的映射。
   - progress：总数、已完成、剩余。
   - 带状态的 task list。
   - 当前状态对应的动态 instruction。

   **状态处理：**
   - `state: "blocked"`：说明缺失 artifacts，建议先补 artifacts。
   - `state: "all_done"`：说明已全部完成，建议归档。
   - 其他状态：继续实施。

4. **读取上下文文件**

   读取 apply instructions 输出中 `contextFiles` 列出的每个文件路径。
   文件取决于 schema：
   - **spec-driven**：通常包括 proposal、specs、design、tasks。
   - 其他 schema：以 CLI 输出的 `contextFiles` 为准。

   另外读取 `.agents/skills/references/engineering-quality-gate.md`、`.agents/skills/references/openspec-chinese-artifact-gate.md`、根 `AGENTS.md`，以及任务会触碰路径最近层级的 `AGENTS.md`。Web 任务读取 `.agents/skills/references/web-architecture-gate.md`；复杂 Web feature 结构或文件拆分读取 `.agents/skills/references/web-file-responsibility-and-feature-structure.md`。API 任务读取 `.agents/skills/references/api-architecture-gate.md`。Core/Plugin/SDK 任务读取 `.agents/skills/references/core-and-plugin-architecture-gate.md`。

5. **运行 OpenSpec 与工程质量 gate**

   先运行：
   ```bash
   openspec validate <name> --type change --strict --json
   ```

   如果因为 artifact 语法或英文正文漂移导致校验失败，先更新同一个 change 的 artifacts，再进入实现。更新时保留英文 OpenSpec 语法标记，但正文使用中文。

   改文件前检查 artifacts 和本地规则是否回答：
   - 每个职责归属哪个模块。
   - 会新增或修改哪些目录和文件，每个文件负责什么。
   - 需要哪些 core models、DTO/schema/API/event/config/database 字段。
   - 哪些现有代码或共享能力应复用。
   - 数据流、状态真源、错误路径和恢复路径是什么。
   - 前端 component/state 边界或后端 service/repository/port 边界是什么。
   - 每个有意义切片完成后要跑什么验证。
   - Web 任务是否写清 route、app runtime、API/BaseApi/FeatureApi、query/mutation、business hook、component、README、中文注释和目录分组边界。
   - 复杂 Web 任务是否写清具体 route、api、contracts、query keys、queries、mutations、hooks、components、types、utils 和 README 文件。

   如果答案缺失或矛盾，暂停并建议更新同一个 change 的 proposal/design/tasks/specs，不要在实现中猜。

6. **展示当前进度**

   展示：
   - 当前 schema。
   - 进度：`N/M tasks complete`。
   - 剩余 tasks 概览。
   - CLI 返回的动态 instruction。

7. **实施 tasks（直到完成或阻塞）**

   对每个 pending task：
   - 说明正在处理哪个 task。
   - 完成该 task 所需代码变更。
   - 保持变更最小且聚焦。
   - 完成后立即把 tasks 文件中对应 checkbox 从 `- [ ]` 改为 `- [x]`。
   - 继续下一个 task。

   **以下情况暂停：**
   - Task 不清楚：先澄清。
   - 实现暴露设计问题：建议更新 artifacts。
   - 遇到错误或阻塞：报告并等待指引。
   - 用户中断。

8. **完成或暂停时展示状态**

   展示：
   - 本轮完成的 tasks。
   - 总进度：`N/M tasks complete`。
   - 全部完成时建议归档。
   - 暂停时说明原因并等待指引。

**实施中输出**

```
## 正在实施: <change-name> (schema: <schema-name>)

正在处理任务 3/7: <task description>
[...implementation happening...]
任务完成

正在处理任务 4/7: <task description>
[...implementation happening...]
任务完成
```

**完成输出**

```
## 实施完成

**Change:** <change-name>
**Schema:** <schema-name>
**Progress:** 7/7 tasks complete

### 本轮完成
- [x] Task 1
- [x] Task 2
...

所有任务已完成，可以准备归档。
```

**暂停输出**

```
## 实施暂停

**Change:** <change-name>
**Schema:** <schema-name>
**Progress:** 4/7 tasks complete

### 遇到的问题
<description of the issue>

**可选处理方式:**
1. <option 1>
2. <option 2>
3. 其他方案

你希望怎么处理？
```

**护栏**
- 持续推进 tasks，直到完成或阻塞。
- 开始前必须读取 apply instructions 输出的 `contextFiles`。
- 实现前必须运行 `openspec validate <name> --type change --strict --json`。
- 更新 artifacts 时保持中文正文和英文 OpenSpec 语法标记。
- 实现前必须运行工程质量 gate。
- task 含糊时暂停澄清，不要猜。
- 实现暴露问题时暂停并建议更新 artifacts。
- 代码变更保持最小并围绕当前 task。
- 完成 task 后立即更新 checkbox。
- 遇到错误、阻塞或需求不清时暂停。
- 使用 CLI 输出的 `contextFiles`，不要假设固定文件名。

**流动工作流集成**

本 skill 支持围绕同一个 change 流动推进：

- **可随时调用**：只要存在 tasks，可以在 artifacts 完成前、部分实现后或其他动作之间使用。
- **允许更新 artifacts**：实现暴露设计问题时，建议更新同一个 change 的 artifacts；不要被阶段僵化限制。
