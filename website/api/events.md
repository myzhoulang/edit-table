# 事件

`on(event, handler)` 同步订阅，返回取消函数。负载冻结；处理器抛错被隔离并转 onError。事务先应用新状态并刷新视图，再发数据事件，随后是独立输入、汇总和历史事件。

| 事件                | 负载                                     | 时机                           |
| ------------------- | ---------------------------------------- | ------------------------------ |
| dataChange          | source / changes / dataSource / revision | 用户事务或业务替换提交后       |
| derivedValuesChange | values / dropped                         | 独立输入变化，dropped 为组失配 |
| summaryChange       | summary                                  | 汇总原始值变化                 |
| selectionChange     | ranges / active                          | 逻辑选区更新                   |
| editStart / editEnd | target / committed                       | 开始 / 结束编辑                |
| validationChange    | errors                                   | 当前会话的校验结果             |
| historyChange       | canUndo / canRedo                        | 历史变化或清空                 |
| pinnedRowsChange    | rows                                     | 固定、取消、源身份消失         |
| lockChange          | rowKeys                                  | 锁定集合变化                   |
| loadStateChange     | DataState                                | 加载状态变化                   |
| columnResize        | field / width                            | 列宽提交                       |
| configError         | TableConfigError                         | 配置应用失败                   |
| commandExecuted     | name / result                            | 命令结束                       |
| mergeInvalidated    | merges                                   | 结构变化导致合并失效           |

外部 setDataSource 不触发 dataChange；快照不能被宿主反向修改。[实例方法](/api/instance)

`dataChange` 还提供 `recordChanges`：每项包含 `rowKey`、`before`、`after`、`beforeIndex` 和 `afterIndex`。插入时没有 before/beforeIndex，删除时没有 after/afterIndex，移动或顺序变化可通过前后源下标识别。`changes` 包含结构操作与撤销/重做的字段差量；即使空记录没有字段差量，仍可通过 recordChanges 同步。两种差量及快照均冻结。
