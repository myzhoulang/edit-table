import type { Row, TableConfig } from 'edit-table';
export const basicRows: Row[] = Array.from({ length: 20 }, (_, index) => ({
  id: `r${index + 1}`,
  name: `记录 ${index + 1}`,
  quantity: index + 1,
  date: '2026-10-30',
  status: 'ready',
  region: ['east', 'shanghai'],
}));
export const basicConfig: TableConfig = {
  rowNumbers: true,
  columns: [
    { field: 'name', title: '名称', editable: true, editor: 'text', width: 160 },
    {
      field: 'quantity',
      title: '数量',
      editable: true,
      editor: 'number',
      valueType: 'number',
      width: 110,
    },
    { field: 'date', title: '日期', editable: true, editor: 'date', valueType: 'date', width: 150 },
    {
      field: 'status',
      title: '状态',
      editable: true,
      editor: 'select',
      width: 150,
      options: async () => {
        try {
          return [
            { value: 'ready', label: '已就绪' },
            { value: 'pending', label: '待处理' },
            { value: 'closed', label: '已关闭', disabled: true },
          ];
        } catch (error) {
          throw new Error(`无法获取状态：${String(error)}`);
        }
      },
    },
    {
      field: 'region',
      title: '地区',
      editable: true,
      editor: 'cascader',
      width: 210,
      options: [
        {
          value: 'east',
          label: '华东',
          children: [
            { value: 'shanghai', label: '上海' },
            { value: 'hangzhou', label: '杭州' },
          ],
        },
        { value: 'south', label: '华南', children: [{ value: 'shenzhen', label: '深圳' }] },
      ],
    },
  ],
};
