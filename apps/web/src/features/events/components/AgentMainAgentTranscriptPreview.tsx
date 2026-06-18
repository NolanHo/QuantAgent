import { useMemo } from 'react';

import { AgentMessageList } from '@/features/agent-chat/components/conversation/AgentMessageList';
import { useAgentChatSession } from '@/features/agent-chat/queries';
import { stateFromSession } from '@/features/agent-chat/utils';

export function AgentMainAgentTranscriptPreview({ sessionId }: { sessionId: string }) {
  const sessionQuery = useAgentChatSession(sessionId);
  const messages = useMemo(() => (sessionQuery.data ? stateFromSession(sessionQuery.data).messages : []), [sessionQuery.data]);

  if (sessionQuery.isLoading) {
    return (
      <section className="grid gap-2">
        <h3 className="m-0 text-[13px] font-semibold text-ink">Agent Chat 处理记录</h3>
        <div className="rounded-lg border border-dashed border-hairline bg-canvas p-4 text-body-sm text-muted-strong">
          正在加载 Agent Chat transcript。
        </div>
      </section>
    );
  }

  if (sessionQuery.isError || !sessionQuery.data) {
    return (
      <section className="grid gap-2">
        <h3 className="m-0 text-[13px] font-semibold text-ink">Agent Chat 处理记录</h3>
        <div className="rounded-lg border border-warning/30 bg-warning/10 p-4 text-body-sm text-amber-700">
          无法读取该 Agent Chat session 的历史记录。
        </div>
      </section>
    );
  }

  return (
    <section className="grid gap-2">
      <div className="flex items-center justify-between gap-3">
        <h3 className="m-0 text-[13px] font-semibold text-ink">Agent Chat 处理记录</h3>
        <span className="font-mono text-[11px] text-muted">{sessionId}</span>
      </div>
      <div className="rounded-lg border border-hairline bg-surface-soft p-3">
        <AgentMessageList isStreaming={sessionQuery.data.status === 'active'} messages={messages} />
      </div>
    </section>
  );
}
