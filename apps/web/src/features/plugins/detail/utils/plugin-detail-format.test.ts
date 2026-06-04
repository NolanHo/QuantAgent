import { describe, expect, it } from "vitest";

import {
  formatApiError,
  formatAvailability,
  formatErrorSummary,
  formatRecordSummary,
} from "./plugin-detail-format";

describe("plugin detail formatters", () => {
  it("keeps unavailable and forbidden states distinguishable", () => {
    expect(formatAvailability({ state: "unavailable", message: "database_not_configured" })).toBe(
      "暂不可用：database_not_configured",
    );
    expect(
      formatAvailability({ state: "forbidden", message: "requires source_binding.read" }),
    ).toBe("权限不足：requires source_binding.read");
  });

  it("formats sanitized error summaries without requiring raw payloads", () => {
    expect(
      formatErrorSummary({
        code: "PLUGIN_FAILED",
        message: "runtime failed",
        stage: "health",
      }),
    ).toBe("PLUGIN_FAILED / health：runtime failed");
  });

  it("includes request id when API errors expose it", () => {
    expect(formatApiError({ msg: "Forbidden", requestId: "req-1", status: 403 })).toBe(
      "HTTP 403：Forbidden request_id=req-1",
    );
  });

  it("summarizes small record-like payloads for read-only panels", () => {
    expect(formatRecordSummary({ interval: "5m", enabled: true })).toBe(
      "interval: 5m · enabled: 是",
    );
  });
});
