import { describe, expect, it, vi } from "vitest";

import type { ApiClient } from "@/shared/api";

import { PluginConfigApi } from "./plugins-config.api";

function createApiClientMock(): ApiClient {
  return {
    del: vi.fn(),
    get: vi.fn(),
    instance: {} as ApiClient["instance"],
    patch: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    request: vi.fn(),
    requestEnvelope: vi.fn(),
    stream: vi.fn(),
  };
}

describe("PluginConfigApi", () => {
  it("uses config-values endpoints for editable plugin config", async () => {
    const client = createApiClientMock();
    vi.mocked(client.get).mockResolvedValue({ values: {} });
    vi.mocked(client.put).mockResolvedValue({ updated_at: "2026-06-08T00:00:00Z", version_tag: "v1" });
    vi.mocked(client.post).mockResolvedValue({ issues: [], ok: true });
    const api = new PluginConfigApi(client);

    await api.fetchConfig("quantagent.official.source.tavily");
    await api.updateConfig("quantagent.official.source.tavily", { values: { api_key: "test-key" } });
    await api.validateConfig("quantagent.official.source.tavily", { values: { api_key: "test-key" } });

    expect(client.get).toHaveBeenCalledWith(
      "/plugins/quantagent.official.source.tavily/config-values",
      { dedupeKey: "plugin-config:quantagent.official.source.tavily" },
    );
    expect(client.put).toHaveBeenCalledWith(
      "/plugins/quantagent.official.source.tavily/config-values",
      { values: { api_key: "test-key" } },
      { dedupeKey: false },
    );
    expect(client.post).toHaveBeenCalledWith(
      "/plugins/quantagent.official.source.tavily/config:validate",
      { values: { api_key: "test-key" } },
      { dedupeKey: false },
    );
  });
});
