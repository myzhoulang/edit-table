# 实例方法

原生 TableInstance 的逐方法参考。模型实例不提供主题、选区、列、定位、加载、固定行与编辑器方法。读取数据为冻结快照；getHiddenColumns / getLockedRows 返回副本。以下代码块可独立通过 TypeScript 检查。

## setDataSource

| 参数         | 必填 / 默认          |
| ------------ | -------------------- |
| rows: TRow[] | 无默认；完整外部快照 |

返回与失败条件：void；克隆后同步，不发 dataChange，清空历史。重复行标识或计算失败保留状态，交给 onError。

```ts
import type { TableInstance } from 'edit-table';
declare const table: TableInstance<{ id: string; qty: number }>;
table.setDataSource([{ id: 'r1', qty: 2 }]);
```

## replaceDataSource

| 参数         | 必填 / 默认          |
| ------------ | -------------------- |
| rows: TRow[] | 无默认；完整业务数据 |

返回与失败条件：void；业务替换并发 dataChange，清历史；失败报告 onError 并保留状态。

```ts
import type { TableInstance } from 'edit-table';
declare const table: TableInstance<{ id: string; qty: number }>;
table.replaceDataSource([{ id: 'r1', qty: 3 }]);
```

## getDataSource

| 参数 | 必填 / 默认 |
| ---- | ----------- |
| 无   | —           |

返回与失败条件：冻结的 readonly TRow[]，含计算字段、仅含真实记录；两次未变化读取复用引用。

```ts
import type { TableInstance } from 'edit-table';
declare const table: TableInstance<{ id: string; qty: number }>;
const records = table.getDataSource();
void records;
```

## updateFields

| 参数                                                       | 必填 / 默认                  |
| ---------------------------------------------------------- | ---------------------------- |
| patches: { rowKey: string; fields: Partial&lt;TRow&gt; }[] | 无默认；稳定行标识与字段补丁 |

返回与失败条件：CommandResult；整批一个原子事务，计算失败整体回滚；只读、锁定、计算字段不可写。

```ts
import type { TableInstance } from 'edit-table';
declare const table: TableInstance<{ id: string; qty: number }>;
const result = table.updateFields([{ rowKey: 'r1', fields: { qty: 4 } }]);
if (!result.ok) throw new Error(result.message);
```

## setDerivedValues

| 参数                   | 必填 / 默认             |
| ---------------------- | ----------------------- |
| values: DerivedValue[] | 无默认；[] 清空独立输入 |

返回与失败条件：void；完整替换，零值保留，等于默认值的输入省略；互斥检查或计算失败报告 onError。

```ts
import type { TableInstance } from 'edit-table';
declare const table: TableInstance<{ id: string; qty: number }>;
table.setDerivedValues([{ ruleKey: 'offer', groupKey: 'p1', field: 'total', value: 180 }]);
```

## getDerivedValues

| 参数 | 必填 / 默认 |
| ---- | ----------- |
| 无   | —           |

返回与失败条件：冻结的独立输入数组，只存偏离默认值的值；不混入真实记录。

```ts
import type { TableInstance } from 'edit-table';
declare const table: TableInstance<{ id: string; qty: number }>;
const values = table.getDerivedValues();
void values;
```

## getDerivedRows

| 参数 | 必填 / 默认 |
| ---- | ----------- |
| 无   | —           |

返回与失败条件：冻结的派生结果，包含 visible=false 的结果；用于汇总和提交映射。

```ts
import type { TableInstance } from 'edit-table';
declare const table: TableInstance<{ id: string; qty: number }>;
const subtotals = table.getDerivedRows();
void subtotals;
```

## getSummary

| 参数 | 必填 / 默认 |
| ---- | ----------- |
| 无   | —           |

返回与失败条件：冻结的 key 到原始有限标量映射，未进行展示格式化。

```ts
import type { TableInstance } from 'edit-table';
declare const table: TableInstance<{ id: string; qty: number }>;
const summary = table.getSummary();
void summary;
```

## getSubmission

| 参数 | 必填 / 默认 |
| ---- | ----------- |
| 无   | —           |

返回与失败条件：冻结的 records / derivedValues / summary；本方法不自动校验，应先 await validate()。

