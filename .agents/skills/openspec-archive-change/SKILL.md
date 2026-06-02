---
name: openspec-archive-change
description: 归档已完成的 QuantAgent OpenSpec change，并在归档前检查 artifacts、tasks、delta spec 同步和中文/英文语法边界。用户要求 finalize、archive、归档 change 或同步 stable spec 时使用。
license: MIT
compatibility: Requires openspec CLI.
metadata:
  author: openspec
  version: "1.0"
  generatedBy: "1.3.1"
---

归档已完成的 OpenSpec change。归档前必须确认 delta spec 与 stable spec 的中文正文和英文 OpenSpec 语法都可校验。

**输入**: 可指定 change name。未指定或不明确时必须让用户选择。

**QuantAgent OpenSpec 门槛**: 同步 specs 前读取 `.agents/skills/references/openspec-chinese-artifact-gate.md`。Stable spec 正文默认中文，但 `## Purpose`、`## Requirements`、`Requirement`、`Scenario`、`SHALL`、`MUST`、`WHEN`、`THEN`、`AND` 必须保留英文。归档或同步后运行受影响 spec 的 strict validate；失败则先修 spec。

**步骤**

1. **如果没有 change name，先让用户选择**

   运行 `openspec list --json` 获取可用 changes，并让用户选择。

   只展示 active changes，不展示已归档 changes。可用时附带每个 change 使用的 schema。

   **重要**：不要猜测或自动选择 change。

2. **检查 artifact 完成状态**

   运行 `openspec status --change "<name>" --json` 检查 artifact 完成状态。

   解析 JSON，理解：
   - `schemaName`：当前 workflow。
   - `artifacts`：artifacts 列表及其状态。

   **如果存在未 `done` 的 artifacts：**
   - 展示 warning，列出未完成 artifacts。
   - 向用户确认是否继续。
   - 用户确认后才继续。

3. **检查 task 完成状态**

   读取 tasks 文件（通常是 `tasks.md`），检查未完成 tasks。

   统计 `- [ ]`（未完成）和 `- [x]`（已完成）的数量。

   **如果发现未完成 tasks：**
   - 展示 warning 和未完成数量。
   - 向用户确认是否继续。
   - 用户确认后才继续。

   **如果没有 tasks 文件：** 不展示 task warning，继续。

4. **评估 delta spec 同步状态**

   检查 `openspec/changes/<name>/specs/` 是否存在 delta specs。没有 delta specs 时不需要同步提示。

   **如果存在 delta specs：**
   - 读取 `.agents/skills/references/openspec-chinese-artifact-gate.md`
   - Compare each delta spec with its corresponding main spec at `openspec/specs/<capability>/spec.md`
   - Determine what changes would be applied (adds, modifications, removals, renames)
   - 同步时保留中文正文和英文 OpenSpec 语法
   - 确认前展示合并摘要

   **提示选项：**
   - 需要同步时：`现在同步（推荐）`、`不更新 stable spec 直接归档`
   - 已经同步时：`现在归档`、`仍然重新同步`、`取消`

   如果用户选择同步，按 delta spec 分析结果把变更合入对应 `openspec/specs/<capability>/spec.md`。无论是否同步，都按用户选择继续归档或取消。

5. **执行归档**

   如果 archive 目录不存在，先创建：
   ```bash
   mkdir -p openspec/changes/archive
   ```

   使用当前日期生成目标名：`YYYY-MM-DD-<change-name>`。

   **检查目标目录是否已存在：**
   - 已存在：失败并建议重命名已有 archive 或使用其他日期。
   - 不存在：把 change 目录移动到 archive。

   ```bash
   mv openspec/changes/<name> openspec/changes/archive/YYYY-MM-DD-<name>
   ```

6. **校验并展示摘要**

   如果存在 delta specs，同步/归档后校验受影响 specs：
   ```bash
   openspec validate <capability> --type spec --strict --json
   ```

   如果校验失败，先修正同步后的 stable spec，再报告成功。

   摘要需要包含：
   - change name。
   - 使用的 schema。
   - archive 位置。
   - specs 是否同步。
   - 未完成 artifacts/tasks 等 warning。

**成功输出**

```
## 归档完成

**Change:** <change-name>
**Schema:** <schema-name>
**Archived to:** openspec/changes/archive/YYYY-MM-DD-<name>/
**Specs:** 已同步到 stable specs（或 “无 delta specs” / “跳过同步”）

所有 artifacts 和 tasks 已完成。
```

**护栏**
- 未指定 change 时必须让用户选择。
- 使用 artifact graph（`openspec status --json`）检查完成状态。
- warning 不必强制阻塞归档，但必须告知并确认。
- 移动 archive 时保留 `.openspec.yaml`。
- 同步 specs 时保留中文正文和英文 OpenSpec 语法。
- 用 `openspec validate <capability> --type spec --strict --json` 校验受影响 stable specs。
- 清楚总结发生了什么。
- 存在 delta specs 时，必须先做同步评估并展示合并摘要，再让用户决定。
