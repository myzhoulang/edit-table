# TableConfig

配置采用完整替换。重复标识、未知引用、循环依赖或布局交叉会抛 TableConfigError（path / code / message）；updateConfig 返回 false 并保留有效配置。主题、密度、加载、工具栏与初始数据属于 CreateTableOptions。

| 参数                  | 类型                                                | 必填 / 默认值     | 行为                                                    |
| --------------------- | --------------------------------------------------- | ----------------- | ------------------------------------------------------- |
| columns               | ColumnDef[]                                         | 必填              | field / key 唯一                                        |
| readonly              | boolean                                             | false             | 禁止写入，仍允许选择复制                                |
| rowNumbers / striped  | boolean                                             | false             | 含派生行的连续视图行号与斑马纹                          |
| rowPinning            | boolean / { maxRows?: number }                      | false；容量 1     | 固定对比，先进先出，不属于历史                          |
| pinnedDiff            | boolean                                             | false             | 活动行与第一条固定行比较                                |
| virtualization        | boolean / { threshold?: number; overscan?: number } | 200 / 8           | false 关闭，按逻辑行数判断                              |
| rowHeight             | number / 'auto'                                     | 随密度 38 / 28 px | auto 测量窗口行并保持滚动锚点                           |
| rowRules              | RowRule[]                                           | []                | 特殊真实行的布局和行为                                  |
| groups                | GroupRule[]                                         | []                | 按声明顺序连续分组                                      |
| merges                | { vertical?; horizontal? }                          | 空                | 自动纵向合并与横向布局                                  |
| manualMerge           | { rules: ManualMergeRule[] }                        | 关闭              | 限定允许的列和行类型                                    |
| fieldTransitions      | FieldTransition[]                                   | []                | 用户写入触发联动                                        |
| operations            | { actions }                                         | 默认菜单          | 追加自定义动作，支持 add / remove 简写                  |
| calculations          | CalculationRule[]                                   | []                | 按 reads / writes 拓扑执行                              |
| derivedRows           | DerivedRowRule[]                                    | []                | 聚合、输入、计算与文本                                  |
| validateDerivedValues | (values, context) => string / null                  | 无                | 独立输入的事务前全局检查                                |
| summary               | SummaryConfig                                       | 无                | 返回原始标量的纯函数汇总                                |
| context               | unknown                                             | undefined         | 供计算、派生、汇总和操作读取                            |
| locale                | Partial&lt;Locale&gt;                               | 中文              | empty / loading / retry / noOptions / search / readonly |
| editorOptions         | 按 EditorName 的参数表                              | {}                | 同类默认参数，列参数优先                                |

示例：[基础](/demos/basic/) · [分组合并](/demos/group-merge/) · [大数据](/demos/big-data/) · [优惠](/demos/subtotal-offer/)

[公共类型](/api/types) · [快速开始](/guide/getting-started)
