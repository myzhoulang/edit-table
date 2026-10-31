# 公共类型

核心从入口导出所有公共类型。完整签名由 TypeDoc 根据真实源码生成：

[自动生成的类型入口](/api/generated/README)

主要类型：TableConfig、ColumnDef、CreateTableOptions、TableInstance、ModelInstance、CellTarget、RowTarget、CellRef、CellRange、SelectionSnapshot、CalculationRule、FieldTransition、GroupRule、DerivedRowRule、DerivedCell、DerivedValue、DerivedRowView、SummaryConfig、OperationAction、CommandResult、PasteReport、ValidationResult、DataState、TableEvents。

TRow 泛型贯穿列、计算、事件、提交与实例，宿主可使用普通 interface，无需添加索引签名。

增量汇总新增 `RecordChange<TRow>`、`SummaryUpdateContext<TRow>`，见 [汇总配置](/config/summary)。

`SelectionSnapshot.mode?: 'row'` 标识行号或定位 API 产生的行选择；该模式不按纵向合并扩选。`CellRef.row` 与显示行号均按含派生行的逻辑视图定位，行号为 `row + 1`。

## RowMetrics

`new RowMetrics(count, estimate)` 创建高度索引；count 为非负整数，estimate 为正数像素。`height(index)` 读取行高；`setHeight(index, height)` 接受不小于 20 的有限高度；`rowTop(index)` 返回前缀高度；`rowAtOffset(y)` 返回对应行，空表为 -1；`total()` 返回总高度。

`splice(start, deleteCount, insertCount): RowMetrics` 返回独立的新度量实例，插入行使用估算高度，其余测量值迁移。原实例不变，新旧实例之后的测量互不影响。非法拼接范围抛出 RangeError。
