import type { PluginConfigDebugState } from './types'

export function statusCopy(state: PluginConfigDebugState): { detail: string; title: string } {
  switch (state) {
    case 'loading':
      return { title: '加载中', detail: '正在加载 schema 与当前配置快照。' }
    case 'empty':
      return { title: '空状态', detail: '当前没有可用的配置样例或字段。' }
    case 'load-failure':
      return { title: '加载失败', detail: '插件配置接口返回错误，请根据错误信息排查。' }
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
