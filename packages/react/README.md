# @edit-table/react

React 薄适配，核心表格由 `edit-table` 提供。peerDependencies 支持 React / ReactDOM 16.8–19，当前自动化使用 19.3.1 验证。

```tsx
import { useRef } from 'react';
import { EditTable } from '@edit-table/react';
import type { TableInstance } from 'edit-table';
import 'edit-table/style.css';

type Item = { id: string; name: string };
const config = { columns: [{ field: 'name', title: '名称', editable: true }] };

export function Example() {
  const ref = useRef<TableInstance<Item>>(null);
  return (
    <EditTable<Item>
      ref={ref}
      config={config}
      dataSource={[{ id: 'r1', name: '示例' }]}
      dataVersion={1}
      options={{ rowKey: 'id', height: 360 }}
    />
  );
}
```

`dataSource` 为初始化数据；只有 `dataVersion` 变化才进行外部同步并清空历史。普通父组件重渲染不会覆盖本地编辑。`config` 身份变化走 `updateConfig`，失败通知 `onConfigError` 并保留有效配置。

`options` 是创建时选项；动态主题、密度和加载状态通过 ref 实例更新。`onDataChange`、`onConfigError`、`onReady` 是可更新的回调。

`renderers={{ name: (value) => <strong>{String(value)}</strong> }}` 使用 React portal 渲染。核心移除单元格后，适配器在下一次 React 更新时卸载内容并清理 effect。StrictMode 重新挂载和正常卸载均调用 destroy。

更多示例见文档的“框架集成”。
