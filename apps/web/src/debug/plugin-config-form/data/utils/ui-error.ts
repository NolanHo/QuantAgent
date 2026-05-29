import { ApiError } from '@/shared/api'

export function delay(ms = 120): Promise<void> {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, ms)
  })
}

export function toUiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    const details = [
      error.requestId ? `requestId: ${error.requestId}` : null,
      error.traceId ? `traceId: ${error.traceId}` : null,
    ].filter(Boolean)

    return details.length > 0 ? `${error.message}（${details.join('，')}）` : error.message
  }

  if (error instanceof Error) {
    return error.message
  }

  return fallback
}
