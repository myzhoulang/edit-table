# 命令

`executeCommand(name, payload?): Promise<CommandResult>` 按实例串行。成功为 `{ ok: true, data? }`，失败为 `{ ok: false, code, message }`；未知命令返回 invalid-target。销毁后返回 destroyed。

| 名称                            | payload                             | 行为                                 |
| ------------------------------- | ----------------------------------- | ------------------------------------ |
| undo / redo                     | 无                                  | 事务历史                             |
| insertRowAbove / insertRowBelow | { rowKeys?, rowDefaults?, rows? }   | 默认当前行，继承分组字段             |
| deleteRows                      | { rowKeys?, minRemaining? }         | 不删除锁定行                         |
| duplicateRows                   | { rowKeys? }                        | 新身份，重算计算字段，不复制独立输入 |
| lockRows / unlockRows           | { rowKeys? }                        | 独立锁定集合                         |
| mergeCells                      | { field?, rowKeys?, confirm? }      | 无 confirm 时预览，确认后执行        |
| unmergeCells                    | { field?, rowKeys? }                | 拆分视图合并                         |
| pinRow                          | RowTarget / number / { target }     | 固定对比，默认活动行                 |
| unpinRow                        | RowTarget / { target }              | 取消固定                             |
| clearPinnedRows                 | 无                                  | 清空对比区                           |
| selectAll / clearSelection      | 无                                  | 选择                                 |
| copy / cut                      | 无                                  | 原始 TSV + HTML                      |
| paste                           | string / { text?, html? }           | 一个事务，返回 PasteReport           |
| clear                           | 无                                  | 清空可写格                           |
| validate                        | 无                                  | 全表校验，data 为 ValidationResult   |
| setDerivedValue                 | { ruleKey, groupKey, field, value } | 写独立输入，事前校验                 |
| updateFields                    | { rowKey, fields }[]                | 与同步方法同语义                     |

模型入口不提供浏览器专属选择与剪贴板命令。模型的 mergeCells 直接接收明确范围，不创建 UI 预览。

手动合并也接受 `{ field, targets: RowTarget[], confirm: true }`，用于包含派生行的连续范围；显式范围不依赖当前选区。unmergeCells 同样支持 targets。整列选择复制跳过派生行；非矩形多选区复制 / 剪切返回 rejected，数据保持原样。unpinRow 省略 payload 时取消当前活动行的固定。

失败码：readonly、invalid-target、rejected、validation、calc-error、stale、destroyed。[错误解释](/api/errors)
