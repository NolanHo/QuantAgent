# field-controls

这个目录只放 `PluginConfigField` 会复用的字段输入控件。

## 放什么

- 数值滑块输入
- JSON / code editor 输入
- 支持型数组字段输入

## 不放什么

- 字段元信息布局
- 字段约束模型、schema 解析和 payload 转换
- 页面专属状态机、调试页文案或业务请求逻辑

## 使用边界

- 当前默认由 [PluginConfigField.tsx](../PluginConfigField.tsx) 统一分发这些控件
- 如果新增控件只服务某个页面，不要放到这里
- 只有被多个字段路径复用的输入控件才进入本目录
