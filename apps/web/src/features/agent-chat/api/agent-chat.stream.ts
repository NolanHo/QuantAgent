import { ApiError, type ApiClient } from "@/shared/api";

import type { AgentChatStreamEvent, AgentChatStreamRequest } from "./agent-chat.contracts";

export interface StreamAgentChatMessageOptions {
  apiClient: ApiClient;
  request: AgentChatStreamRequest;
  sessionId: string;
  signal?: AbortSignal;
}

interface SseFrame {
  data: string;
  event?: string;
  id?: string;
}

class SseFrameParser {
  private buffer = "";

  push(chunk: string): SseFrame[] {
    this.buffer += chunk;
    const frames: SseFrame[] = [];
    let boundary = this.buffer.indexOf("\n\n");
    while (boundary >= 0) {
      const raw = this.buffer.slice(0, boundary);
      this.buffer = this.buffer.slice(boundary + 2);
      const frame = parseFrame(raw);
      if (frame) frames.push(frame);
      boundary = this.buffer.indexOf("\n\n");
    }
    return frames;
  }

  flush(): SseFrame[] {
    if (!this.buffer.trim()) return [];
    const frame = parseFrame(this.buffer);
    this.buffer = "";
    return frame ? [frame] : [];
  }
}

export async function* streamAgentChatMessage({
  apiClient,
  request,
  sessionId,
  signal,
}: StreamAgentChatMessageOptions): AsyncIterable<AgentChatStreamEvent> {
  const response = await apiClient.stream(`/agent-chat/sessions/${encodeURIComponent(sessionId)}/messages/stream`, {
    data: request,
    signal,
  });

  if (!response.body) {
    throw new ApiError({
      code: -2,
      msg: "Agent Chat stream response has no body.",
      status: response.status,
    });
  }

  const parser = new SseFrameParser();
  const decoder = new TextDecoder();

  for await (const chunk of response.body) {
    for (const frame of parser.push(decoder.decode(chunk, { stream: true }))) {
      if (!frame.data) continue;
      yield JSON.parse(frame.data) as AgentChatStreamEvent;
    }
  }

  for (const frame of parser.flush()) {
    if (!frame.data) continue;
    yield JSON.parse(frame.data) as AgentChatStreamEvent;
  }
}

function parseFrame(raw: string): SseFrame | null {
  const frame: SseFrame = { data: "" };
  const dataLines: string[] = [];
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.startsWith(":")) continue;
    const separator = line.indexOf(":");
    const key = separator >= 0 ? line.slice(0, separator) : line;
    const value = separator >= 0 ? line.slice(separator + 1).trimStart() : "";
    if (key === "event") frame.event = value;
    if (key === "id") frame.id = value;
    if (key === "data") dataLines.push(value);
  }
  frame.data = dataLines.join("\n");
  return frame.data || frame.event || frame.id ? frame : null;
}

