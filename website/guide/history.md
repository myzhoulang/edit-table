# 事务与历史

每次用户意图一条历史，包含原始修改、联动与计算结果。默认容量 100，可通过 historyLimit 设置。新事务清空 redo。

setDataSource 外部同步不通知，replaceDataSource 业务替换会通知，两者均清历史。选区、滚动与固定行不入历史；源行删除自动取消固定，撤销删除不自动恢复固定。

## 相关 API

[实例方法](/api/instance) · [配置](/config/table-config) · [命令](/api/commands)
