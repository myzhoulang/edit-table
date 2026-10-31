# EditTable 组件架构分析与潜在 Bug 排查报告

生成日期：2026-10-31

## 一、组件整体架构分析

EditTable 是一个基于原生 TypeScript 与 CSS 构建的高性能可编辑表格组件库，并提供独立的 React 薄适配层（`@edit-table/react`）。整体设计采用了严格的单向数据流、不可变快照（Immutable Snapshot）与分层解耦架构，核心包运行时仅依赖 `async-validator`，支持 Node/SSR 环境安全导入。

### 1. 分层架构与职责边界

| 层级                                        | 核心文件                                                                                                                                                                                               | 核心职责与设计亮点                                                                                                                                                                                                                                                                          |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **模型与状态层 (Model)**                    | `packages/core/src/model/model.ts`<br>`packages/core/src/model/pipeline.ts`<br>`packages/core/src/model/grouping.ts`<br>`packages/core/src/model/validation.ts`<br>`packages/core/src/model/config.ts` | 负责配置归一化、拓扑排序计算规则（防循环依赖与多写冲突）、多级连续分组树（`GroupTree`）、字段联动（`fieldTransitions`）、派生行（`derivedRows` 聚合/输入/计算）与全局汇总（`summary`）、原子写入与事务回滚、Undo/Redo 历史栈、基于 `epoch` 代次的异步竞态取消机制。                         |
| **视图与度量层 (View)**                     | `packages/core/src/view/view.ts`<br>`packages/core/src/view/rows.ts`<br>`packages/core/src/view/metrics.ts`<br>`packages/core/src/view/columns.ts`                                                     | 将模型快照投影为视觉行（`VisualRow` 含真实记录与可见派生行）和合并跨度（`Span`：纵向分组自动合并、手动合并、行规则水平合并）。采用块级 Fenwick 树（树状数组，块大小 256）管理行高前缀和与偏移二分定位，支持增删行时的局部段拼接（`splice`）与列宽余量按比例分配。                           |
| **DOM 渲染与虚拟化层 (DOM)**                | `packages/core/src/dom/renderer.ts`<br>`packages/core/src/dom/table.ts`<br>`packages/core/src/dom/toolbar.ts`                                                                                          | 采用共享 `colgroup` 的双表结构（表头 `headTable` + 正文 `bodyTable`），避免原生 `position: sticky` 在复杂合并与缩放场景下的浏览器兼容问题；通过 CSS 变量与 `translate3d` 实现左右固定列及滚轮同帧补偿；引入 `tr`/`td` 节点池复用、独立合并覆盖层（`mergeLayer`）与选区层（`selectLayer`）。 |
| **交互与编辑器层 (Interactions & Editors)** | `packages/core/src/dom/interactions.ts`<br>`packages/core/src/dom/editors.ts`<br>`packages/core/src/utils/clipboard.ts`                                                                                | 实现类 Excel 选区与键盘交互（单击选中、直接键入覆盖、双击/F2 原值编辑、跨行/列粘贴、带引号 TSV 与 HTML 表格双向剪贴板转换）、右键上下文菜单、悬停批注/错误/溢出提示，以及五类编辑器（`text`、`number`、`date`、`select`、`cascader`）。                                                     |
| **框架适配层 (React Adapter)**              | `packages/react/src/index.ts`                                                                                                                                                                          | 零侵入封装 `createTable`，通过 `dataVersion` 显式控制外部数据源同步（避免父组件重渲染意外清空历史栈），并基于独立 `span` 挂载点 + React `createPortal` 实现自定义单元格渲染器与虚拟滚动节点池的安全解耦。                                                                                   |

---

## 二、潜在 Bug 与缺陷深度排查

通过对源码逐模块走查与边界条件推演，共排查出 **18 项潜在 Bug、边界缺陷与性能隐患**，按严重程度分为高危（P0）、中危（P1）、低危与体验问题（P2）三类。

### 1. 高危逻辑与状态缺陷 (P0)

