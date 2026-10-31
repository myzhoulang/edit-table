import type { CellBehaviors, CellLayout, ColumnDef, TableConfig } from '../types';
import { read, same } from '../utils/immutable';

/** 按物理列解析布局绑定，保证模型校验与 DOM 行为覆盖使用同一套规则。 */
export function layoutCell<TRow extends object>(
  config: TableConfig<TRow>,
  row: Readonly<TRow>,
  column: ColumnDef<TRow>,
): { custom: boolean; cell?: CellLayout } {
  const layout = config.rowRules?.find((rule) =>
    same(read(row, rule.match.field), rule.match.equals),
  )?.layout;
  const keys = config.columns.map((item) => item.key ?? item.field),
    index = config.columns.indexOf(column);
  return {
    custom: Boolean(layout),
    cell: layout?.cells.find((cell) => {
      if (cell.column) return cell.column === (column.key ?? column.field);
      const start = keys.indexOf(cell.range?.from ?? ''),
        end = cell.range?.until ? keys.indexOf(cell.range.until) : keys.length;
      return index >= start && index < end;
    }),
  };
}
export function recordBehavior<TRow extends object>(
  config: TableConfig<TRow>,
  row: Readonly<TRow>,
  column: ColumnDef<TRow>,
  name: Exclude<keyof CellBehaviors, 'editable'>,
): boolean {
  const binding = layoutCell(config, row, column);
  if (binding.custom && !binding.cell) return false;
  return binding.cell?.behaviors?.[name] ?? column[name] !== false;
}
