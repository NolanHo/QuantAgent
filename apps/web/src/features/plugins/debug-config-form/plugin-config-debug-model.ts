import type {
  PluginConfigDebugState,
  PluginConfigFieldDefinition,
  PluginConfigValidationIssue,
} from './types'

export function statusCopy(state: PluginConfigDebugState): { detail: string; title: string } {
  switch (state) {
    case 'loading':
      return { title: '加载中', detail: '正在加载 schema 与当前配置快照。' }
    case 'empty':
      return { title: '空状态', detail: '当前没有可用的配置样例或字段。' }
    case 'validation-error':
      return { title: '校验失败', detail: '字段级校验失败，需先修正表单。' }
    case 'save-pending':
      return { title: '保存中', detail: '正在执行受控保存，不写入正式业务接口。' }
    case 'save-success':
      return { title: '保存成功', detail: '当前草稿已通过 mock save 流程。' }
    case 'save-failure':
      return { title: '保存失败', detail: '保存失败分支已触发，可用于验证错误反馈。' }
    default:
      return { title: '就绪', detail: '当前处于受控调试态，可验证字段映射与状态机。' }
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

export function fieldConstraintCopies(definition: PluginConfigFieldDefinition): string[] {
  const constraints = definition.constraints
  const copies: string[] = []

  if (!constraints) {
    return copies
  }

  if (constraints.minLength !== undefined) {
    copies.push(`至少 ${constraints.minLength} 个字符`)
  }
  if (constraints.maxLength !== undefined) {
    copies.push(`最多 ${constraints.maxLength} 个字符`)
  }
  if (constraints.minItems !== undefined) {
    copies.push(`至少 ${constraints.minItems} 项`)
  }
  if (constraints.maxItems !== undefined) {
    copies.push(`最多 ${constraints.maxItems} 项`)
  }
  if (constraints.minimum !== undefined) {
    copies.push(`不小于 ${constraints.minimum}`)
  }
  if (constraints.exclusiveMinimum !== undefined) {
    copies.push(`大于 ${constraints.exclusiveMinimum}`)
  }
  if (constraints.maximum !== undefined) {
    copies.push(`不大于 ${constraints.maximum}`)
  }
  if (constraints.exclusiveMaximum !== undefined) {
    copies.push(`小于 ${constraints.exclusiveMaximum}`)
  }
  if (constraints.format === 'uuid') {
    copies.push('UUID 格式')
  } else if (constraints.format === 'uri' || constraints.format === 'url') {
    copies.push('URL 格式')
  } else if (constraints.format === 'date-time') {
    copies.push('日期时间格式')
  } else if (constraints.format === 'ipv4') {
    copies.push('IPv4 格式')
  } else if (constraints.format) {
    copies.push(`${constraints.format} 格式`)
  }
  if (constraints.pattern) {
    copies.push('需匹配指定格式')
  }

  return copies
}
