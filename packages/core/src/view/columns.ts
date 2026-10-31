import type { ColumnDef } from '../types';

/** 拖拽列优先保持指定宽度；其余列按基准宽度分配余量，整数边界保证头体一致。 */
export function fitColumnWidths<TRow extends object>(
  columns: readonly ColumnDef<TRow>[],
  overrides: ReadonlyMap<string, number>,
  available: number,
): number[] {
  const widths = columns.map((column) =>
    Math.round(overrides.get(column.field) ?? column.width ?? 140),
  );
  const total = widths.reduce((sum, width) => sum + width, 0),
    extra = Math.floor(available) - total;
  if (extra <= 0 || !columns.length) return widths;
  let flexible = columns.flatMap((column, index) => (overrides.has(column.field) ? [] : [index]));
  if (!flexible.length) flexible = [columns.length - 1];
  const weight = flexible.reduce((sum, index) => sum + widths[index]!, 0);
  let cumulative = 0,
    allocated = 0;
  for (const index of flexible) {
    cumulative += widths[index]!;
    const boundary = Math.round((extra * cumulative) / weight);
    widths[index]! += boundary - allocated;
    allocated = boundary;
  }
  return widths;
}
