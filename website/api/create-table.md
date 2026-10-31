# 创建实例

`createTable<TRow>(container, options): TableInstance<TRow>` 同步创建浏览器表格。`createModel<TRow>(options): ModelInstance<TRow>` 同步创建无 DOM 模型。

| 参数                                        | 类型 / 默认                 | 说明                              |
| ------------------------------------------- | --------------------------- | --------------------------------- |
| container                                   | HTMLElement，必填           | 已挂载且有高度的容器，仅 DOM 入口 |
| options.config                              | TableConfig，必填           | 先整体归一化与验证                |
| rowKey                                      | string / 取值函数，默认生成 | 稳定身份，不使用源下标            |
| dataSource                                  | TRow[]，默认 []             | 实例克隆持有                      |
| derivedValues                               | DerivedValue[]，默认 []     | 独立人工输入                      |
| historyLimit                                | number，默认 100            | 事务历史容量                      |
| dataLoader                                  | 异步函数                    | 配置后自动首次加载                |
| loading / loadError / emptyReason / onRetry | 宿主状态                    | 与 dataLoader 二选一接入          |
| theme / density                             | light / normal              | 实例根变量                        |
| height                                      | number / string             | 表体可视高度，否则随宿主          |
| currency                                    | string，默认 CNY            | 金额展示币种                      |
| toolbar                                     | boolean，默认 true          | 内置图标工具栏                    |
| toolbarActions                              | 动作数组，默认 []           | 宿主追加按钮                      |
| getPopupContainer                           | 返回 HTMLElement 的函数     | 默认实例 popup 层                 |
| onError                                     | 错误回调                    | 事件 / render 等回调错误          |

配置错误会同步抛出 TableConfigError，包含 path、code、message。创建失败不会产生一个可使用的实例。包导入自身不访问 DOM。

[最小可运行示例](/guide/getting-started) · [完整类型](/api/types)
