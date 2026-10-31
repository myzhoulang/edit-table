# 校验与提交

columns.rules 使用 async-validator，支持随行动态规则。deduplication 按全表或分组检查真实数据，隐藏和未渲染行继续参与。

先 await saveEdit()，再 await validate()；valid 为 true 后读取 getSubmission()。返回冻结的 records / derivedValues / summary，不混入派生行与展示文本。validate 定位 firstError，全局派生输入错误无单格坐标。

一般记录校验显示错误并保留输入，方便纠错；派生 input 规则在写入前检查，非法值拒绝。异步校验按 epoch 防竞态。

等待校验的单元格显示底部标记并设置 aria-busy；错误设置 aria-invalid，支持悬停与表格聚焦提示。错误提示优先于批注。局部布局 validatable=false 跳过规则和去重；手动合并覆盖格也跳过。并发全表校验只发布最后一次结果；局部编辑不会清除其他单元格已有错误。

## 相关 API

[实例方法](/api/instance) · [配置](/config/table-config) · [命令](/api/commands)