```ts
import type { TableInstance } from 'edit-table';
declare const table: TableInstance<{ id: string; qty: number }>;
const validation = await table.validate();
if (validation.valid) {
  const payload = table.getSubmission();
  void payload;
}
```

## updateConfig

| 参数                          | 必填 / 默认      |
| ----------------------------- | ---------------- |
| next: TableConfig&lt;TRow&gt; | 无默认；完整配置 |

返回与失败条件：boolean；先验证与投影，成功更新布局；失败返回 false、触发 configError 并保留有效配置。

```ts
import type { TableInstance } from 'edit-table';
declare const table: TableInstance<{ id: string; qty: number }>;
const accepted = table.updateConfig({ columns: [{ field: 'qty', title: '数量', editable: true }] });
void accepted;
```

## setReadonly

| 参数           | 必填 / 默认 |
| -------------- | ----------- |
| value: boolean | 无默认      |

返回与失败条件：void；切换整表写权限；选择和复制仍可用，不产生数据事务。

```ts
import type { TableInstance } from 'edit-table';
declare const table: TableInstance<{ id: string; qty: number }>;
table.setReadonly(true);
```

## setTheme

| 参数                                        | 必填 / 默认            |
| ------------------------------------------- | ---------------------- |
| theme: 'light' &#124; 'green' &#124; 'dark' | 无默认；创建时为 light |

返回与失败条件：void；同时更新根节点和外部 popup 容器，不产生历史。

```ts
import type { TableInstance } from 'edit-table';
declare const table: TableInstance<{ id: string; qty: number }>;
table.setTheme('dark');
```

## setDensity

| 参数                               | 必填 / 默认             |
| ---------------------------------- | ----------------------- |
| density: 'normal' &#124; 'compact' | 无默认；创建时为 normal |

返回与失败条件：void；估算行高 38 / 28 px；保留编辑草稿，显式数值 rowHeight 优先。

```ts
import type { TableInstance } from 'edit-table';
declare const table: TableInstance<{ id: string; qty: number }>;
table.setDensity('compact');
```

## getSelection

| 参数 | 必填 / 默认 |
| ---- | ----------- |
| 无   | —           |

返回与失败条件：冻结 SelectionSnapshot；ranges 和 active 使用包含派生行的逻辑坐标。

```ts
import type { TableInstance } from 'edit-table';
declare const table: TableInstance<{ id: string; qty: number }>;
const active = table.getSelection().active;
void active;
```

## setSelection

| 参数                | 必填 / 默认     |
| ------------------- | --------------- |
| ranges: CellRange[] | 无默认；[] 清空 |

返回与失败条件：void；越界裁剪、合并递归扩展（受 expandSelection 控制），触发 selectionChange。

```ts
import type { TableInstance } from 'edit-table';
declare const table: TableInstance<{ id: string; qty: number }>;
table.setSelection([{ anchor: { row: 0, col: 0 }, focus: { row: 2, col: 0 } }]);
```

## setHiddenColumns

| 参数             | 必填 / 默认         |
| ---------------- | ------------------- |
| fields: string[] | 无默认；[] 显示全部 |

返回与失败条件：void；先保存编辑，失败时不切换；只接收已知字段，成功清空选区。

```ts
import type { TableInstance } from 'edit-table';
declare const table: TableInstance<{ id: string; qty: number }>;
table.setHiddenColumns(['qty']);
```

## setColumnVisibility

| 参数                            | 必填 / 默认 |
| ------------------------------- | ----------- |
| field: string；visible: boolean | 无默认      |

返回与失败条件：void；单列显隐，沿用保存编辑与清选区规则。未知列忽略。

```ts
import type { TableInstance } from 'edit-table';
declare const table: TableInstance<{ id: string; qty: number }>;
table.setColumnVisibility('qty', true);
```

## getHiddenColumns

| 参数 | 必填 / 默认 |
| ---- | ----------- |
| 无   | —           |

返回与失败条件：string[] 副本；修改返回数组不影响实例。

```ts
import type { TableInstance } from 'edit-table';
declare const table: TableInstance<{ id: string; qty: number }>;
const hidden = table.getHiddenColumns();
void hidden;
```

## setColumnWidth

| 参数                         | 必填 / 默认     |
| ---------------------------- | --------------- |
| field: string；width: number | 无默认；单位 px |

返回与失败条件：void；裁剪到 minWidth / maxWidth，非法数值或未知列忽略，触发 columnResize。

