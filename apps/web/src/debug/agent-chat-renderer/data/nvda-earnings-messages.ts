import type { AgentRenderMessage } from "../../../features/agent-chat";

export const nvdaEarningsRenderMessages: AgentRenderMessage[] = [
  {
    id: "msg-user-action-request",
    createdAt: "2026-05-28T20:05:00.000Z",
    role: "user",
    title: "user",
    parts: [
      {
        type: "text",
        text: "请分析事件并给出行动。",
      },
    ],
  },
  {
    id: "msg-mainagent-full-turn",
    createdAt: "2026-05-28T20:05:04.000Z",
    role: "assistant",
    title: "Semiconductor MainAgent",
    meta: "run_nvda_earnings_primary",
    parts: [
      {
        type: "reasoning",
        title: "Thinking",
        status: "completed",
        text: "用户要求分析事件并给出行动。SystemPrompt 和运行 Context 已提供一条新闻：英伟达官方财报发布后 5 分钟进入系统，但 Context 里只有官方披露的硬数字，没有市场预期、盘后反应和用户最近仓位。我需要先获取必要信息，再决定是否创建 Todo 和委托 SubAgent。",
      },
      {
        type: "tool",
        callId: "tool_inv_get_event_context",
        name: "run_context.read_event",
        status: "completed",
        description: "读取本次 run 绑定的事件与上下文摘要。",
        input: {
          include_context: true,
          include_hidden_prompt: false,
          run_id: "run_nvda_earnings_primary",
        },
        output:
          "**事件上下文**\n\n- source: NVIDIA Investor Relations\n- arrived_at: 财报发布后 5 分钟\n- event_type: official_earnings\n- headline: NVIDIA reports quarterly results above prior guidance\n- raw_news: 官方新闻稿包含营收、EPS、数据中心收入、下一季收入指引和毛利率指引；未包含市场一致预期、盘后价格反应和用户仓位。",
      },
      {
        type: "reasoning",
        title: "Thinking",
        status: "completed",
        text: "这是一手材料，时效性很强，但还不能直接行动。财报数字本身只有在和预期、价格反应、仓位约束合并后才有交易意义。根据 MainAgent 指示，我需要先创建 Todo，让后续步骤可见并可追踪。",
      },
      {
        type: "tool",
        callId: "tool_inv_create_todos",
        name: "todo.write",
        status: "completed",
        description: "创建本轮 MainAgent 运行计划。",
        input: {
          todos: [
            { id: "todo_context", content: "确认官方财报事件与第一手材料边界", status: "completed" },
            { id: "todo_research", content: "委托 Research Agent 补充市场预期和盘后反应", status: "in_progress" },
            { id: "todo_risk", content: "检查仓位、风险预算和自动审批阈值", status: "pending" },
            { id: "todo_decision", content: "生成行动计划、通知策略和后续盯盘条件", status: "pending" },
          ],
        },
        output: "success",
      },
      {
        type: "text",
        display: "process",
        text: "我会先补齐市场预期、盘后反应和相关风险约束，再给出是否行动。当前事件是一手官方财报，不能等媒体半小时后的总结再处理。",
      },
      {
        type: "reasoning",
        title: "Thinking",
        status: "completed",
        text: "我需要把资料补全交给专门的 Research Agent。它应该覆盖一致预期、盘后价格反应、半导体同业联动和管理层电话会前的关键风险，不应该直接给交易指令。",
      },
      {
        type: "subagent",
        agentName: "Research Agent",
        status: "completed",
        title: "委托 Research Agent 分析财报预期差",
        input:
          "请分析 NVDA 官方财报事件：确认营收、EPS、数据中心收入、下一季指引是否高于市场预期；补充盘后价格反应和半导体同业联动；列出电话会前需要注意的风险。只输出研究结论，不给交易指令。",
        steps: [
          {
            type: "reasoning",
            title: "Research Agent Thinking",
            status: "completed",
            text: "根据指示，我需要进行网络搜索获取必要信息。官方财报提供事实数字，但不提供市场预期；我需要优先搜索一致预期和盘后价格，不使用泛化媒体评论替代数据。",
          },
          {
            type: "tool",
            callId: "tool_inv_research_search_consensus",
            name: "tavily_search",
            status: "completed",
            description: "搜索财报前一致预期。",
            input: {
              query: "NVIDIA quarterly earnings consensus revenue EPS data center guidance before report",
              topic: "finance",
            },
            output:
              "**搜索结果摘要**\n\n- 市场一致预期低于官方披露营收和 EPS。\n- 数据中心收入是主要超预期来源。\n- 下一季收入指引高于主流 sell-side 区间上沿。",
          },
          {
            type: "tool",
            callId: "tool_inv_research_market_reaction",
            name: "market_snapshot",
            status: "completed",
            description: "查询盘后价格和同业反应。",
            input: {
              symbols: ["NVDA", "SMH", "AMD", "TSM"],
              window: "after_hours",
            },
            output:
              "**盘后反应**\n\n- NVDA 盘后一度上涨约 6.8%。\n- SMH 同步上行，说明市场把结果视为行业级 AI 半导体利好。\n- AMD / TSM 有正向联动，但强度弱于 NVDA。",
          },
          {
            type: "reasoning",
            title: "Research Agent Thinking",
            status: "completed",
            text: "资料显示这是多维度超预期，而不是单一 EPS beat。需要提醒 MainAgent：电话会前仍有毛利率、供给和资本开支风险，盘后流动性也会放大波动。",
          },
        ],
        output:
          "**Research Agent 结论**\n\nNVDA 官方财报具备高时效和高可信度，营收、EPS、数据中心收入与下一季指引均强于一致预期。盘后价格已经验证市场正在重新定价。主要风险是电话会可能改变毛利率、供给约束和资本开支预期；不建议等待后续媒体报道再做首次判断。",
      },
      {
        type: "reasoning",
        title: "Thinking",
        status: "completed",
        text: "Research Agent 已补齐预期差和市场反应。下一步不能直接下单，需要检查用户当前仓位、最近是否已经基于同一事件操作，以及自动审批阈值。",
      },
      {
        type: "tool",
        callId: "tool_inv_position_snapshot",
        name: "portfolio.snapshot",
        status: "completed",
        description: "读取用户当前仓位、风险预算和最近事件动作。",
        input: {
          account_id: "acct_debug",
          symbols: ["NVDA", "SMH"],
          lookback_event_window: "6h",
        },
        output:
          "**仓位快照**\n\n- NVDA 当前仓位：组合权益 1.2%。\n- 半导体总风险敞口：组合权益 7.4%。\n- 过去 6 小时没有基于同一财报事件的交易。\n- 用户配置：置信度 >= 0.90 且新增单标的不超过 2.0% 可自动审批。",
      },
      {
        type: "tool",
        callId: "tool_inv_policy_gate_precheck",
        name: "policy_gate.evaluate",
        status: "completed",
        description: "检查交易建议是否需要人工确认。",
        input: {
          action: "increase_long",
          confidence: 0.92,
          requested_notional: "2.0% portfolio equity",
          symbol: "NVDA",
        },
        output:
          "**Policy Gate**\n\n通过自动审批预检查：置信度 0.92 高于用户阈值 0.90，新增 NVDA 风险不超过上限。无需 human-in-loop，但执行后必须通知用户。",
      },
      {
        type: "tasks",
        title: "Todo 更新",
        tasks: [
          { id: "todo_context", label: "确认官方财报事件与第一手材料边界", status: "completed" },
          { id: "todo_research", label: "委托 Research Agent 补充市场预期和盘后反应", status: "completed" },
          { id: "todo_risk", label: "检查仓位、风险预算和自动审批阈值", status: "completed" },
          { id: "todo_decision", label: "生成行动计划、通知策略和后续盯盘条件", status: "in_progress" },
        ],
      },
      {
        type: "reasoning",
        title: "Thinking",
        status: "completed",
        text: "现在可以生成行动计划：这是高时效官方财报，Research Agent 确认多维超预期，盘后反应支持重新定价，仓位和自动审批阈值允许小比例做多。因为会触发 broker 交互且实际改变仓位，必须生成通知内容。",
      },
      {
        type: "decision",
        title: "决定小比例做多 NVDA",
        action: "submit_order",
        confidence: 0.92,
        rationale: "官方一手财报进入系统足够早，市场预期差明确，盘后价格确认方向，风险预算和自动审批阈值允许执行。",
        risk: "电话会若释放毛利率压力、供给受限或资本开支异常信号，Agent 应撤销追加计划并把仓位降回事件前水平。",
        status: "auto_approved",
        trade: {
          direction: "long",
          instrument: "NVDA",
          notional: "组合权益 2.0%",
          takeProfit: "+8% 或 次日开盘强势延续时分批止盈",
          stopLoss: "-3.5% 或 电话会风险信号触发",
        },
      },
      {
        type: "tool",
        callId: "tool_inv_submit_order",
        name: "broker.submit_order",
        status: "completed",
        description: "根据自动审批结果提交仓位操作。",
        input: {
          symbol: "NVDA",
          side: "buy",
          notional: "2.0% portfolio equity",
          approval_mode: "auto_approved",
          stop_loss: "-3.5%",
          take_profit: "+8%",
        },
        output:
          "**订单结果**\n\n- status: accepted\n- order_id: dryrun_nvda_20260528_200641\n- filled_mode: dry_run\n- risk_controls: take_profit / stop_loss / earnings_call_watch enabled",
      },
      {
        type: "tool",
        callId: "tool_inv_notify_user",
        name: "notification.send",
        status: "completed",
        description: "发送财报摘要和仓位操作通知。",
        input: {
          channel: "user_default",
          reason: "position_changed",
          include_trade_plan: true,
        },
        output:
          "已通知用户：NVDA 官方财报显著高于预期，系统基于自动审批阈值执行 2.0% 组合权益做多，并设置止盈止损与电话会监控条件。",
      },
      {
        type: "reasoning",
        title: "Thinking",
        status: "completed",
        text: "如果后续媒体报道只是复述官方财报，不应该重复交易或重复通知。需要保留相关动作查询节点，用于展示 MainAgent 如何避免重复处理同一事件链。",
      },
      {
        type: "tool",
        callId: "tool_inv_related_action_lookup",
        name: "run_memory.find_related_actions",
        status: "completed",
        description: "查询同一事件链下是否已有操作。",
        input: {
          event_cluster: "nvda_earnings_2026q1",
          lookback: "2h",
        },
        output:
          "找到相关动作：20:06 已基于 NVIDIA 官方一手财报执行 NVDA 2.0% 组合权益做多，并已通知用户。",
      },
      {
        type: "notice",
        title: "不重复交易",
        tone: "info",
        text: "媒体跟进报道没有提供超过官方财报和 Research Agent 结论的新信息。本条只补充事件评分，不触发新交易，也不再次通知用户。",
      },
      {
        type: "text",
        display: "response",
        text:
          "结论：这条官方财报事件值得行动。已基于高置信度自动审批执行小比例做多 NVDA，并通知用户。后续盯盘重点是电话会毛利率、供给约束、资本开支表述，以及次日开盘是否延续盘后强势。后续媒体报道若只是复述本次官方财报，不再重复交易或重复通知。",
      },
    ],
  },
];
