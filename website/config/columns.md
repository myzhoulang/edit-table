# 列配置

field / title 必填，field 唯一，key 默认 field。width 默认 140，minWidth 默认 40，maxWidth 默认 2000，resizable 默认 true，hidden 默认 false，fixed 可为 left / right。

可见列的基准总宽度小于正文区域时，剩余宽度按基准比例分配，始终填满表格；超过区域则保留横向滚动。头表、正文、固定区与浮层使用同一份整数列宽。

手动拖拽或 setColumnWidth 设置的列优先保留指定宽度，其余列吸收余量；若所有列均手动设置，余量由末列吸收。minWidth / maxWidth 约束手动提交，自动填充可以超过 maxWidth。显隐、容器尺寸和全屏变化都会重新分配余量；拖动以当前实际显示宽度为起点。

editable 默认 false，editor 默认 text；rules 支持动态函数，options 支持异步函数。展示优先级 render → formatter → format: amount → 原值。空值先使用 emptyValue，0 / false 不为空。

selectable、navigable、copyable、pasteable、clearable、menuable、validatable 默认可用。pinnedText 为 render 提供固定文本，comment 返回批注。

| 参数                        | 类型                                             | 必填 / 默认值   | 行为与失败条件                                |
| --------------------------- | ------------------------------------------------ | --------------- | --------------------------------------------- |
| field / title               | string                                           | 必填            | 数据字段与标题，field 唯一                    |
| key                         | string                                           | field           | 布局与合并引用                                |
| width / minWidth / maxWidth | number                                           | 140 / 40 / 2000 | 像素，释放拖拽后提交                          |
| resizable / hidden          | boolean                                          | true / false    | 调整列宽与初始显隐                            |
| fixed                       | left / right                                     | 无              | 可见列按左、中、右排列                        |
| align                       | left / center / right                            | left            | 正文与固定对比行对齐                          |
| editable                    | boolean / (row, rows) => boolean                 | false           | 只读、锁定、计算字段优先                      |
| editor                      | EditorName / (row, field) => EditorName          | text            | 五种内置编辑器                                |
| options                     | Option[] / (row, search?) => Option[] 或 Promise | []              | 每次打开和搜索解析，旧结果丢弃                |
| editorProps                 | Record&lt;string, unknown&gt;                    | {}              | 覆盖全局同名编辑器参数                        |
| valueType                   | string / number / boolean / date                 | 由 editor 推导  | 输入与粘贴归一化；空 number 为 null           |
| rules                       | Rule[] / (value, row) => Rule[]                  | []              | async-validator，支持异步                     |
| deduplication               | DedupConfig                                      | 关闭            | scope 默认 table；when 过滤；message 覆盖提示 |
| updateValueBefore           | async (value, row, table) => false / void        | 无              | 编辑与粘贴拦截，false 拒绝                    |
| render                      | (value, row, rows, container) => cleanup?        | 无              | 最高展示优先级，回收和销毁时清理              |
| formatter                   | (value, { currency }) => string / number         | 无              | 缓存最近结果，不可返回 DOM 或 Promise         |
| format                      | amount                                           | 无              | 使用 currency，默认 CNY                       |
| emptyValue                  | string                                           | 空字符串        | 空值优先，不调用 formatter                    |
| overflowTooltip             | boolean                                          | true            | 溢出时悬浮显示全文                            |
| pinnedText                  | (value, row) => string                           | 无              | 固定行文本，不重复挂载 render                 |
| comment                     | (row, context) => string / undefined             | 无              | 悬停显示批注，不显示角标，校验错误优先        |
| cellStyle / cellClassName   | 静态值或 context 函数                            | 无              | 缓存并在固定行复用，禁止布局属性和保留名      |

## CellBehaviors

布局 behaviors 优先于列。editable 覆盖不能解除整表只读、锁定和计算字段保护。派生行默认不接收普通粘贴、不进入整列选择与业务菜单；显式 input 可编辑，其余只读。

| 开关             | 记录行默认 | 用途                           |
| ---------------- | ---------- | ------------------------------ |
| selectable       | true       | 鼠标与键盘选择                 |
| navigable        | true       | 方向键、Tab、Home / End 导航   |
| copyable         | true       | false 输出空白，剪切也不清该格 |
| clearable        | true       | 删除键和剪切清空               |
| pasteable        | true       | 接收批量粘贴                   |
| menuable         | true       | 出现业务菜单                   |
| validatable      | true       | 执行规则与去重                 |
| columnSelectable | true       | 整列选择包含该格               |
| pasteTarget      | true       | 允许作为粘贴起点               |
| expandSelection  | true       | 相交时扩展整个合并跨度         |
| mergeable        | true       | 允许手动合并                   |
| editable         | false      | 用户编辑权限                   |

[公共类型](/api/types) · [快速开始](/guide/getting-started)
