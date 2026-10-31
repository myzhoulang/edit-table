# 编辑器配置

editorOptions 提供类型级默认值，columns.editorProps 覆盖同名项。text: maxLength / placeholder；number: min / max / step / precision；select: searchable / multiple / filterOption。

options 为标量数组，或 { label, value, disabled, children } 数组。函数接收 row / search，每次打开重新解析，错误显示重试。

| 参数         | 类型                        | 默认值                  | 行为                                                  |
| ------------ | --------------------------- | ----------------------- | ----------------------------------------------------- |
| placeholder  | string                      | 文本为空；日期为 format | 输入提示                                              |
| maxLength    | number                      | 无限制                  | 文本输入长度                                          |
| min / max    | number                      | 无                      | 数字范围，编辑与粘贴均检查                            |
| step         | number                      | 1                       | 加减按钮步长                                          |
| precision    | number                      | 不处理                  | 数字小数位，裁剪到 0–15                               |
| format       | string                      | YYYY-MM-DD              | 日期必须各包含一次 YYYY / MM / DD，可改变顺序与分隔符 |
| searchable   | boolean                     | true                    | select / cascader 搜索输入                            |
| multiple     | boolean                     | false                   | select 多选，值为数组                                 |
| filterOption | (search, option) => boolean | label 忽略大小写包含    | select 过滤，全局配置同样生效                         |

日期键盘：方向键移动 1 天或 1 周，PageUp / PageDown 翻月并裁剪月末，Home / End 到周边界，Enter 确认。级联键盘：上下选择、右键进入、左键返回、Enter 选择叶子。select 多选用 Enter 切换高亮项，Ctrl/Cmd+Enter 或确定按钮提交。

Escape 取消；普通输入框 Tab 保存并移动，弹层按钮保留原生 Tab。异步选项失败显示重试，晚到结果不覆盖新搜索。

[公共类型](/api/types) · [快速开始](/guide/getting-started)

多选 select 与 cascader 保存数组，`valueType` 应省略或设为 `string`，不能配置 number / boolean / date。空值清空为 `[]`。数字步进按钮按十进制精度计算并限制 min/max，非数字输入需要先修正后才能步进。
