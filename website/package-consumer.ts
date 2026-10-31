import { createModel, type Submission, type TableConfig } from 'edit-table';
import { EditTable, type EditTableProps } from '@edit-table/react';
import { createElement } from 'react';
interface ConsumerRow {
  id: string;
  count: number;
  doubled?: number;
}
const config = {
  columns: [
    { field: 'count', title: '数量', editable: true, editor: 'number' },
    { field: 'doubled', title: '计算值' },
  ],
  calculations: [
    {
      id: 'double',
      scope: 'row',
      reads: ['count'],
      writes: ['doubled'],
      compute: ({ row }) => ({ doubled: row.count * 2 }),
    },
  ],
} satisfies TableConfig<ConsumerRow>;
const model = createModel<ConsumerRow>({
  config,
  dataSource: [{ id: 'r1', count: 2 }],
  rowKey: 'id',
});
export const submission: Submission<ConsumerRow> = model.getSubmission();
model.destroy();
const props = {
  config,
  dataSource: [{ id: 'r1', count: 2 }],
  dataVersion: 1,
} satisfies EditTableProps<ConsumerRow>;
export const reactConsumer = createElement(EditTable<ConsumerRow>, props);