#### Bug 1：派生行独立输入（`derivedRows` `input` 单元格）配置 `default` 默认值后无法清空，或在后续编辑中自动回弹为默认值

- **位置**：`packages/core/src/model/pipeline.ts:173-186`（对比同文件 `164-171`）
- **原因分析**：
  1. 在 `pipeline.ts:177` 中：
     ```ts
     const value = saved?.value ?? cell.default ?? null;
     ```
     当派生输入单元格为数值类型时，清空操作经归一化后 `saved.value` 为 `null`；由于使用了空值合并运算符 `??`，`null ?? cell.default` 会直接回退到 `cell.default`，导致带默认值的数值型派生输入永远无法被清空。
  2. 在 `pipeline.ts:179-185` 中：
     ```ts
     if (
       saved &&
       !same(saved.value, cell.default ?? null) &&
       saved.value !== '' &&
       saved.value !== undefined &&
       saved.value !== null
     )
       retained.push(saved);
     ```
     当用户将带默认值（如 `default: '默认备注'`）的文本型派生输入清空为 `''`，或修改为与 `cell.default` 相同的值时，慢路径（分组重新计算）不会将该 `saved` 推入 `retained`（即 `state.values`），导致用户的清空状态在下一次同组任意单元格编辑后丢失，自动回弹为 `cell.default`。
  3. 更矛盾的是，快路径（`pipeline.ts:164-171` 分组未变化直接复用 `previousResult` 时）无条件执行了 `if (stored) retained.push(stored)`，导致快慢路径对 `state.values` 的保留策略不一致，修改无关行时会意外触发 `derivedValuesChange`。
- **修复建议**：区分“未设置过 `saved`（`saved === undefined`）”与“用户显式设置为 `null` / `''`”；统一快慢路径的 `retained` 保留条件。

#### Bug 2：对纵向合并且配置了 `renameFields` 的分组列执行多行粘贴时，数据被末行覆盖且产生 $O(M^2)$ 写入放大

- **位置**：`packages/core/src/model/model.ts:251-271`
- **原因分析**：
  `apply(writes, source)` 中将 `'paste'` 视为 `user = true`，对 `writes` 中的每一条写入都执行整组展开（`state.entries.slice(group.start, group.end + 1)`）：
  1. **数据覆盖错误**：若某分组包含第 0、1、2 三行，用户从 Excel 复制了三行不同的分类名 `["分类A", "分类B", "分类C"]` 粘贴到这三行以拆分分组，第 0 行的写入会将 0~2 行全部改为 `"分类A"`，第 1 行的写入又将 0~2 行全部改为 `"分类B"`，第 2 行的写入最终将 0~2 行全部覆盖为 `"分类C"`，导致 `"分类A"` 和 `"分类B"` 丢失。
  2. **性能爆炸**：若一个大分组包含 $M$ 行（例如 5,000 行），用户整列粘贴该列时，`writes` 有 $M$ 项，`expanded` 会将其展开为 $M \times M = 25,000,000$ 条写入，同时 `state.entries.findIndex`（第 258 行）未使用已有的 `byKey`（`state.indices`）Map，而是每次做 $O(N)$ 线性查找，直接导致主线程卡死。
- **修复建议**：
  1. 将 `model.ts:258` 的 `state.entries.findIndex(...)` 替换为 `byKey.get(target.rowKey)`（$O(1)$）。
  2. 仅当写入目标是合并锚点单格（如 `source === 'edit'` 或单值粘贴到合并起始行，且 `writes` 未同时显式包含同组其他行）时才按 `renameFields` 展开。

#### Bug 3：聚合函数 `avg` / `min` / `max` 将空值（`null` 或 `""`）错误转换为 `0` 参与计算

