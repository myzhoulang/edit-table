# 快速开始

## 本地运行

```sh
bun install
bun run dev
bun run docs:dev
```

构建后引入 createTable 与 edit-table/style.css。容器必须有显式高度；框架卸载时调用 destroy()。

```ts
import { createTable } from 'edit-table';
import 'edit-table/style.css';
const container = document.querySelector<HTMLElement>('#table');
if (!container) throw new Error('表格容器不存在');
const table = createTable(container, {
  rowKey: 'id',
  dataSource: [{ id: 'r1', name: '示例' }],
  config: { columns: [{ field: 'name', title: '名称', editable: true }] },
});
// 在宿主卸载时执行。
table.destroy();
```

createModel(options) 提供无 DOM 的数据、计算、历史、命令与校验。

## 相关 API

[实例方法](/api/instance) · [配置](/config/table-config) · [命令](/api/commands)
