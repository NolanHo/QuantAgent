# OpenSpec Archive History Specification

## ADDED Requirements

### Requirement: Archived Changes Are Preserved In Rooted OpenSpec

`openspec/changes/archive/` SHALL 保留已经归档的 change 目录及其文件，而不是只保留占位目录。

#### Scenario: Rooted OpenSpec migration keeps archived files

- **WHEN** 仓库将 OpenSpec 目录迁移、重命名或从其他位置移动到 rooted `openspec/`
- **THEN** 已存在的 `openspec/changes/archive/<date>-<change-name>/` 子目录必须一并迁移
- **AND** 其中的 `proposal.md`、`tasks.md`、`specs/**` 等归档文件必须保留
- **AND** 不得仅保留 `.gitkeep`

#### Scenario: Repository cleanup does not drop archived change content

- **WHEN** 开发者执行 OpenSpec 目录整理、同步或文档清理
- **THEN** 已在版本历史中的 archived change 内容仍然存在于当前分支树中
- **AND** 可以通过常规 git 路径浏览到这些文件

### Requirement: Archive Recovery Uses Historical Source Of Truth

归档内容缺失时，恢复过程 SHALL 以 git 历史中的已归档文件为准。

#### Scenario: Missing archived files are restored from history

- **WHEN** 当前分支缺少某个已经提交过的 archived change 目录
- **THEN** 恢复后的路径与文件内容应与历史归档记录一致
- **AND** 不要求重新生成新的 archive 文本替代历史内容
