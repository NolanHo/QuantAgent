import { describe, expect, it } from "vitest";

import {
  createSchemaSnapshotFromRegistrySchema,
  toPluginConfigSnapshot,
} from "./plugin-config-api-adapter";

describe("plugin config API adapter", () => {
  it("maps Tavily api_key schema metadata to a sensitive field", () => {
    const snapshot = createSchemaSnapshotFromRegistrySchema("quantagent.official.source.tavily", {
      properties: {
        api_key: {
          description: "Tavily API key. The platform stores it encrypted and injects it before plugin load.",
          minLength: 1,
          sensitive: true,
          type: "string",
        },
        default_max_results: {
          default: 5,
          type: "integer",
        },
      },
      required: ["api_key"],
      title: "Tavily Source Tool Config",
      type: "object",
    });

    expect(snapshot.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "API Key",
          path: "api_key",
          required: true,
          sensitive: true,
          type: "string",
        }),
        expect.objectContaining({
          path: "default_max_results",
          sensitive: false,
          type: "integer",
        }),
      ]),
    );
  });

  it("preserves backend config state and masked paths for form snapshots", () => {
    const snapshot = toPluginConfigSnapshot({
      config_state: "valid",
      masked_paths: ["api_key"],
      missing_required: [],
      updated_at: "2026-06-08T00:00:00Z",
      values: { api_key: "********", default_max_results: "5" },
      version_tag: "plugin-config-1",
    });

    expect(snapshot).toEqual({
      configState: "valid",
      maskedPaths: ["api_key"],
      missingRequired: [],
      values: { api_key: "********", default_max_results: "5" },
      versionTag: "plugin-config-1",
    });
  });
});
