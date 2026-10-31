# 框架集成

React 使用独立的 `@edit-table/react` 适配包，核心没有 React 运行时依赖。支持 Hooks 的 React / ReactDOM 16.8–19；自动化以 19.3.1 验证。Vue 可以在 onMounted 创建原生实例，onBeforeUnmount 销毁。

不要每次框架 render 都 setDataSource，它会清空历史；外部数据采用显式同步。config 变化用 updateConfig，失败处理 configError 并保留上一配置。

## React 示例

```ts
import { createElement, createRef } from 'react';
import { EditTable } from '@edit-table/react';
import type { TableInstance, TableConfig } from 'edit-table';

type Item = { id: string; name: string };
const ref = createRef<TableInstance<Item>>();
const config = {
  columns: [{ field: 'name', title: '名称', editable: true }],
} satisfies TableConfig<Item>;
const element = createElement(EditTable<Item>, {
  ref,
  config,
  dataSource: [{ id: 'r1', name: '主会场' }],
  dataVersion: 1,
  options: { rowKey: 'id', height: 320 },
  renderers: { name: (value) => createElement('strong', null, String(value)) },
});
void element;
```

在宿主入口导入 `edit-table/style.css`。ref 在挂载后得到 `TableInstance<Item>`，卸载后为 null。

| 属性              | 默认值    | 更新策略与失败条件                                            |
| ----------------- | --------- | ------------------------------------------------------------- |
| config            | 必填      | 身份变化时 updateConfig；失败回调 onConfigError，保留有效界面 |
| dataSource        | []        | 仅初始化和 dataVersion 变化时读取                             |
| dataVersion       | undefined | 显式版本标识，变化才 setDataSource 并清空历史                 |
| options           | {}        | 创建时选项；动态主题、密度、加载通过 ref 方法更新             |
| renderers         | {}        | 按列 field 映射 React 内容，以 portal 挂载，变化时更新配置    |
| onReady           | 无        | 每次实例创建后调用；开发 StrictMode 会创建两次                |
| onDataChange      | 无        | 真实记录事务完成后回传冻结快照                                |
| onConfigError     | 无        | 配置更新失败的结构化错误                                      |
| className / style | 无        | 适配组件外层样式                                              |

保持 config 和 renderers 的引用稳定，避免父组件每次 render 都触发配置更新。外部重新加载数据后，同时更新 dataSource 与 dataVersion。本地 `onDataChange` 用于保存或展示状态，不必立即增加 dataVersion 回灌。

原生列 render 写入给定容器并返回清理函数；React renderers 使用独立 portal 容器，使核心回收虚拟行后仍可安全卸载 React 内容。StrictMode 的额外 setup / cleanup 按 [React 官方说明](https://react.dev/reference/react/StrictMode)处理；portal 保留 React 上下文，见 [createPortal](https://react.dev/reference/react-dom/createPortal)。

## 可运行示例

<ReactDemo />

## 相关 API

[实例方法](/api/instance) · [配置](/config/table-config) · [命令](/api/commands)
