# 核心概念

## 四类数据

| 类型               | 读取             | 提交           |
| ------------------ | ---------------- | -------------- |
| 真实记录与计算字段 | getDataSource    | records        |
| 独立人工输入       | getDerivedValues | derivedValues  |
| 小计等展示投影     | getDerivedRows   | 不混入 records |
| 整表统计           | getSummary       | summary        |

rowKey 标识真实记录，ruleKey + groupKey 标识派生行。源下标只含真实记录，视图下标包含派生行，DOM 窗口下标不公开。

一次编辑、联动与计算属于同一事务；全部成功后才发布冻结快照，异常整体回滚。

## 相关 API

[实例方法](/api/instance) · [配置](/config/table-config) · [命令](/api/commands)