- **位置**：`packages/core/src/model/pipeline.ts:216-231`
- **原因分析**：
  ```ts
  const numbers = getScopeRows()
    .map((row) => Number(read(row, cell.of ?? field)))
    .filter(Number.isFinite);
  ```
  在 JavaScript 中，`Number(null) === 0`、`Number("") === 0`、`Number(false) === 0`，且 `Number.isFinite(0) === true`（而 `Number(undefined)` 为 `NaN`）。由于数值列清空后的存储值为 `null`（见 `validation.ts:44`）：
  1. 当分组内存在未填写的空单元格（`null` 或 `""`）时，`min` 在正数集合中会错误返回 `0`；
  2. `max` 在负数集合中会错误返回 `0`；
  3. `avg` 会把空单元格当作 `0` 计入分母，拉低平均值；
  4. 当整组单元格全部为 `null` 时，`numbers` 长度为行数而非 `0`，导致 `min` / `max` / `avg` 返回 `0` 而不是预期的 `null`。
- **修复建议**：在映射为 `Number` 前先过滤掉 `raw === null || raw === undefined || raw === '' || typeof raw === 'boolean'`。

#### Bug 4：`rowHeight: 'auto'` 模式下触发高度更新时，`lastStart = -1` 导致 `renderOverlays` 瞬间渲染从第 0 行到当前视口的所有合并单元格

- **位置**：`packages/core/src/dom/renderer.ts:711-739` 与 `781-786`
- **原因分析**：
  在 `renderWindow` 中：
  1. 当 `config.rowHeight === 'auto'` 测量到行高变化（`changed === true`）时，第 722 行执行了 `lastStart = -1;`（此时 `lastEnd` 仍保持当前视口底部行号，例如十万行表格底部的 `99999`），并开启微任务重绘。
  2. 紧接着第 739 行同步调用 `renderOverlays()`。
  3. `renderOverlays()` 中计算合并层范围：`const start = Math.max(0, lastStart), end = Math.max(start, lastEnd - 1);`，因为 `lastStart` 已被设为 `-1`，`start` 变成 `0`，`end` 为 `99998`，导致 `view.intersecting(0, 99998)` 将第 0 行到第 99,998 行之间的**所有纵向合并块全部创建出 DOM 节点并挂载**，直到微任务执行时才销毁，在大表下会引发严重的帧率抖动与瞬时内存飙升。
- **修复建议**：在 `changed === true` 分支中，将 `lastStart = -1` 放在 `renderOverlays()` 之后，或直接 `return` 等待 `queueMicrotask` 中的 `renderWindow()` 统一绘制覆盖层。

#### Bug 5：编辑校验失败后点击表格外部，选区被提前清空导致后续键盘导航跳回 `(0, 0)`

- **位置**：`packages/core/src/dom/interactions.ts:928-941`
- **原因分析**：
  `document` 上的 `pointerdown` 监听器使用了捕获阶段（`capture: true`）：
  ```ts
  if (selection.ranges.length || selection.active || editors.active()) setSelection([]);
  ```
  当用户在编辑器中输入了非法值（例如在数字框输入字母或未通过 `updateValueBefore`），然后点击表格外部时：
  1. 捕获阶段的 `pointerdown` 先于输入框的 `focusout` 执行，立即调用 `setSelection([])` 将 `selection.active` 清空为 `null`。
  2. 随后 `focusout` 触发 `editors.save()`，因校验失败返回 `false`，编辑器保留在原单元格并聚焦输入框。
  3. 但此时表格的 `selection.active` 已经是 `null`；用户修正输入后按 `Enter` 或 `Tab` 提交时，`move()` 读取 `selection.active ?? { row: 0, col: 0 }`，光标会异常跳回表格左上角第一格 `(0, 0)`。
- **修复建议**：当 `editors.active()` 为 `true` 时，外部点击应先等待 `await editors.save()` 成功后，再执行 `setSelection([])`。

---

### 2. 中危功能与状态同步缺陷 (P1)

#### Bug 6：单格编辑后的增量校验遗漏联动字段、计算字段、分组重命名行及去重（`deduplication`）关联行

