import { describe, expect, it } from "vitest";

import { getSessionRefreshDelayMs } from "./refresh";

describe("getSessionRefreshDelayMs", () => {
  it("schedules refresh one minute before idle expiration when enough time remains", () => {
    expect(getSessionRefreshDelayMs(1_700_000_000, 1_699_999_000_000)).toBe(940_000);
  });

  it("keeps a short retry window when expiration is already near", () => {
    expect(getSessionRefreshDelayMs(1_700_000_000, 1_699_999_950_000)).toBe(5_000);
  });
});
