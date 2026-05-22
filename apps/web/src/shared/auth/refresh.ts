const SESSION_REFRESH_LEAD_MS = 60_000;
const MIN_SESSION_REFRESH_DELAY_MS = 5_000;

export function getSessionRefreshDelayMs(
  expiresAt: number,
  nowMs: number = Date.now(),
): number {
  return Math.max(
    expiresAt * 1000 - nowMs - SESSION_REFRESH_LEAD_MS,
    MIN_SESSION_REFRESH_DELAY_MS,
  );
}
