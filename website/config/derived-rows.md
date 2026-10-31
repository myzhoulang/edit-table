# 派生行

id、level、labelColumn、label、cells 必填；level 为分组 key 或 table，position 默认 after-group，可设 before-group；visible 默认 true，隐藏仍参与计算。

aggregate 支持 sum / count / min / max / avg / 自定义；input 含 field / default / editor / rules / editable；compute 接收 group / rows / inputs / results；text 使用静态 text。输入的 editable 支持动态函数，整体互斥用 validateDerivedValues。

[公共类型](/api/types) · [快速开始](/guide/getting-started)

input 只支持 Scalar 值，因此不支持 cascader 或 multiple select；不兼容的配置会在创建或更新配置时报告错误。显式清空值会保留，等于默认值的输入不进入 `getDerivedValues()`。

当真实记录为空时，所有 before-group 行先显示，after-group 行后显示；同一位置的行保持声明顺序。avg / min / max 跳过空值和布尔值，作用域没有有效数值时返回 null。