- **位置**：`packages/core/src/model/model.ts:222`、`388-418`
- **原因分析**：
  1. `write()` 仅对入参 `writes` 中的直接目标调用 `validateCell`（第 394 行），未包含：`apply()` 中因 `renameFields` 展开修改的同组其他行、因 `fieldTransitions` 级联修改的同列其他字段、以及因 `calculations` 重新计算且配有 `rules` 的目标字段。
  2. 当某列配置了 `deduplication`（去重校验）时：若行 A 与行 B 重复报错，随后用户修改了行 A 的值消除了重复，`touched` 集合仅包含行 A，行 B 在 `previousErrors` 中的重复错误不会被清除；反之，若修改行 A 导致行 A 与行 B 产生新重复，也只有行 A 会显示红标，行 B 不会触发重算。
  3. `commit()`（第 222 行）在 `updateFields`、`deleteRows`、`undo`、`redo`、`setDataSource` 时直接将内部 `errors = []` 清空，但**从未触发 `bus.emit('validationChange', { errors })`**，导致外部订阅 `validationChange` 的宿主状态与表格内部错误状态失步。
- **修复建议**：将实际发生变更的所有字段（`changes.map(c => c.target)`）以及启用了 `deduplication` 的同作用域行纳入增量校验范围；在 `commit()` 清空 `errors` 时若此前 `beforeErrors.length > 0` 则派发 `validationChange`。

#### Bug 7：多级分组配置 `idField` 时，不同父分组下的相同子组 `idField` 产生 ID 冲突，导致派生小计行错位与覆盖

- **位置**：`packages/core/src/model/grouping.ts:80-89` 与 `packages/core/src/view/rows.ts:26-34`
- **原因分析**：
  1. 在 `grouping.ts:80-89` 中，`occurrences` 按 `signature = JSON.stringify([rule.key, parent?.id, values])` 计数，而 `base` 直接取 `String(explicit)`（即 `row[rule.idField]`），且当 `occurrence === 0` 时 `id = base`。
  2. 如果两个不同父分组（`parent.id` 不同）下存在相同 `idField` 值的子分组（或非连续分组的 `values` 因其他分组字段不同而 `idField` 相同），它们的 `signature` 不同，因此 `occurrence` 均为 `0`，生成的 `GroupNode.id` 完全相同！
  3. 在 `view/rows.ts:26` 中：`const groups = new Map(state.tree.nodes.map((group) => [JSON.stringify([group.key, group.id]), group]))` 会发生键冲突，后一个子分组会覆盖前一个子分组，导致两个子分组的 `derivedRows` 小计行全部被定位到后一个子分组末尾。
  4. 此外，`grouping.ts:86` 判断 `explicit !== 0`，若业务数据的分组 ID 为数字 `0`，会被误判为空而回退为 JSON 签名字符串。
- **修复建议**：将 `occurrences` 按 `[rule.key, base]` 计数（或在 `id` 中包含 `parent?.id` 前缀），并移除 `explicit !== 0` 的限制。

#### Bug 8：纵向合并单元格（`.et-merged-cell`）缺失自定义渲染器（`render`）、批注（`comment`）、校验中状态（`et-validating`）、对比差异高亮（`et-diff`）与文本溢出提示（`overflowTooltip`）

- **位置**：`packages/core/src/dom/renderer.ts:781-862`、`949-960` 与 `packages/core/src/dom/interactions.ts:964-971`
- **原因分析**：
  纵向合并单元格在 `tbody` 中对应的 `<td>` 被清空为占位格（`et-merge-placeholder`），实际视觉内容由覆盖在上方的 `mergeLayer`（`.et-merged-cell`）绘制，但 `renderOverlays()` 仅同步了基础文本和 `et-invalid`：
  1. **不支持 `column.render`**：第 853 行只设置了 `content.textContent = text`，若该列配置了自定义 `render`（包括 React 适配层的 `renderers` Portal），合并单元格不会调用 `column.render`。
  2. **缺失批注与校验中样式**：未调用 `column.comment`、未设置 `et-comment` / `data-tooltip` 及 `et-validating` 类名。
  3. **缺失固定行对比高亮（`pinnedDiff`）**：`renderSelection()` 仅对 `row.tr` 下的 `td[data-field]` 切换 `.et-diff`，被上层不透明的 `.et-merged-cell` 遮挡。
  4. **溢出提示（`overflowTooltip`）失效**：`interactions.ts:964` 查找 `tr[data-view-index="${cell.row}"] [data-field="..."] .et-cell-content` 测量 `scrollWidth > clientWidth`，而纵向合并格的 `<tr>` 内部已被清空，导致 `content` 为 `null`，溢出 Tooltip 永远不会触发。

