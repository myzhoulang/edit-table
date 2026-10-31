# 计算与字段联动

每条规则声明 id、reads、writes、scope 和同步 compute。读写依赖决定拓扑，重复输出和循环依赖被拒绝，计算字段不可编辑、清空或粘贴。

scope 为 row 或 { group: key }。compute 接收冻结的 row / rows，返回有限标量记录或 null。

顺序：用户修改 → fieldTransitions → calculations → grouping → derivedRows → summary。外部 setDataSource 不触发联动。联动检查循环并限制 32 步。

任意计算抛错或返回非法输出，事务回滚；错误携带 ruleId、rowKey、calc-error。

## 相关 API

[实例方法](/api/instance) · [配置](/config/table-config) · [命令](/api/commands)
