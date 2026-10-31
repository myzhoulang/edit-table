# 计算

CalculationRule 的 id、scope、reads、writes、compute 必填。scope 为 row 或 { group }；compute 同步返回 `Record<string, Scalar>` 或 null。

cyclic-dependency 表示循环，duplicate-writer 表示重复输出，unknown-reference 表示未知字段 / 分组，calc-error 表示运行时输出或计算错误。FieldTransition 包含 id / trigger.field / apply，同步返回 `Partial<TRow>` 或 null。

[公共类型](/api/types) · [快速开始](/guide/getting-started)
