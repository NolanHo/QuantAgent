import { AgentChatTranscriptRenderer } from "../../../features/agent-chat";
import { nvdaEarningsRenderMessages } from "../data/nvda-earnings-messages";

export function AgentChatRendererDebugPanel() {
  return (
    <div className="grid gap-5">
      <section className="grid gap-4 lg:grid-cols-[minmax(18rem,22rem)_minmax(0,1fr)]">
        <aside className="grid content-start gap-3 rounded-lg border border-hairline bg-canvas p-4 shadow-card">
          <div>
            <p className="m-0 text-caption font-black uppercase text-muted">Renderer Playground</p>
            <h2 className="m-0 mt-1 text-title-md font-bold text-ink">Agent Chat 消息渲染</h2>
            <p className="m-0 mt-2 text-body-sm leading-6 text-muted-strong">
              这个页面只使用固定的 NVDA 财报全流程 mock，用于打磨可复用消息渲染组件，不调用真实 AgentRuntime。
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {["Conversation", "Message", "ChainOfThought", "Tool", "Task", "SubAgent", "Decision"].map((label) => (
              <span className="rounded-full border border-hairline bg-surface-soft px-2.5 py-1 text-caption font-bold text-muted-strong" key={label}>
                {label}
              </span>
            ))}
          </div>

          <section className="rounded-md border border-hairline bg-surface-soft p-3">
            <div className="mb-2 text-body-sm font-bold text-ink">本轮渲染目标</div>
            <ul className="m-0 grid gap-2 pl-4 text-body-sm leading-5 text-muted-strong">
              <li>不要把 payload 直接堆成 JSON 墙。</li>
              <li>Reasoning 合并成一块，可折叠阅读。</li>
              <li>工具调用显示输入摘要、状态和自然语言结果。</li>
              <li>交易计划、通知和产物要有专门卡片。</li>
              <li>组件后续能迁回真实 Agent Chat 页面复用。</li>
            </ul>
          </section>
        </aside>

        <section className="min-w-0 rounded-lg border border-hairline bg-surface-soft p-4 shadow-card">
          <AgentChatTranscriptRenderer messages={nvdaEarningsRenderMessages} />
        </section>
      </section>
    </div>
  );
}
