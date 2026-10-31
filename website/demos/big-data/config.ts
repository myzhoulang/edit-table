import type { Row, TableConfig } from 'edit-table';
export const bigConfig: TableConfig = {
  rowNumbers: true,
  rowPinning: { maxRows: 3 },
  virtualization: { threshold: 200, overscan: 8 },
  columns: Array.from({ length: 12 }, (_, index) => ({
    field: `col${index}`,
    title: `列 ${index + 1}`,
    width: 140,
    fixed: index === 0 ? 'left' : index === 11 ? 'right' : undefined,
    editable: index > 1,
  })),
};
export function createRows(count: number): Row[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `row-${index}`,
    ...Object.fromEntries(
      Array.from({ length: 12 }, (_, col) => [
        `col${col}`,
        col === 0 ? index + 1 : `数据 ${index + 1} / ${col + 1}`,
      ]),
    ),
  }));
}
