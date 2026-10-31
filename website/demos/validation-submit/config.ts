import { basicConfig, basicRows } from '../basic/config';
export const validationConfig: typeof basicConfig = {
  ...basicConfig,
  columns: basicConfig.columns.map((column) =>
    column.field === 'name'
      ? {
          ...column,
          rules: [{ required: true, message: '名称不能为空' }],
          deduplication: { message: '名称不能重复' },
        }
      : column.field === 'quantity'
        ? { ...column, rules: [{ type: 'number', min: 0, message: '数量不能为负数' }] }
        : column,
  ),
};
export const validationRows = [
  ...basicRows,
  ...basicRows
    .slice(0, 10)
    .map((row, index) => ({ ...row, id: `extra-${index}`, name: `附加记录 ${index}` })),
];
