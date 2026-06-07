import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

describe("usePluginConfigEditorPanel source boundary", () => {
  it("does not import product-path mock config helpers", () => {
    const sourcePath = fileURLToPath(new URL("./use-plugin-config-editor-panel.ts", import.meta.url));
    const source = readFileSync(sourcePath, "utf8");

    expect(source).not.toContain("plugin-config-mock");
    expect(source).not.toContain("loadMockPluginConfig");
    expect(source).not.toContain("saveMockPluginConfig");
    expect(source).not.toContain("validateMockPluginConfig");
    expect(source).toContain("pluginsApi.fetchConfig");
    expect(source).toContain("pluginsApi.updateConfig");
    expect(source).toContain("pluginsApi.validateConfig");
  });
});
