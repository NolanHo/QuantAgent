import { useAgentChatPage } from "../../hooks";
import type { AgentChatSearch } from "../../types";
import { AgentChatComposer } from "../composer/AgentChatComposer";
import { AgentMessageList } from "../conversation/AgentMessageList";
import { AgentRuntimePanels } from "../events/AgentRuntimePanels";
import { AgentChatErrorState } from "../states/AgentChatStates";

export function AgentChatPage({ search = {} }: { search?: AgentChatSearch }) {
  const page = useAgentChatPage(search);

  return (
    <div className="grid gap-4">
      <section className="page-header">
        <p className="page-kicker">Agent Runtime</p>
        <h1 className="page-title">Agent Chat</h1>
        <p className="page-description">
          {page.debugPreset
            ? `真实 AgentRuntime / DeepAgents 流式对话入口。当前调试预设：${page.debugPreset}。`
            : "真实 AgentRuntime / DeepAgents 流式对话入口。"}
        </p>
      </section>

      {page.state.errorSummary ? <AgentChatErrorState message={page.state.errorSummary} /> : null}

      <section className="grid min-h-[calc(100vh-15rem)] gap-4 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="grid min-h-[34rem] grid-rows-[minmax(0,1fr)_auto] rounded-lg border border-hairline bg-surface-soft shadow-sm">
          <div className="min-h-0 overflow-auto p-4">
            <AgentMessageList isStreaming={page.stream.isLoading} messages={page.state.messages} />
          </div>
          <div className="border-t border-hairline bg-canvas p-3">
            <AgentChatComposer
              canSend={page.canSend}
              draftMessage={page.draftMessage}
              isStreaming={page.stream.isLoading}
              onAbort={page.abortRun}
              onDraftMessageChange={page.setDraftMessage}
              onSend={() => void page.sendMessage()}
            />
          </div>
        </div>
        <aside className="grid max-h-[calc(100vh-15rem)] content-start gap-3 overflow-auto rounded-lg border border-hairline bg-canvas p-3 shadow-sm">
          <div className="grid gap-2 rounded-md border border-hairline bg-surface-soft p-3 text-[12px] text-muted-strong">
            <div className="flex items-center justify-between gap-3">
              <span className="font-semibold uppercase">Status</span>
              <span className="rounded-md bg-canvas px-2 py-1 font-mono text-ink">{page.state.status}</span>
            </div>
            <div className="min-w-0 truncate font-mono">session: {page.state.sessionId ?? "pending"}</div>
            <div className="min-w-0 truncate font-mono">trace: {page.state.traceId ?? "none"}</div>
          </div>
          <AgentRuntimePanels
            artifacts={page.runtime.artifacts}
            interrupts={page.runtime.interrupts}
            runtimeEvents={page.runtime.runtimeEvents}
            subagents={page.runtime.subagents}
            todos={page.runtime.todos}
            toolCalls={page.runtime.toolCalls}
          />
        </aside>
      </section>
    </div>
  );
}
