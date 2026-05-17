## Context

当前分支的 `openspec/changes/archive/` 只剩 `.gitkeep`，但 git 历史表明至少有一组归档文件已经写入过仓库：

- `openspec/changes/archive/2026-05-16-add-vitest-node-runner/proposal.md`
- `openspec/changes/archive/2026-05-16-add-vitest-node-runner/tasks.md`
- `openspec/changes/archive/2026-05-16-add-vitest-node-runner/specs/add-vitest-node-runner/spec.md`

这些文件不应该因为 rooted OpenSpec 目录迁移、分支同步或文档整理而被省略。

## Approach

1. 从 git 历史中恢复当前分支缺失的归档文件，保持原始路径与内容不变。
2. 为 archive 历史保留增加一条最小 spec，明确：
   - `openspec/changes/archive/` 是 rooted OpenSpec 的一部分；
   - 迁移、重命名或同步时必须保留已经存在的归档子目录与文件；
   - 不允许仅迁移 `.gitkeep` 而丢失已归档 change 内容。
3. 通过 OpenSpec validate 和 git diff 验证恢复结果。

## Tradeoffs

- 本次修复选择直接恢复已经存在于 git 历史的文件，而不是重新生成归档内容。这样可以避免引入与历史记录不一致的新文本。
- 当前只恢复已确认缺失的归档目录；如果后续发现更多 archive 内容在其他分支或提交中丢失，需要按同样方式补回。

## Verification

- `git ls-tree -r --name-only HEAD openspec/changes/archive`
- `openspec validate restore-openspec-archive-history --type change --strict --json`
- `git diff --stat`
