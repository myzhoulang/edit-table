# 分组与合并

GroupRule.key / fields 必填，idField 为稳定组身份，renameFields 声明整组改名字段。merges.vertical: { column, by }，by 引用 group key。

rowRules 以 match.field / equals 选择真实记录布局；layout.cells 用 column 或 range 二选一。范围含 from、不含 until，省略直到末列。content / render 互斥；布局相交为 crossing-layout。manualMerge.rules 声明允许列。

| 参数                                    | 默认值                  | 规则                                         |
| --------------------------------------- | ----------------------- | -------------------------------------------- |
| groups[].key / fields                   | 必填                    | key 唯一；按真实数据的连续段分组             |
| idField                                 | 无                      | 用字段值提供稳定组身份，建议业务传入         |
| renameFields                            | []                      | 编辑该分组合并字段时整组统一改名             |
| merges.vertical[].column / by           | 必填                    | column 引用列，by 引用 GroupRule.key         |
| merges.horizontal[].rule / from / until | until 省略到末列        | 半开列范围，不能交叉布局                     |
| manualMerge.rules[].column              | 必填                    | 只允许声明列的纵向连续范围                   |
| rowKinds                                | record / derived 均允许 | 可显式限制为一种类型；mergeable=false 仍禁止 |
| rowRules[].id / match / layout          | 必填                    | 首个匹配规则生效，行为覆盖优先于列           |

手动合并命令可传 rowKeys（真实记录）或 targets（含派生行的稳定 RowTarget）。范围必须在完整逻辑视图中连续，不能跨过未选择的小计行，也不能覆盖自动合并或横向布局。覆盖值保留、复制输出空白、不校验、不允许直接写入。结构变化使范围失效时自动拆分并发 mergeInvalidated；撤销恢复原数据及合并状态。

[公共类型](/api/types) · [快速开始](/guide/getting-started)

同一分组规则中的显式 ID 冲突时，组件会自动分配不冲突的后缀，避免派生行定位重叠。自动后缀会受分组顺序影响；若要跨增删、重排持久化派生输入，idField 应提供该规则范围内全局唯一的业务 ID。数字 0 继续按兼容约定视为未设置。