#### Bug 9：单元格 DOM 节点池复用（`reuseCells`）在转为纵向合并占位格时未清理残留类名与属性

- **位置**：`packages/core/src/dom/renderer.ts:569-587`
- **原因分析**：
  当 `reuseCells === true` 且当前列未配置 `column.cellClassName` 时，复用的 `td` 会保留上一次渲染的 `className`。若该 `td` 此前渲染的是带校验错误（`et-invalid`）、批注（`et-comment`）、校验中（`et-validating`）或对比差异（`et-diff`）的普通单元格，随后滚动复用到一个纵向合并跨度行（`span && span.end > span.start`）时，代码在第 586 行提前 `continue`，跳过了后续的 `classList.toggle('et-invalid', ...)` 等清理逻辑，导致底层的占位 `td` 残留红色错误三角、批注圆点、`title` 和 `data-tooltip`。
- **修复建议**：在 `if (span && span.end > span.start)` 分支中重置 `td.className = 'et-cell et-merge-placeholder'`，并清理 `aria-invalid`、`aria-busy`、`title` 与 `data-tooltip`。

#### Bug 10：`cascader` 与多选 `select` 编辑器的数组值与 `valueType` / 派生行标量约束 / 剪贴板复制粘贴不兼容

- **位置**：`packages/core/src/dom/editors.ts:130-136`、`216`，`packages/core/src/model/validation.ts:41-69`，`packages/core/src/utils/clipboard.ts:54-56`
- **原因分析**：
  1. `cascader`（`session.value = [...path, item].map(p => p.value)`）和开启 `multiple: true` 的 `select`（`session.value = selected`）产出的值均为数组（`unknown[]`）。
  2. 若在派生行输入格（`DerivedCell` `type: 'input'`）使用，保存时 `model.ts:276` 检查 `if (!scalar(write.value))` 会直接抛错 `'独立输入只能是有限标量'`。
  3. 复制此类单元格时，`stringifyTSV` 使用 `String(value)` 将数组转为 `"a,b"`，而界面展示 `textValue(value)` 转为 `"a / b"`；粘贴回表格时，`normalizeValue` 不会将字符串还原为数组，破坏了多选/级联数据的结构一致性。

---

### 3. 低危缺陷、边界条件与性能隐患 (P2)

#### Bug 11：编辑器与浮层采用 `position: fixed` + 视口坐标，在带 `transform` 的祖先容器或外层页面滚动时发生错位

- **位置**：`packages/core/src/styles/style.css:397, 502`、`packages/core/src/dom/editors.ts:53-70`、`packages/core/src/dom/table.ts:406`
- **原因分析**：
  1. `.et-editor`、`.et-context-menu`、`.et-toolbar-menu`、`.et-tooltip` 均使用 `position: fixed`，并直接将 `getBoundingClientRect()` 返回的视口坐标赋值给 `style.left / top`。由于 `popup` 默认挂载在 `.edit-table` 内部，一旦宿主页面在模态框（Modal）、抽屉（Drawer）或带有 CSS `transform` / `filter` / `backdrop-filter` 的容器内渲染表格，`position: fixed` 的包含块会变为该祖先容器而非视口，导致所有浮层位置严重偏移。
  2. 当表格外部页面（`window` / 父级滚动容器）发生滚动时，不会触发 `renderer.body` 的 `scroll` 事件，`editors.refresh()` 不会被调用，导致浮层停留在屏幕原位置与单元格脱节。

#### Bug 12：横向滚动或合并单元格部分滚出视口时，编辑器可见性判断不准确

