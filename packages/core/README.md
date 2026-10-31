# EditTable

原生 TypeScript 可编辑表格，运行时只依赖 async-validator。支持五种编辑器、分组合并、小计与独立输入、事务历史、固定对比行、行虚拟化和图标工具栏。

```ts
import { createTable } from 'edit-table';
import 'edit-table/style.css';

const container = document.querySelector<HTMLElement>('#table');
if (!container) throw new Error('表格容器不存在');
const table = createTable(container, {
  rowKey: 'id',
  dataSource: [{ id: 'r1', name: '名称', count: 1 }],
  config: {
    columns: [
      { field: 'name', title: '名称', editable: true },
      { field: 'count', title: '数量', editable: true, editor: 'number', valueType: 'number' },
    ],
  },
});
// 宿主卸载时清理实例。
table.destroy();
```

宿主容器需要明确高度。调用 createModel 可使用无 DOM 的数据与计算接口；包导入可用于 SSR。读取为冻结快照，setDataSource 为外部同步且清空历史，业务替换使用 replaceDataSource。

提交前依次调用 saveEdit()、validate()，通过后用 getSubmission() 采集 records / derivedValues / summary。
