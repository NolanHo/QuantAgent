import { ApiError } from '@/shared/api'

export function delay(ms = 120): Promise<void> {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, ms)
  })
}

export function toUiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError || error instanceof Error) {
    return error.message
  }

  return fallback
}