- **位置**：`packages/core/src/dom/editors.ts:473-482`
- **原因分析**：
  ```ts
  const metrics = renderer.view().metrics;
  if (
    metrics.rowTop(session.cell.row + 1) <= renderer.body.scrollTop ||
    metrics.rowTop(session.cell.row) >= renderer.body.scrollTop + renderer.body.clientHeight
  ) {
    void save();
    return;
  }
  ```
  1. **纵向合并格提前关闭**：对于跨多行的合并单元格，`session.cell.row` 是起始行 `span.start`。只要合并格的第 1 行滚出顶部（哪怕剩余 9 行仍在视口中央），`metrics.rowTop(session.cell.row + 1) <= scrollTop` 就会立即成立并强制保存关闭编辑器。应使用 `span?.end ?? session.cell.row` 计算底部边界：`metrics.rowTop((span?.end ?? session.cell.row) + 1) <= renderer.body.scrollTop`。
  2. **缺少横向滚出判断**：当横向滚动导致非固定列的活动单元格被左右固定列遮挡或滚出水平视口时，编辑器未自动保存或裁剪，会悬浮在固定列上方甚至表格外部。

#### Bug 13：`number` 编辑器步进按钮（`+` / `-`）存在 IEEE 754 浮点数精度溢出且未校验 `min` / `max`

- **位置**：`packages/core/src/dom/editors.ts:328-334`
- **原因分析**：
  点击 `+` / `-` 时直接执行 `Number(input.value || 0) + direction * step`。当 `step: 0.1`、当前值为 `0.2` 时，点击 `+` 会将输入框文本设为 `"0.30000000000000004"`；若用户刚输入了带千分位或非数字字符，点击步进按钮会变成 `"NaN"`；且步进操作未受 `props.min` / `props.max` 约束。

#### Bug 14：编辑器打开期间再次双击同一单元格或触发 `start(cell)` 会导致编辑器保存并关闭

- **位置**：`packages/core/src/dom/editors.ts:250-256`
- **原因分析**：
  ```ts
  if (current) {
    const previous = current;
    void save().then((saved) => {
      if (saved && !current && !dead && previous.cell !== cell) start(cell, initial);
    });
    return;
  }
  ```
  `previous.cell !== cell` 比较的是对象引用而非 `{ row, col }` 坐标值。通过 `renderer.hit()` 每次都会生成新的 `{ row, col }` 对象引用，导致双击正在编辑的单元格会先执行 `save()` 关闭再重新 `start()` 打开（丢失光标位置）；而若传入同一个 `selection.active` 引用，则会直接保存并关闭编辑器。

#### Bug 15：空表（`dataSource: []`）且同时配置多个表级 `derivedRows`（含 `before-group` 与 `after-group`）时跳过排序

- **位置**：`packages/core/src/view/rows.ts:43-49`
- **原因分析**：
  `if (state.entries.length) extras.sort(...)` 在 `state.entries.length === 0` 时跳过了排序，若配置了多个表级派生行且混合了 `before-group` 与 `after-group`，其顺序未按 `priority` 排列。

#### Bug 16：大量校验错误或锁定行时，`renderRow` 每次滚动逐行拼接全量 `stamp` 字符串造成 $O(R \times E)$ 性能退化

- **位置**：`packages/core/src/dom/renderer.ts:498-503`、`549`、`591-594`
- **原因分析**：
  每次调用 `renderRow`（包含虚拟滚动期间每个进入视口的行），都会执行：
  1. `model.getErrors().map(...).join('|')`（遍历全表所有错误拼接长字符串）；
  2. `model.api.getLockedRows().join('|')`（每次将 `Set` 转为新数组再拼接）；
  3. 每个单元格执行 `model.getErrors().find(...)` 线性扫描。
     当全表校验产生数千条错误时，单次滚动渲染就会触发上百万次 `targetKey` 序列化与字符串拼接。应改为在模型或渲染器层维护按行/按单元格索引的 `Map<string, string>`，使单行 `stamp` 只依赖当前行自身的错误、锁定与挂起状态。

