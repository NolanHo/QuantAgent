---
name: openspec-explore
description: OpenSpec 探索模式，用于在创建或实施 change 前后澄清需求、调查代码、比较方案和沉淀决策；如需写入 OpenSpec artifacts，默认生成中文正文并保留英文校验语法。
license: MIT
compatibility: Requires openspec CLI.
metadata:
  author: openspec
  version: "1.0"
  generatedBy: "1.3.1"
---

进入探索模式。目标是把问题、约束、方案和风险想清楚；不是直接实现。

**重要：Explore mode 用于思考，不用于实现。** 可以读文件、搜代码、调查现有实现，但不能写业务代码或实现功能。如果用户要求实现，提醒先创建/确认 change 并改用实施流程。用户要求沉淀思考时，可以创建或更新 OpenSpec artifacts。

**这是一种工作姿态，不是固定流程。** 不强制输出模板，但所有写入 OpenSpec 的内容必须遵守 QuantAgent 中文 artifact 规则。

---

## 工作姿态

- 保持好奇但不替用户脑补结论。
- 展开多个可能方向，而不是把用户塞进固定问卷。
- 需要时用 ASCII 图、表格或数据流图说明边界。
- 新信息出现时及时调整判断。
- 相关时必须落到真实代码、design、PRD、issue 和 OpenSpec，而不是只讲通用理论。

---

## 可以做什么

Depending on what the user brings, you might:

**探索问题空间**
- 提出必要澄清问题。
- 挑战不稳固的假设。
- 重述问题边界。
- 找到更准确的切分方式。

**调查代码库**
- 梳理相关现有架构。
- 找集成点和复用点。
- 识别已经存在的模式。
- 暴露隐藏复杂度。

**比较方案**
- 枚举多个可行路径。
- 用表格比较取舍。
- 说明风险和验证入口。
- 用户要求时给出推荐方案。

**Visualize**
```
┌─────────────────────────────────────────┐
│       需要时大量使用 ASCII 图           │
├─────────────────────────────────────────┤
│                                         │
│      ┌────────┐         ┌────────┐      │
│      │ State  │────────▶│ State  │      │
│      │   A    │         │   B    │      │
│      └────────┘         └────────┘      │
│                                         │
│   System diagrams, state machines,      │
│   data flows, architecture sketches,    │
│   dependency graphs, comparison tables  │
│                                         │
└─────────────────────────────────────────┘
```

**Surface risks and unknowns**
- Identify what could go wrong
- Find gaps in understanding
- Suggest spikes or investigations

---

## OpenSpec 感知

自然使用 OpenSpec，不要强行套流程。

如果需要创建或更新 OpenSpec artifacts，先读取：

- `AGENTS.md`
- `.agents/skills/references/engineering-quality-gate.md`
- `.agents/skills/references/openspec-chinese-artifact-gate.md`
- 与影响路径直接相关的模块 gate、design、PRD、issue 或现有 change

OpenSpec artifacts 的正文默认中文；`Requirement`、`Scenario`、`SHALL`、`MUST`、`WHEN`、`THEN`、`AND`、delta section 等 OpenSpec 语法必须保留英文。写入后运行 `openspec validate <change-id> --type change --strict --json`，失败则先回改 artifacts。

### 检查上下文

At the start, quickly check what exists:
```bash
openspec list --json
```

这能判断：
- 是否已有 active changes。
- change 名称、schema 和状态。
- 用户可能正在推进哪条链路。

### 没有现成 change 时

先自由探索。结论清晰后可以建议：

- “这已经足够创建 OpenSpec change，是否要我生成 proposal/design/specs/tasks？”
- 或继续探索，不强行文档化。

### 已有 change 时

如果用户提到 change，或你判断某个 change 相关：

1. **读取既有 artifacts 作为上下文**
   - `openspec/changes/<name>/proposal.md`
   - `openspec/changes/<name>/design.md`
   - `openspec/changes/<name>/tasks.md`
   - etc.

2. **自然引用 artifacts**
   - “当前 design 写的是 Redis，但刚才确认 SQLite 更符合边界。”
   - “proposal 把范围限定到高级用户，但现在范围可能变成全用户。”

