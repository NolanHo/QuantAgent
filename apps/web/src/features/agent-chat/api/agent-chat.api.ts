import { BaseApi, type ApiClient } from "@/shared/api";

import type {
  AgentChatCreateSessionRequest,
  AgentChatSessionResponse,
  AgentChatStreamEvent,
  AgentChatStreamRequest,
} from "./agent-chat.contracts";
import { streamAgentChatMessage } from "./agent-chat.stream";

export class AgentChatApi extends BaseApi {
  constructor(apiClient: ApiClient) {
    super(apiClient, { basePath: "/agent-chat" });
  }

  createSession(request: AgentChatCreateSessionRequest = {}): Promise<AgentChatSessionResponse> {
    return this.post<AgentChatCreateSessionRequest, AgentChatSessionResponse>("/sessions", request);
  }

  getSession(sessionId: string): Promise<AgentChatSessionResponse> {
    return this.get<AgentChatSessionResponse>(`/sessions/${encodeURIComponent(sessionId)}`);
  }

  streamMessage(options: {
    request: AgentChatStreamRequest;
    sessionId: string;
    signal?: AbortSignal;
  }): AsyncIterable<AgentChatStreamEvent> {
    return streamAgentChatMessage({
      apiClient: this.apiClient,
      request: options.request,
      sessionId: options.sessionId,
      signal: options.signal,
    });
  }
}

export function createAgentChatApi(apiClient: ApiClient): AgentChatApi {
  return new AgentChatApi(apiClient);
}