#### Bug 17：`rowNumbers: false` 且首列非固定列时，固定对比行（`pinned`）的操作按钮布局异常且随横向滚动消失

- **位置**：`packages/core/src/dom/renderer.ts:1006-1008` 与 `packages/core/src/styles/style.css:235, 344`
- **原因分析**：
  当 `rowNumbers: false` 时，固定行的定位与取消按钮 `.et-pin-controls` 被插入到第 0 列 `td` 中（在 `.et-cell-content` 之前），依赖 `.et-pinned-cell .et-pin-controls { float: right }`；但 `.et-cell-content` 是 `display: flex; height: 100%` 的块级弹性盒，不会环绕浮动元素，导致按钮与内容上下挤压错位；且若第 0 列未设置 `fixed: 'left'`，横向滚动后固定行控制按钮会滚出视口。

#### Bug 18：结构性命令（增删行、复制行、Undo/Redo）触发 `dataChange` 时，`changes` 始终为空数组 `[]`

- **位置**：`packages/core/src/model/model.ts:461, 638`
- **原因分析**：
  `handleCommand` 中执行 `undo`、`redo`、`deleteRows`、`duplicateRows`、`insertRowAbove`、`insertRowBelow` 时，调用 `commit(..., [])` 传入的 `changes` 均为 `[]`。若宿主监听 `dataChange` 事件并依赖 `event.changes` 进行增量同步或审计日志记录，将无法获知结构操作与撤销/重做所改动的目标单元格。

---

## 三、总结与改进路线建议

1. **优先修复高危数据一致性问题（Bug 1 ~ Bug 3）**：修正 `pipeline.ts` 中派生行默认值清空逻辑、聚合函数对 `null`/`""` 的数值过滤，以及 `model.ts` 中 `renameFields` 在批量粘贴时的展开条件与 $O(1)$ 下标查找。
2. **完善渲染与交互边界（Bug 4 ~ Bug 9）**：修复 `rowHeight: 'auto'` 下 `lastStart = -1` 引发的合并层全表节点创建，修复外部点击捕获监听与异步 `save()` 的时序冲突，补齐 `.et-merged-cell` 的自定义渲染、批注、差异高亮与溢出提示，并在节点池复用时彻底重置占位格状态。
3. **优化大表异常态性能与浮层定位（Bug 11 ~ Bug 16）**：将全表错误与锁定列表改为按行索引的 `Map` 查询以消除滚动时的字符串拼接开销，并针对 `transform` 容器和外层滚动完善浮层定位计算。

## 四、当前修复状态（2026-10-31）

以下记录覆盖上文的历史判断，以回归测试和当前实现为准：

- **1、2、3、6、7**：修复显式清空与默认值保留、合并写入去重及冲突拒绝、空值聚合、实际变更及去重关联校验、重复分组 ID 冲突。`idField: 0` 按原规格继续视为未设置；与默认值相同的派生输入不保存仍是正确契约。
- **4、8、9、16**：修复自动行高的覆盖层范围、合并格渲染及清理/批注/状态/提示、占位节点旧属性残留和滚动时全表错误扫描。
- **5、11、12、13、14**：修复编辑失败后选区、浮层包含块及外层滚动、完整合并范围与水平可见性、数字步进精度和边界、重复编辑同格的会话保留。
- **10**：普通记录的数组使用 JSON 数组复制粘贴；派生输入保持 Scalar，配置阶段明确拒绝数组编辑器。不是放开派生输入的值类型。
- **15**：明确空表 before-group 先于 after-group，同位置保留声明顺序。
- **17**：关闭行号时将逐行操作按钮放入常显固定管理区，避免随首列滚动或挤压内容。
- **18**：补齐字段差量，并增加包含前后记录及源下标的 recordChanges。

具体行为及兼容约定参见 DECISIONS.md 的“分析报告问题修复”，回归测试位于 packages/core/test/model/analysis-regressions.test.ts、packages/core/test/dom/analysis-regressions.test.ts 和 e2e/analysis-regressions.spec.ts。