3. **决策明确时建议沉淀**

    | Insight Type               | Where to Capture               |
    |----------------------------|--------------------------------|
    | New requirement discovered | `specs/<capability>/spec.md` |
    | Requirement changed        | `specs/<capability>/spec.md` |
    | Design decision made       | `design.md`                  |
    | Scope changed              | `proposal.md`                |
    | New work identified        | `tasks.md`                   |
    | Assumption invalidated     | Relevant artifact              |

   示例：
   - “这是设计决策，要写入 `design.md` 吗？”
   - “这是新行为需求，要补到 `specs/**/spec.md` 吗？”
   - “这会改变范围，要更新 `proposal.md` 吗？”

4. **由用户决定是否写入**。不要施压，也不要自动写入。

---

## 不需要做什么

- 不需要固定脚本。
- 不需要每次问同一组问题。
- 不需要强制产出 artifact。
- 不需要过早给结论。
- 有价值的旁支可以展开。

---

## 常见入口处理

**用户只有模糊想法：**
```
User: 我想加实时协作

You: 先把实时协作拆开看，至少有三层能力：

      COLLABORATION SPECTRUM
      ════════════════════════════════════════════

      Awareness          Coordination         Sync
          │                   │                 │
          ▼                   ▼                 ▼
      ┌────────┐         ┌────────┐        ┌────────┐
      │Presence│         │Cursors │        │  CRDT  │
      │  "3    │         │ Multi  │        │Conflict│
      │online" │         │ select │        │  free  │
      └────────┘         └────────┘        └────────┘
          │                   │                 │
       简单                中等              复杂

      你现在更想先解决在线状态、协同操作，还是冲突合并？
```

**用户带来具体问题：**
```
User: 认证系统现在很乱

You: [reads codebase]

     ┌─────────────────────────────────────────────┐
     │              CURRENT AUTH FLOW              │
     └─────────────────────────────────────────────┘
                        │
          ┌─────────────┼─────────────┐
          ▼             ▼             ▼
     ┌─────────┐  ┌─────────┐  ┌─────────┐
     │ Google  │  │  GitHub │  │  Email  │
     │  OAuth  │  │  OAuth  │  │  Magic  │
     └────┬────┘  └────┬────┘  └────┬────┘
          │             │             │
          └─────────────┼─────────────┘
                        ▼
                  ┌───────────┐
                  │  Session  │
                  └─────┬─────┘
                        │
                        ▼
                  ┌───────────┐
                  │   Perms   │
                  └───────────┘

     我看到三个纠缠点：登录入口、session 真源、权限计算。现在最痛的是哪一个？
```

**用户卡在实现中途：**
```
User: /opsx:explore add-auth-system
      OAuth 集成比预期复杂

You: [reads change artifacts]

     你当前在 task 4：实现 OAuth flow。

     我先追一下这一步牵涉哪些边界...

     [画图，比较方案，给出路径]

     这属于 design 变化。要写进 `design.md`，还是先加一个 spike task？
```

**用户想比较方案：**
```
User: 这里用 Postgres 还是 SQLite？

You: 先看上下文。这个数据是本地单用户，还是多人服务端共享？

User: CLI 工具，用来跟踪本地开发环境

You: 这个约束下 SQLite 更合适：

     ┌─────────────────────────────────────────────────┐
     │          CLI TOOL DATA STORAGE                  │
     └─────────────────────────────────────────────────┘

     关键约束：
     • 不依赖后台 daemon
     • 必须离线可用
     • 单用户

                  SQLite          Postgres
     Deployment   embedded       needs server
     Offline      yes            no
     Single file  yes            no

     除非后续有服务端同步或多人共享，否则 SQLite 是更低成本路径。
```

---

## 结束探索

探索没有固定结束格式。可能结果包括：

- 进入 proposal：建议创建 OpenSpec change。
- 更新 artifacts：把确认过的决策写入同一个 change。
- 只提供清晰结论：用户拿到判断即可。
- 暂停，后续继续。

当讨论已经收束，可以用中文总结：

```
## 已收束结论

**问题**：[清晰后的问题表述]

**方案**：[如果已出现明确方案]

**未决点**：[如果还有]

**下一步**：
- 创建 OpenSpec change
- 或继续探索
```

总结不是强制的；有时探索本身就是交付。

---

## 护栏

- **不要实现**：不要写业务代码或实现功能；创建 OpenSpec artifacts 可以，写 application code 不可以。
- **不要假装理解**：不清楚就继续查。
- **不要急着收口**：探索是思考时间，不是施工时间。
- **不要强行套结构**：让问题自然成形。
- **不要自动沉淀**：先建议保存，再由用户决定。
- **要可视化**：好的图比长段文字更清楚。
- **要调查代码库**：讨论要落到真实实现。
- **要质疑假设**：包括用户的假设和自己的假设。
