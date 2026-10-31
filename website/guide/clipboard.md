# 复制与粘贴

复制同时提供 TSV 与 HTML table，使用原始值。制表符、换行、引号按 TSV 编码；自动分组值逐行重复，手动合并覆盖格输出空白。

多个相邻或重叠选区能拼成矩形时完整复制。非矩形选区返回 rejected，原生快捷键显示错误；不修改数据。剪切只清空成功写入剪贴板、copyable / clearable 且可写的格。整列选择按逻辑顺序跳过派生行与 columnSelectable=false 的格。

粘贴识别 HTML / TSV / 多行文本。单值填充选区，多值从活动格起铺开，不新增行；跨行输入跳过派生行。

PasteReport 返回 applied、skipped、failed、truncated。只读、锁定、计算字段和 pasteable: false 被跳过；类型或拦截错误逐格报告；计算错误整体回滚。整个粘贴一条历史。

pasteTarget=false 的单元格不能作为起点。浏览器拒绝 Clipboard API 时提供原生复制回退；回退也失败时返回 rejected，并保持原始数据。

## 相关 API

[实例方法](/api/instance) · [配置](/config/table-config) · [命令](/api/commands)

分组合并列保留整组编辑语义：一次粘贴向同一个合并区域提供不同值时，整笔事务返回 `conflicting-values`，不会采用最后一个值覆盖前面的输入。相同值只执行一次整组修改；需要拆组时使用 `updateFields` 更新各条真实记录。

多选 select 和 cascader 的数组以 JSON 数组编码，例如 `["a,b","c"]`，TSV 的引号转义由组件处理。粘贴回对应编辑器时还原数组；逗号分隔文本不能可靠表达数组，组件会报告格式错误。
