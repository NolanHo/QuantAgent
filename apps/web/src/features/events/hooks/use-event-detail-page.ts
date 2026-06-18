import { useState } from 'react';

import type { EventAgentStage } from '../types';
import { useEventDetailQuery, useEventRouterOutputQuery } from '../queries';

export function useEventDetailPage(rawEventId: string) {
  const detailQuery = useEventDetailQuery(rawEventId);
  const [selectedAgentStage, setSelectedAgentStage] = useState<EventAgentStage | null>(null);
  const routerOutputQuery = useEventRouterOutputQuery(
    rawEventId,
    selectedAgentStage?.routed_event_id,
    Boolean(selectedAgentStage?.has_output_json),
  );

  return {
    detailQuery,
    routerOutputQuery,
    selectedAgentStage,
    setSelectedAgentStage,
    // 中文注释：事件详情页会把已关联的 Agent Chat session 透出给页面，不在 UI 层猜测处理记录位置。
    agentChatSessionId: readAgentChatSessionId(detailQuery.data?.agent_stages),
  };
}

function readAgentChatSessionId(stages: EventAgentStage[] | undefined): string | null {
  const value = stages?.find((stage) => stage.stage_id === 'industry_main_agent')?.key_fields.agent_chat_session_id;
  return typeof value === 'string' && value ? value : null;
}
