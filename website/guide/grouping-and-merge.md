# 分组与合并

## 连续分组

groups 从父到子声明，只有相邻且完整路径相同的记录组成一组，不排序。非连续同路径以 occurrence 区分。idField 提供稳定组身份，改名后独立输入继续跟随。

## 自动合并

merges.vertical 的 column 指列，by 指 GroupRule.key。第 k 层合并穿过更深层派生行，排除自己与更浅层的小计。纵向使用占位格与叠加层；横向布局使用 colspan。renameFields 中的分组字段支持同组整体改名。

## 手动合并

先声明 manualMerge.rules，再选择单列连续真实记录。工具栏显示预览和被隐藏的非空值数量，确认后执行。覆盖值保留，合并状态参与撤销重做。

## 相关 API

[实例方法](/api/instance) · [配置](/config/table-config) · [命令](/api/commands)
