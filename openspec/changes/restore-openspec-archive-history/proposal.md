## Why

`openspec/changes/archive` 下已经归档的 change 文件在后续目录迁移或同步过程中从当前分支消失，导致历史归档记录不完整。需要恢复这些文件，并补一条明确约束，确保 rooted OpenSpec 迁移或整理时不会遗漏 archive 内容。

## What Changes

- 恢复 `openspec/changes/archive` 中已经存在于 git 历史、但当前分支缺失的归档文件。
- 为 rooted OpenSpec 的 archive 内容补一条规范约束，要求目录迁移、整理或同步时保留完整归档树，而不只保留占位文件。
- 增加针对本次恢复的验证步骤，确保归档内容在当前分支重新可见。

## Capabilities

### New Capabilities
- `openspec-archive-history`: 约束 OpenSpec 归档历史在目录迁移和仓库整理时必须被完整保留。

### Modified Capabilities

## Impact

- 影响目录：`openspec/changes/archive/**`、`openspec/changes/restore-openspec-archive-history/**`
- 影响系统：仓库内 rooted OpenSpec 文档资产与后续 archive 操作/迁移操作
- 验证方式：`openspec validate restore-openspec-archive-history --type change --strict --json` 与 git 差异检查