```ts
import type { TableInstance } from 'edit-table';
declare const table: TableInstance<{ id: string; qty: number }>;
table.setColumnWidth('qty', 160);
```

## scrollToRow

| 参数                                           | 必填 / 默认       |
| ---------------------------------------------- | ----------------- |
| target: RowTarget；opts?: { select?: boolean } | select 默认 false |

返回与失败条件：void；按稳定身份定位；目标不存在时无操作；select=true 选择该逻辑行。

```ts
import type { TableInstance } from 'edit-table';
declare const table: TableInstance<{ id: string; qty: number }>;
table.scrollToRow({ kind: 'record', rowKey: 'r1' }, { select: true });
```

## scrollToCell

| 参数               | 必填 / 默认 |
| ------------------ | ----------- |
| target: CellTarget | 无默认      |

返回与失败条件：void；纵向和非固定列横向滚动到可见位置；隐藏或不存在的目标忽略。

```ts
import type { TableInstance } from 'edit-table';
declare const table: TableInstance<{ id: string; qty: number }>;
table.scrollToCell({ kind: 'record', rowKey: 'r1', field: 'qty' });
```

## focus

| 参数 | 必填 / 默认 |
| ---- | ----------- |
| 无   | —           |

返回与失败条件：void；聚焦表格的键盘入口。

```ts
import type { TableInstance } from 'edit-table';
declare const table: TableInstance<{ id: string; qty: number }>;
table.focus();
```

## pinRow

| 参数                            | 必填 / 默认                |
| ------------------------------- | -------------------------- |
| target: RowTarget &#124; number | 无默认；数字为逻辑视图下标 |

返回与失败条件：boolean；容量 FIFO，重复、无效或 rowPinning 关闭返回 false；不记录历史。

```ts
import type { TableInstance } from 'edit-table';
declare const table: TableInstance<{ id: string; qty: number }>;
table.pinRow({ kind: 'record', rowKey: 'r1' });
```

## unpinRow

| 参数              | 必填 / 默认 |
| ----------------- | ----------- |
| target: RowTarget | 无默认      |

返回与失败条件：boolean；取消固定，未固定返回 false；触发 pinnedRowsChange。

```ts
import type { TableInstance } from 'edit-table';
declare const table: TableInstance<{ id: string; qty: number }>;
table.unpinRow({ kind: 'record', rowKey: 'r1' });
```

## clearPinnedRows

| 参数 | 必填 / 默认 |
| ---- | ----------- |
| 无   | —           |

返回与失败条件：void；清空固定对比区，不影响历史和真实记录。

```ts
import type { TableInstance } from 'edit-table';
declare const table: TableInstance<{ id: string; qty: number }>;
table.clearPinnedRows();
```

## getPinnedRows

| 参数 | 必填 / 默认 |
| ---- | ----------- |
| 无   | —           |

返回与失败条件：冻结固定信息数组：target / viewIndex / texts；仅有文本，不挂载正文 render。

```ts
import type { TableInstance } from 'edit-table';
declare const table: TableInstance<{ id: string; qty: number }>;
const pinned = table.getPinnedRows();
void pinned;
```

## getLockedRows

| 参数 | 必填 / 默认 |
| ---- | ----------- |
| 无   | —           |

返回与失败条件：稳定行身份的 string[] 副本。

```ts
import type { TableInstance } from 'edit-table';
declare const table: TableInstance<{ id: string; qty: number }>;
const locked = table.getLockedRows();
void locked;
```

## setLockedRows

| 参数              | 必填 / 默认         |
| ----------------- | ------------------- |
| rowKeys: string[] | 无默认；[] 解锁全部 |

返回与失败条件：void；忽略未知身份，触发 lockChange；锁定阻止编辑、清空和删除。

```ts
import type { TableInstance } from 'edit-table';
declare const table: TableInstance<{ id: string; qty: number }>;
table.setLockedRows(['r1']);
```

## saveEdit

| 参数 | 必填 / 默认 |
| ---- | ----------- |
| 无   | —           |

返回与失败条件：Promise&lt;boolean&gt;；提交草稿，类型、拦截或规则失败保留编辑器；IME 组合中返回 false。

```ts
import type { TableInstance } from 'edit-table';
declare const table: TableInstance<{ id: string; qty: number }>;
const saved = await table.saveEdit();
void saved;
```

