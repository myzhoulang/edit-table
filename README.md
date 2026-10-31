# EditTable

原生 TypeScript 可编辑表格组件库，使用两表布局。包含图标工具栏、分组合并、计算联动、独立优惠输入、固定对比行和 VitePress 文档。

## 运行

环境：Node.js 22.12+（本次使用 24.15.0）、Bun 1.3+。

```sh
bun install
bun run dev --port 5179
bun run docs:dev --port 5173
```

- 演示：<http://127.0.0.1:5179/>，对应设计稿，支持 24 / 10,000 / 100,000 行。
- 文档：<http://127.0.0.1:5173/>，包含指南、配置、API 与交互示例。

## 校验与构建

```sh
bun run typecheck
bun run test
bun run test:e2e
bun run test:spike
bun run test:visual
bun run lint
bun run build
bun run docs:build
bun run test:package
bun run check:no-sticky
bun run benchmark
bun run benchmark:browser
bun run benchmark:report
```

视觉基线针对 macOS Chromium，使用独立配置与 CI 作业；其他系统运行跨引擎结构和交互测试。

首次运行浏览器测试需要 `bunx playwright install chromium firefox webkit`。Playwright 测试会自动启动演示与文档服务；浏览器基准需要演示服务已启动。

## 使用

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
// 在宿主卸载时执行。
table.destroy();
```

容器需要显式高度。`createModel` 提供不依赖 DOM 的数据、计算、历史、命令与校验接口。

## 结构

- `packages/core`：核心包，ESM、类型声明、独立 CSS；运行时仅依赖 async-validator。
- `packages/react`：React 薄适配，ref、显式数据版本同步与 portal；React 为 peerDependency。
- `examples/quotation`：设计稿案例 B、分层优惠案例 A，以及 BigNumber 精确金额函数。
- `website`：VitePress 文档，配置代码与运行示例共享来源。
- `spikes`：独立布局验证和报告。
- `artifacts`：测试、性能原始采样和截图。
- `DECISIONS.md`：已确认的契约解释。
- `IMPLEMENTATION.md`：实现与验收边界。

React 用法见 [适配包说明](packages/react/README.md)与文档“框架集成”。性能目标与实际结果分开记录，详见文档性能页；本机正式 Safari 已完成基础操作检查，真实中文输入法、物理触控板等剩余验收见 artifacts/MANUAL-ACCEPTANCE.md。
