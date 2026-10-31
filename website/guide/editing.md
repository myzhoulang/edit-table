# 编辑器

单击只选中单元格；直接键入覆盖原值。双击或 F2 编辑原值，光标从末尾开始，可用方向键调整位置。输入过程中再按 F2 也可切换到编辑原值的光标模式。

选中状态下 Enter / Shift+Enter 向下 / 上移动，不进入编辑。编辑时 Enter / Shift+Enter 先提交再下移 / 上移；Tab / Shift+Tab 提交并右移 / 左移。直接键入模式中的方向键提交并移动，F2 或双击模式中的方向键移动文本光标。下拉、日期和级联面板保留自身方向键导航；单选候选与日期通过 Enter 确认后移动，鼠标选择则提交并保持当前格。

Esc 放弃本次草稿，保留选中格；Backspace 打开空白草稿，Esc 可恢复原值；Delete 直接清空可写格。整行选择的 Backspace 仍清空选中行内可写格。外部失焦提交，中文组合输入期间不提前提交。

| 类型     | 配置                                         |
| -------- | -------------------------------------------- |
| text     | maxLength、placeholder                       |
| number   | min、max、step、precision                    |
| date     | YYYY-MM-DD 与自定义月历                      |
| select   | searchable、multiple、filterOption、异步候选 |
| cascader | children 层级候选，叶子提交                  |

提交：类型规范化 → updateValueBefore → 联动与计算 → 单格校验。异步拒绝保留草稿；过期结果不得写回。

数字编辑器使用横向的「− 数值 +」控件，宽高限制在当前单元格内；按钮按 step 调整草稿，提交时仍执行数值规范化与校验。

只有校验错误显示红色三角标记，并在悬停时显示原因；普通批注仅在悬停时显示内容，不显示角标。错误修正后移除红色标记。

## 相关 API

[实例方法](/api/instance) · [配置](/config/table-config) · [命令](/api/commands)
