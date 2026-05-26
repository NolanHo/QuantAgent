import type {
  PluginConfigDebugState,
  PluginConfigFieldDefinition,
  PluginConfigValidationIssue,
} from './types'

export function statusCopy(state: PluginConfigDebugState): { detail: string; title: string } {
  switch (state) {
    case 'loading':
      return { title: 'Loading', detail: '正在加载 schema 与当前配置快照。' }
    case 'empty':
      return { title: 'Empty', detail: '当前没有可用的配置样例或字段。' }
    case 'validation-error':
      return { title: 'Validation Error', detail: '字段级校验失败，需先修正表单。' }
    case 'save-pending':
      return { title: 'Save Pending', detail: '正在执行受控保存，不写入正式业务接口。' }
    case 'save-success':
      return { title: 'Save Success', detail: '当前草稿已通过 mock save 流程。' }
    case 'save-failure':
      return { title: 'Save Failure', detail: '保存失败分支已触发，可用于验证错误反馈。' }
    default:
      return { title: 'Ready', detail: '当前处于受控调试态，可验证字段映射与状态机。' }
  }
}

export function normalizeInitialValues(
  schemaFields: PluginConfigFieldDefinition[],
  values: Record<string, string>,
): Record<string, string> {
  const nextValues: Record<string, string> = { ...values }

  for (const definition of schemaFields) {
    if (nextValues[definition.path] !== undefined) {
      continue
    }

    if (definition.defaultValue === undefined) {
      nextValues[definition.path] = ''
      continue
    }

    nextValues[definition.path] = String(definition.defaultValue)
  }

  return nextValues
}

export function issueMap(issues: PluginConfigValidationIssue[]): Map<string, string> {
  return new Map(issues.map((issue) => [issue.path, issue.message]))
}

export function splitArrayPreview(value: string): string[] {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

export function splitArrayDraftItems(value: string): string[] {
  if (value.length === 0) {
    return ['']
  }

  return value.split(',').map((entry) => entry.trim())
}

export function joinArrayDraftValue(items: string[]): string {
  return items.map((entry) => entry.trim()).join(',')
}
