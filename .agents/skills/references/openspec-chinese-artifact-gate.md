# OpenSpec Chinese Artifact Gate

本文件是 QuantAgent OpenSpec skill 共用的中文产物与校验门槛。它只约束 OpenSpec 文档生成、更新、评审和归档时的语言、结构和验证方式。

## 语言规则

- OpenSpec 文档主体默认使用中文，包括 `proposal.md`、`design.md`、`tasks.md`、`specs/**/spec.md` 的说明、取舍、验收和任务描述。
- 代码标识、路径、命令、协议字段、capability id、change id、类型名、API path、topic、配置 key 和专有名词可以保留英文。
- OpenSpec 结构关键字必须保留英文，不能翻译为中文：
  - delta section：`## ADDED Requirements`、`## MODIFIED Requirements`、`## REMOVED Requirements`、`## RENAMED Requirements`
  - stable spec section：`## Purpose`、`## Requirements`
  - requirement header：`### Requirement: <name>`
  - scenario header：`#### Scenario: <name>`
  - 规范性词：`SHALL`、`MUST`
  - 场景条件词：`WHEN`、`THEN`、`AND`
  - rename 语法：`FROM:`、`TO:`
- 不要把 `Requirement` 翻成“需求”，不要把 `Scenario` 翻成“场景”，不要把 `SHALL/MUST/WHEN/THEN/AND` 翻成中文。
- Requirement 和 Scenario 的名称可中文、英文或中英混合；优先使用能让维护者快速定位行为边界的中文名称。

## Delta Spec 可校验格式

`openspec/changes/<change-id>/specs/<capability>/spec.md` 必须使用 delta spec 结构：

```markdown
## ADDED Requirements

### Requirement: <中文或中英混合名称>
<中文正文，必须包含 SHALL 或 MUST>

#### Scenario: <中文或中英混合名称>
- **WHEN** <中文条件>
- **THEN** <中文结果>
- **AND** <中文附加结果>
```

生成或修改 delta spec 时必须遵守：

- 每个 `spec.md` 至少包含一个 delta section：`ADDED`、`MODIFIED`、`REMOVED` 或 `RENAMED`。
- `ADDED` 和 `MODIFIED` 下每个 requirement 必须有正文，且正文必须包含 `SHALL` 或 `MUST`。
- 每个 `ADDED` 和 `MODIFIED` requirement 至少包含一个 `#### Scenario:`。这里必须是 4 个 `#`，不是 3 个。
- Scenario 行推荐使用 `- **WHEN**`、`- **THEN**`、`- **AND**`。OpenSpec CLI 主要校验 scenario 块存在，但 QuantAgent 统一要求保留 WHEN/THEN/AND 作为可读验收格式。
- `MODIFIED` 必须复制 stable spec 中整个原 requirement block 后再修改，不能只写被改动的几行。
- `REMOVED` 必须保留英文 section 和 requirement header；同时用中文写清 `**Reason**` 与 `**Migration**`。
- `RENAMED` 只做改名，使用 `FROM:` / `TO:` 指向完整 requirement header；不要在同一块里混入行为变化。
- 同一个 spec 文件内不要让同名 requirement 同时出现在 `ADDED`、`MODIFIED`、`REMOVED` 或 `RENAMED` 的冲突组合中。

## Stable Spec 可校验格式

`openspec/specs/<capability>/spec.md` 必须使用 stable spec 结构：

```markdown
## Purpose

<中文目的说明>

## Requirements

### Requirement: <中文或中英混合名称>
<中文正文，必须包含 SHALL 或 MUST>

#### Scenario: <中文或中英混合名称>
- **WHEN** <中文条件>
- **THEN** <中文结果>
```

归档或同步 spec 时必须保持：

- `## Purpose` 和 `## Requirements` 使用英文 section 名。
- 每个 requirement 保留 `### Requirement:` header。
- 每个 requirement 正文保留至少一个 `SHALL` 或 `MUST`。
- 每个 requirement 至少有一个 `#### Scenario:`。

## 产物内容要求

- `proposal.md` 用中文说明 why now、当前缺口、范围、非目标、风险边界和能力变化。
- `design.md` 用中文说明实现蓝图、目录/文件规划、职责分层、核心模型、DTO/schema/API/事件/配置/数据库字段草案、数据流、失败路径、复用取舍和验证策略。
- `tasks.md` 用中文写任务，必须体现依赖关系、可并行边界、写入范围、review gate 和验证动作；不要只写线性施工口号。
- `specs/**/spec.md` 只描述可验证行为和契约，不写实现流水账、任务拆分或 PR 说明。
- 如果英文模板或 CLI instruction 与本文件冲突，保留模板的结构关键字，但正文按本文件改写为中文。

## 必跑校验

新建或大幅更新 OpenSpec change 后必须运行：

```bash
openspec validate <change-id> --type change --strict --json
```

校验失败时必须先根据 JSON 错误回改 artifacts，再重复运行，直到通过或明确说明阻塞原因。不要只因为文档“看起来对”就进入实现或 PR。

归档或同步到 stable spec 后，至少运行受影响 spec 的 strict 校验：

```bash
openspec validate <capability> --type spec --strict --json
```

如果本轮只做 OpenSpec skill 或 reference 文档维护，不产生具体 change，可以用 `openspec validate --specs --strict --json` 作为现有 stable spec 抽样/整体健康检查；校验失败不一定由本轮引入，但最终说明中必须写清楚。
