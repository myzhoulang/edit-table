# 主题、密度与工具栏

theme 为 light / green / dark，density 为 normal / compact；切换保留数据、草稿与历史。

固定对比行与管理栏随主题使用浅蓝、浅绿或深蓝灰底色，固定区底部分隔线同步切换。宿主可通过 --edit-table-pinned-bg 与 --edit-table-pinned-border 分别覆盖固定区底色和分隔线颜色；整列视觉选框继续叠加主题选中色。

默认图标工具栏包含撤销、重做、主题、密度、列显隐和全屏。启用手动合并或对比行时追加对应图标。toolbar: false 隐藏；toolbarActions 追加 { key, label, icon, execute } 业务按钮，中文提示与 aria-label 均可用。

cellStyle / cellClassName 支持静态值或同步函数。颜色、字体、对齐、换行、padding 可用，定位、尺寸、边框、保留类名和组件 CSS 变量被拒绝。

## 相关 API

[实例方法](/api/instance) · [配置](/config/table-config) · [命令](/api/commands)