## validate

| 参数 | 必填 / 默认 |
| ---- | ----------- |
| 无   | —           |

返回与失败条件：Promise&lt;ValidationResult&gt;；保存草稿后校验全表，首错定位；并发旧校验返回过期且不发布。

```ts
import type { TableInstance } from 'edit-table';
declare const table: TableInstance<{ id: string; qty: number }>;
const result = await table.validate();
if (!result.valid) {
  const issue = result.firstError;
  void issue;
}
```

## loadData

| 参数 | 必填 / 默认 |
| ---- | ----------- |
| 无   | —           |

返回与失败条件：Promise&lt;boolean&gt;；发起新请求并取消旧请求，成功应用返回 true；失败保留旧数据。无 dataLoader 时调用 onRetry。

```ts
import type { TableInstance } from 'edit-table';
declare const table: TableInstance<{ id: string; qty: number }>;
const applied = await table.loadData();
void applied;
```

## retryLoad

| 参数 | 必填 / 默认 |
| ---- | ----------- |
| 无   | —           |

返回与失败条件：Promise&lt;boolean&gt;；与 loadData 相同，用于失败态重试。

```ts
import type { TableInstance } from 'edit-table';
declare const table: TableInstance<{ id: string; qty: number }>;
await table.retryLoad();
```

## getDataState

| 参数 | 必填 / 默认 |
| ---- | ----------- |
| 无   | —           |

返回与失败条件：冻结的 status / loading / hasData / error / requestId 快照。

```ts
import type { TableInstance } from 'edit-table';
declare const table: TableInstance<{ id: string; qty: number }>;
const state = table.getDataState();
void state;
```

## setLoadingState

| 参数                                                                                       | 必填 / 默认            |
| ------------------------------------------------------------------------------------------ | ---------------------- |
| state: { loading?: boolean; loadError?: unknown; emptyReason?: 'empty' &#124; 'filtered' } | 省略的字段保留宿主状态 |

返回与失败条件：void；用于宿主管理请求，刷新可保留已有表格；loadError:null 清除错误。

```ts
import type { TableInstance } from 'edit-table';
declare const table: TableInstance<{ id: string; qty: number }>;
table.setLoadingState({ loading: false, loadError: null, emptyReason: 'filtered' });
```

## executeCommand

| 参数                            | 必填 / 默认                      |
| ------------------------------- | -------------------------------- |
| name: string；payload?: unknown | payload 默认由命令和当前选区决定 |

返回与失败条件：Promise&lt;CommandResult&gt;；按实例串行，失败含 code / message；完整参数见命令页。

```ts
import type { TableInstance } from 'edit-table';
declare const table: TableInstance<{ id: string; qty: number }>;
const result = await table.executeCommand('paste', { text: '2\t3' });
if (!result.ok) throw new Error(result.message);
```

## getCommandState

| 参数         | 必填 / 默认 |
| ------------ | ----------- |
| name: string | 无默认      |

返回与失败条件：{ enabled, reason? }；结合只读、销毁、历史和当前选区给出可用性，具体 payload 仍由执行时验证。

```ts
import type { TableInstance } from 'edit-table';
declare const table: TableInstance<{ id: string; qty: number }>;
const canUndo = table.getCommandState('undo').enabled;
void canUndo;
```

## on

| 参数                                          | 必填 / 默认 |
| --------------------------------------------- | ----------- |
| event: EventName；handler: (event) =&gt; void | 无默认      |

返回与失败条件：返回取消订阅函数；事件快照冻结，监听异常交给 onError，其他监听继续执行。

```ts
import type { TableInstance } from 'edit-table';
declare const table: TableInstance<{ id: string; qty: number }>;
const off = table.on('dataChange', (event) => {
  const rows = event.dataSource;
  void rows;
});
off();
```

## destroy

| 参数 | 必填 / 默认 |
| ---- | ----------- |
| 无   | —           |

返回与失败条件：void；幂等清理请求、观察器、监听、浮层、节点池和历史。销毁后命令返回 destroyed，写操作无效。

```ts
import type { TableInstance } from 'edit-table';
declare const table: TableInstance<{ id: string; qty: number }>;
table.destroy();
table.destroy();
```

[命令](/api/commands) · [事件](/api/events) · [配置](/config/table-config)
