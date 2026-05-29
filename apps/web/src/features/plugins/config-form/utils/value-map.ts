import type { PluginConfigValueMap } from '../types/plugin-config.types'

export function isSameValueMap(
  left: PluginConfigValueMap,
  right: PluginConfigValueMap,
): boolean {
  const leftKeys = Object.keys(left)
  const rightKeys = Object.keys(right)

  if (leftKeys.length !== rightKeys.length) {
    return false
  }

  for (const key of leftKeys) {
    if (left[key] !== right[key]) {
      return false
    }
  }

  return true
}
