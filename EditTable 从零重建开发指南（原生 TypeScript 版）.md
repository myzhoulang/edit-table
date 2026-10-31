# EditTable 从零重建开发指南（原生 TypeScript 版）

基准日期：2026-10-27 ｜ 读者：从空目录开始实现的开发者或开发 agent ｜ 取代：《EditTable 项目总结与从零重建规格》

> 本文重新整理旧规格：保留已验证的行为契约，并按新约束重定架构——**原生 TypeScript**、**两表布局（头表 + 主体表，不使用 position: sticky）**、**可固定对比行**、**VitePress 文档站**。本文自包含，不依赖旧文档或旧仓库即可开工；与旧规格冲突时以本文为准。

## 0. 本文怎么用

1. 先读 §1–§4 掌握目标、决策与分层，再按 §18 的里程碑逐个实现。
2. 每个里程碑都有交付物与验收，未通过不进入下一阶段。
3. 浏览器布局行为（横向同步、固定列、合并叠加层、虚拟化）不要凭经验假定，必须先完成 §18 的 M0 技术验证。
4. 「必须」是验收项；「建议」是可调整的实现选择；「路线图」（§21）是本期不做的内容。
5. 发现规格自相矛盾时，提出具体差异，不要默默扩大或缩小功能。

## 1. 目标与范围

EditTable 是面向复杂业务录入的、配置驱动的可编辑表格库：把电子表格式的选择、键盘与批量写入，与业务录入所需的校验、多层分组、字段联动、小计与优惠输入、提交数据采集组合在一起。

典型流程：加载真实记录 → 配置列与分组 → 编辑或批量粘贴 → 自动联动与重算 → 修正校验错误 → 保存当前编辑 → 全表校验 → 采集真实记录、独立输入与汇总。

### 1.1 交付物

| 交付物 | 说明 |
| --- | --- |
| `edit-table` 核心包 | 原生 TypeScript，ESM + `.d.ts` + CSS；零框架依赖；浏览器 DOM |
| React 薄适配（后置） | 只负责挂载、销毁、属性同步、自定义内容渲染 |
| VitePress 文档站 | 说明、配置参考、API、可交互 demo、综合报价案例 |
| 测试与基准 | Vitest（模型 / jsdom）、Playwright（真实浏览器）、性能基准脚本 |

### 1.2 能力总览

| 领域 | 必须具备的能力 |
| --- | --- |
| 编辑 | text / number / date / select（可搜索、异步候选）/ cascader；按行切换编辑器 |
| 选择 | 活动格、矩形拖选、Shift 扩选、整行 / 整列、边缘自动滚动；合并格按逻辑坐标 |
| 键盘 | 方向、Enter、Tab、Esc、直接键入、IME、全选、清空、撤销重做 |
| 剪贴板 | 复制网格；粘贴 TSV / HTML table / 多行文本；结果报告 |
| 模型 | N 层连续分组、真实字段计算、派生行（小计 / 优惠）、独立输入、汇总 |
| 合并 | 自动纵向同值合并、横向布局合并、预览确认式手动合并 |
| 布局 | 两表布局、固定表头、左右固定列、列宽拖拽、列显隐、行号、条纹 |
| 对比 | **固定对比行**：把任意行固定在表头下方，滚动时始终可见，用于与其他行比较 |
| 性能 | 行虚拟化、增量刷新 |
| 校验 | async-validator、动态规则、去重、提交首错定位 |
| 历史 | 事务级撤销重做 |
| 加载 | 首次加载、刷新、空态、失败重试、请求竞态保护 |
| 外观 | light / green / dark、normal / compact、条件样式、溢出全文与错误浮层 |
| 契约 | `executeCommand`、命令状态、不可变事件 |
| 文档 | VitePress 站点：说明、配置、API、交互 demo |

### 1.3 业务无关原则

核心不得出现报价、税率、发票等字段名；这些只存在于 `examples/quotation`。没有分组、没有计算的普通表格必须能独立工作。

### 1.4 明确不做

后端与持久化、单元格公式、多人协作、Canvas 渲染、排序过滤、多 Sheet、Vue / Angular 适配包（文档给原生封装示例即可）。详见 §21。

## 2. 技术基线与目录

### 2.1 工具链

| 项 | 选择 | 备注 |
| --- | --- | --- |
| 语言 | TypeScript（strict） | 公共类型带泛型 `TRow` |
| 构建 | Vite library mode | 输出 ESM；样式单独 `style.css` |
| 测试 | Vitest；Playwright | 模型层跑 Node；DOM 集成跑 jsdom；布局 / 滚动 / IME / 剪贴板必须真实浏览器 |
| 样式 | 原生 CSS + CSS 变量 | 变量前缀 `--edit-table-*`；不要求使用方安装 Less |
| 校验 | async-validator | 唯一运行时依赖 |
| 文档站 | VitePress | 独立 package（`website/`） |
| 检查 | oxlint 或 eslint，prettier | 必须真实写入 scripts 且可执行 |

### 2.2 目录

```text
edit-table/
├─ packages/
│  ├─ core/                  # 原生库
│  │  ├─ src/model/          # 纯模型，无 DOM
│  │  ├─ src/view/           # 视图模型，无 DOM
│  │  ├─ src/dom/            # 两表布局、渲染、编辑器、浮层
│  │  ├─ src/commands/       # 命令、事务、历史、事件
│  │  ├─ src/utils/          # 事件总线、TSV、会话代次、币种
│  │  ├─ src/styles/         # style.css、themes.css
│  │  └─ test/
│  └─ react/                 # 薄适配（M9）
├─ website/                  # VitePress 文档站（§16）
├─ examples/quotation/       # 报价配置与金额函数（文档站与测试共用）
├─ e2e/                      # Playwright
└─ scripts/performance/      # 性能基准
```

### 2.3 根 scripts（必须存在且可执行）

`build`、`test`、`test:core`、`test:dom`、`test:e2e`、`lint`、`docs:dev`、`docs:build`。不得保留指向不存在文件的脚本。

## 3. 关键决策记录

| 编号 | 决策 | 原因 |
| --- | --- | --- |
| D1 | 原生 TypeScript；核心不 import React / Vue / antd；日期、下拉、浮层自行实现 | 核心可在 Node 里测试模型；适配层只做挂载 |
| D2 | **两表布局**：头表（`thead` + 固定对比行 `tbody`）与主体表；全库禁用 `position: sticky`，表头、固定列、固定对比行、合并格内容都不得使用 | sticky 在表格边框折叠、rowspan、浮层与部分浏览器下有缺陷；两表让固定对比行天然与表头同区，并与列宽、横向滚动共用同一套同步 |
| D3 | 横向滚动以主体容器为唯一源；头表经 transform 同步；固定列经 transform 补偿 | 单一输入，避免双向同步环 |
| D4 | 行虚拟化：spacer 行 + DOM 节点池 | 大数据；这是与旧实现最大的差异 |
| D5 | 纵向合并用「占位格 + 合并叠加层」，不用原生 rowspan；横向合并用原生 colspan | 原生 rowspan 的锚点行滚出窗口后整格消失，与虚拟化不兼容 |
| D6 | 命中测试基于坐标与行度量，不依赖 DOM 事件目标 | 叠加层与虚拟化下事件目标不可靠 |
| D7 | 数据与视图分离：真相在 model，Row / Cell 只是视图投影 | 避免旧实现的大型 Engine 与对象常驻内存 |
| D8 | 只提供新契约：`executeCommand` + 稳定事件；不带旧 onChange revision、旧入口兼容 | 重建无历史包袱 |
| D9 | core 不含金额与税率；BigNumber 仅在 `examples/` | 业务无关 |
| D10 | 浮层挂在实例内 popup 层，可用 `getPopupContainer` 改挂载点 | 多实例隔离，destroy 可清理 |
| D11 | 文档站用 VitePress；demo 在 `onMounted` 创建实例；demo 配置文件同时被页面展示和运行 | 文档与代码不漂移 |

### 3.1 与旧规格的差异

- **新增**：两表布局约束、固定对比行并入头表、虚拟化、合并叠加层、坐标命中测试、新增能力（§14.5）、文档站规格、M0 技术验证。
- **删除**：旧 API 兼容、React 17 绑定、Less。
- **调整**：React 适配后置到 M9；Cell / Row 不再是真相来源。

## 4. 架构分层

```text
宿主 / 适配层
   │  createTable · executeCommand · on
   ▼
┌──────────── Table（外观，只做编排）────────────┐
│ commands   history   validation   loader        │
├──────────── model（纯 TS，可在 Node 测试）──────┤
│ config  ownedData  grouping  calculations       │
│ fieldTransitions  derivedModel  summary         │
├──────────── view（纯 TS）───────────────────────┤
│ flatten → VisualRow[]   spans   coordinateMap   │
│ rowMetrics（高度前缀和）   selection（逻辑坐标）│
├──────────── dom ────────────────────────────────┤
│ layout（两表）  scrollSync  fixedColumns        │
│ pinnedRows  virtualizer  mergeLayer  selectLayer│
│ editors  popups  tooltip  contextMenu           │
└─────────────────────────────────────────────────┘
```

规则：

1. 依赖方向单向：`dom → view → model`；model 与 view 不得 import DOM 类型。
2. 导入包本身不得访问 `document` / `window`（VitePress 构建会在 Node 中 SSR），只有 `createTable` 被调用时才触碰 DOM。
3. 每个模块导出纯函数加小类；不要写一个包办一切的 Engine。
4. 每实例独立的 EventBus、store、编辑器、菜单、选择、历史与请求状态。
5. 所有异步「旧结果不得污染新状态」的场景（命令、加载、候选、拦截、校验）共用同一个会话代次（epoch）工具。

## 5. 数据模型

### 5.1 四类数据分别管理

| 数据 | 内容 | 入口 | 是否属于真实记录提交 |
| --- | --- | --- | --- |
| `dataSource` | 真实业务记录及写回的计算字段 | `setDataSource` / `updateFields` / `getDataSource` | 是 |
| `derivedValues` | 不属于单条明细的人工输入，如项目打包价 | `setDerivedValues` / `getDerivedValues` | 单独提交 |
| 派生展示行 | 小计、优惠等规则生成的投影 | `derivedRows` / `getDerivedRows` | 否 |
| `summary` | 整表统计原始值 | `getSummary` | 按业务单独提交 |

不得把自动小计或优惠行塞进 `dataSource`，否则计算、增删、复制、提交都会混淆身份。`rowRules` 只为真实数据里已有的特殊记录选布局，不生成新记录。

### 5.2 身份与坐标

- 真实记录身份来自 `rowKey`（字段名或取值函数）；省略时实例生成。数组下标不是持久身份。
- 四种坐标必须由 `coordinateMap` 统一换算：**源下标**（只含真实记录）、**视图行**（含可见派生行，不含虚拟化窗口）、**逻辑列**（field）、**可见列**（排除隐藏列）。DOM 窗口行不对外暴露。
- 公共目标：`{ kind: 'record', rowKey, field }` 与 `{ kind: 'derived', ruleKey, groupKey, field }`。
- 分组描述：`id / scope / values / parentId / depth / occurrence`。`values` 含完整祖先路径；非连续同路径分组用从 0 开始的 `occurrence` 区分。
- `GroupRule.idField` 中 `0`、`null`、空字符串视为未设置（仅分组 ID 的兼容规则，不适用于 `rowKey` 与金额输入）。

### 5.3 所有权与快照

实例复制持有输入记录，不修改宿主对象；所有读取与通知返回冻结快照，未变化的记录与整体快照复用（结构共享），普通编辑不复制全表。`setDataSource` 是外部同步（不通知），`replaceDataSource` 是主动业务替换（通知并清历史）；`setDerivedValues([])` 是完整清空而不是忽略。`getDerivedValues()` 只输出偏离默认值的人工输入，不输出计算字段。

## 6. 配置契约

### 6.1 顶层配置

```ts
type Scalar = string | number | boolean | null | undefined;
type Row = Record<string, unknown>;

interface TableConfig<TRow = Row> {
  columns: ColumnDef<TRow>[];
  readonly?: boolean;                          // 整表写权限；选择、复制、导航仍可用
  rowNumbers?: boolean;                        // 默认 false
  striped?: boolean;                           // 默认 false
  rowPinning?: boolean | { maxRows?: number }; // 固定对比行；true 等于 maxRows 1
  virtualization?: boolean | { threshold?: number; overscan?: number };
  rowRules?: RowRule[];                        // 为真实特殊记录选择布局
  groups?: GroupRule[];                        // 从父到子
  merges?: { vertical?: VerticalMerge[]; horizontal?: HorizontalMerge[] };
  manualMerge?: { rules: ManualMergeRule[] };
  fieldTransitions?: FieldTransition<TRow>[];
  operations?: { actions: OperationAction<TRow>[] };
  calculations?: CalculationRule<TRow>[];
  derivedRows?: DerivedRowRule<TRow>[];
  validateDerivedValues?: (values: readonly DerivedValue[], ctx: unknown) => string | null;
  summary?: SummaryConfig<TRow>;
  context?: unknown;                           // 各阶段共享的业务参数
  locale?: Partial<Locale>;
  editorOptions?: Partial<Record<EditorName, Record<string, unknown>>>;
}
```

### 6.2 列

```ts
interface ColumnDef<TRow = Row> {
  field: string; key?: string; title: string;
  width?: number; minWidth?: number; maxWidth?: number;
  resizable?: boolean; fixed?: 'left' | 'right'; hidden?: boolean;
  align?: 'left' | 'center' | 'right';

  editable?: boolean | ((row: Readonly<TRow>, rows: readonly TRow[]) => boolean);
  editor?: EditorName | ((row: Readonly<TRow>, field: string) => EditorName);
  options?: Option[] | ((row: Readonly<TRow>) => Option[] | Promise<Option[]>);
  editorProps?: Record<string, unknown>;
  valueType?: 'string' | 'number' | 'boolean' | 'date';

  rules?: Rule[] | ((value: unknown, row: Readonly<TRow>) => Rule[]);
  deduplication?: DedupConfig;
  updateValueBefore?: (v: unknown, row: Readonly<TRow>, table: TableInstance) => boolean | void | Promise<boolean | void>;

  render?: (value: unknown, row: Readonly<TRow>, rows: readonly TRow[], container: HTMLElement) => void | (() => void);
  formatter?: (value: unknown, ctx: { currency: string }) => string | number;
  format?: 'amount';
  emptyValue?: string;
  overflowTooltip?: boolean;
  cellStyle?: CellStyle | ((ctx: CellStyleContext<TRow>) => CellStyle | undefined);
  cellClassName?: string | ((ctx: CellStyleContext<TRow>) => string | undefined);

  selectable?: boolean; navigable?: boolean; copyable?: boolean; pasteable?: boolean;
  clearable?: boolean; menuable?: boolean; validatable?: boolean;
}
```

- `EditorName` 为 `text | number | date | select | cascader`；`options` 项可为原始值或 `{ label, value, disabled, children }`。候选与编辑器属性每次打开重新解析，列属性覆盖 `editorOptions` 同名项。
- `updateValueBefore` 返回 `false`、抛错或 Promise 拒绝即拒绝写入。
- **展示优先级**：`render` → `formatter` → `format: 'amount'` → 原值。空值优先用 `emptyValue` 且不调用 formatter；数字 0 与 `false` 不是空值。`formatter` 同步返回文本或数字，禁止返回 DOM、框架节点、Promise；每个单元格只缓存最近一次结果（键含值、函数身份、format、emptyValue、币种）。
- 复制与提交使用原始值，不把展示文本写回数据。
- 去重可按整表或分组作用域，支持排除当前组、参与条件、提示文案，检查对象是数据而不是可见 DOM。

### 6.3 归一化与错误

配置先归一化与验证，再整体应用。必须拒绝：未知或失效引用、重复标识、循环依赖、交叉布局、违规输出、不支持的参数。错误类型 `TableConfigError` 带 `path / code / message`。更新配置失败时保留原有效状态；适配层通过 `onConfigError` 报告，并保留上一份有效配置。

### 6.4 行布局与行能力

- `RowRule.match: { field, equals }` 匹配已有真实记录并覆盖布局。`CellLayout` 用 `column` 或 `range` 二选一定位；范围按列 key，含 `from`、不含 `until`，省略 `until` 到末列；未覆盖部分补空白占位。
- 布局格可绑定 `field`，或用 `content.parts` 拼接静态文本与字段；复杂展示用 `render`；`content` 与 `render` 互斥；不执行字符串表达式。
- `behaviors` 含 `selectable / navigable / copyable / editable / clearable / pasteable / menuable / validatable / columnSelectable / pasteTarget / expandSelection / mergeable`。派生行默认不消耗普通行的跨行粘贴输入、不进入整列选择与业务菜单；行为覆盖不能让未声明的计算字段变为可写。

## 7. 计算与投影流水线

### 7.1 流水线

```text
输入变化（编辑 / 粘贴 / 增删行 / 配置更新）
  → 字段联动 fieldTransitions    先于计算；同一事务
  → 真实字段计算 calculations     按依赖拓扑、按作用域；写回计算字段
  → 分组 grouping                连续同值；生成分组节点
  → 派生行 derivedRows            小计 / 优惠；只读投影
  → 汇总 summary
  → 视图模型 flatten              （§8）
  → 刷新分级 → DOM                （§9）
```

全流程是同步、确定性的：相同输入必须得到相同输出，不读时钟、随机数、网络。任一环节失败，整个事务回滚，不留下半成品。

### 7.2 真实字段计算 calculations

```ts
interface CalculationRule<TRow = Row> {
  id: string;
  scope: 'row' | { group: string };        // 行内计算，或某个分组规则 id 下的组内计算
  reads: string[];                         // 读取的字段
  writes: string[];                        // 写回的字段（必须是计算字段）
  compute(ctx: CalcContext<TRow>): Record<string, Scalar> | null;
}
```

- `compute` 是同步纯函数，读取冻结快照，禁止修改入参、返回 Promise。
- 依赖由 `reads / writes` 声明推导拓扑；循环依赖、多条规则写同一字段都是配置错误。
- 只允许写回声明的 `writes`；计算字段强制不可编辑，不得被粘贴、清空覆盖。
- 规则抛错或返回非法值 → 事务整体回滚，错误带 `ruleId`、`rowKey`、`code`。
- 增量：事务记录 `changedFields` 与 `changedRowKeys`，只重算受影响作用域；行级变化沿祖先链更新所在分组。第一版显式声明 `reads / writes`，不做运行时依赖自动收集。

### 7.3 字段联动 fieldTransitions

```ts
interface FieldTransition<TRow = Row> {
  id: string;
  trigger: { field: string };
  apply(ctx: { row: Readonly<TRow>; oldValue: unknown; newValue: unknown }): Partial<TRow> | null;
}
```

- 只在用户编辑、粘贴、清空时触发，`setDataSource` 不触发。
- 联动结果与原始变更合并进同一事务和同一条历史；允许级联，但必须有最大深度并检测循环。
- 联动在校验与计算之前执行，计算看到的永远是联动后的值（例如发票类型变化 → 税率变化 → 含税 / 不含税金额重算）。

### 7.4 派生行 derivedRows

```ts
interface DerivedRowRule<TRow = Row> {
  id: string;
  level: string | 'table';                 // 挂在哪个分组规则下；'table' 为整表末尾
  position?: 'after-group' | 'before-group';
  labelColumn: string;                     // 标签文字所在列
  label: string | ((ctx: GroupContext<TRow>) => string);  // 如 {name}总计
  cells: Record<string, DerivedCell<TRow>>;
  visible?: (ctx: GroupContext<TRow>) => boolean;
}
type DerivedCell<TRow> =
  | { type: 'aggregate'; of?: string; agg: 'sum' | 'count' | 'min' | 'max' | 'avg' | ((rows: readonly TRow[], ctx) => Scalar) }
  | { type: 'input'; field: string; default?: Scalar; editor?: EditorName; rules?: Rule[] }
  | { type: 'compute'; fn: (ctx: DerivedContext<TRow>) => Scalar }
  | { type: 'text'; text: string };
```

- 聚合范围是该分组的全部真实记录（含子孙分组）；派生行自己不参与聚合。后声明的派生行可读先声明的结果，禁止循环。
- `input` 类型的值是独立输入（优惠金额、项目打包价），保存在 `derivedValues`，以 `(ruleKey, groupKey, field)` 为键；`getDerivedValues()` 只输出偏离默认值的项。
- 分组被删除或路径变化时，对应输入按稳定 `groupKey` 匹配；找不到则丢弃，并在 `derivedValuesChange` 里报告 `dropped`。
- 差量聚合：`sum / count` 用「新值 − 旧值」沿祖先链加差，复杂度 O(层数)；`min / max / avg / 自定义函数` 在受影响分组内重算。需要高精度金额时，在自定义聚合函数里使用任意精度库。
- 派生行只读：不可被选区写入、清空、粘贴、整列选择消费，不进入真实记录提交。

### 7.5 汇总 summary

`SummaryConfig.items` 为 `{ key, label, compute(ctx) }` 列表，产出整表原始值（数字 / 字符串），不做格式化；`getSummary()` 返回冻结快照；值变化触发 `summaryChange`。汇总是否展示、如何展示由宿主决定。

### 7.6 提交前派生值校验

`validateDerivedValues(values, ctx)` 在提交校验时调用，返回字符串即视为失败并作为全局错误报告；它与行内规则校验互相独立。

## 8. 视图模型、分组与合并

### 8.1 VisualRow

数据是树，视图是扁平行。DOM 不直接读取树，只读取 `VisualRow[]`：

```ts
type VisualRow =
  | { kind: 'record'; viewIndex: number; sourceIndex: number; rowKey: string;
      groupPath: string[]; layout?: RowLayout }
  | { kind: 'derived'; viewIndex: number; ruleKey: string; groupKey: string;
      depth: number; cells: DerivedCellView[] };
```

### 8.2 flatten 步骤

1. 按原顺序遍历真实记录，依据 `groups` 生成连续分组：只有**相邻**且路径值全部相同才算同组，不排序，不合并不连续的同值。
2. 在每个分组结束位置，按 `derivedRows` 规则插入派生行；层级由深到浅，先内层小计后外层小计。
3. 生成 `VisualRow[]`、行度量 `rowMetrics`（高度与前缀和）。
4. 计算合并跨度 `spans`（§8.3）。
5. 建立 `coordinateMap`：`sourceIndex ↔ viewIndex`、`rowKey → viewIndex`。

增量更新：变化只影响某分组时，局部重建该分组的行段与祖先链上的小计内容；结构不变只刷新内容；结构变化才重建受影响范围的 spans 与前缀和。

### 8.3 合并规则

| 对象 | 规则 |
| --- | --- |
| 自动纵向合并 `VerticalMerge: { column, by: groupRuleId }` | 分组列在其分组范围内合并成一块；分组值属于分组节点，不属于每一行 |
| 第 k 层分组块的覆盖范围 | 覆盖块内全部**真实记录行**，以及属于**更深层**分组的派生行；**不含**属于第 k 层及更浅层的派生行 |
| 第 k 层派生行（小计）的横向占位 | 第 1 到 k−1 层分组列继续被各自的合并块穿过；从第 k 层分组列起横向合并为标签区，直到 `labelColumn` 之前；`labelColumn` 显示标签；其后各列按 `cells` 显示聚合 / 输入 / 空白 |
| 横向合并 `HorizontalMerge` | 仅用于 `rowRules` 布局与派生行占位，用原生 colspan |
| 非分组列 | 不做自动合并，只合并声明过的列 |

对照截图：「会务」（第 1 层）穿过「场地总计」「设备总计」等第 2 层派生行；「设备」（第 2 层）只覆盖 4 条数据行，不含「设备总计」；「设备总计」从项目列起横向接管，标签落在需求列。

### 8.4 coordinateMap

```ts
interface CoordinateMap {
  viewIndexOfRow(rowKey: string): number;           // 不存在返回 -1
  sourceIndexOfView(viewIndex: number): number;     // 派生行返回 -1
  rowTop(viewIndex: number): number;                // 来自 rowMetrics
  rowAtOffset(y: number): number;                   // 二分查找
  colLeft(visibleCol: number): number;
  colAtOffset(x: number): number;
  anchorOf(viewIndex: number, visibleCol: number): CellRef;   // 合并块 → 主格
  spanOf(cell: CellRef): { rowSpan: number; colSpan: number };
}
```

必须单测：所有坐标往返换算一致；合并块内任意一点都解析到同一个主格；隐藏列不进入可见列坐标。

### 8.5 分组列的编辑语义

合并块的值 = 组内所有真实记录该字段的值。编辑主格 = 对块内全部真实记录写同一个值，同一事务、同一条历史。仅含派生行的合并块不可编辑。写入后分组由 flatten 重新得出，活动格位置保持。

### 8.6 手动合并（建议实现）

- 仅允许同一列的纵向连续范围，范围规则由 `manualMerge.rules` 限定列与行类型。
- 流程：选区 → 预览（高亮将合并的范围，提示被覆盖格中非空值的数量）→ 确认 → 事务 `mergeCells`。主格为范围首行。
- 手动合并是视图状态，不改写数据，被覆盖格的值保留但不展示、不参与复制与校验；随历史撤销重做。
- 行增删或分组变化使范围失效时，自动拆分并报告 `mergeInvalidated`。

## 9. 两表布局与渲染

### 9.1 DOM 结构

```text
div.edit-table[data-theme][data-density]
├─ div.et-toolbar                      可选：撤销 / 重做 / 密度
├─ div.et-head-viewport                overflow:hidden；高度 = 表头 + 固定对比区
│   └─ table.et-head-table             【表 1：头表】
│       ├─ colgroup
│       ├─ thead                       列标题
│       └─ tbody.et-pinned             固定对比行（只读，可为空；见 §10）
├─ div.et-body-viewport                overflow:auto；唯一滚动源
│   └─ div.et-body-canvas              position:relative；宽 = 总列宽；高 = 总行高
│       ├─ table.et-body-table         【表 2：主体表】窗口内的行 + 上下 spacer 行
│       │   ├─ colgroup
│       │   └─ tbody
│       ├─ div.et-merge-layer          纵向合并格（§11）
│       └─ div.et-select-layer         选区、活动格、整行整列高亮
└─ div.et-popup-layer                  编辑器、菜单、tooltip；实例内挂载
```

### 9.2 列布局：唯一来源

- `ColumnLayout` 是整数 px 数组，两个 `colgroup`、canvas 宽度、合并层、选区层全部由它生成。
- 两表统一 `table-layout: fixed`、显式 `width`、`border-collapse: separate`、`border-spacing: 0`。
- 边框采用单侧画法（只画每格的 right / bottom），避免折叠边框带来的 1px 错位和固定格边框消失。
- 禁止依赖内容自动撑宽列；自动适应列宽放入路线图。隐藏列不进入 `colgroup`。

### 9.3 横向同步

主体容器 `et-body-viewport` 的 `scroll` 事件是横向位置的唯一输入：

```ts
function onBodyScroll() {
  const x = body.scrollLeft;
  headTable.style.transform = `translate3d(${-x}px, 0, 0)`;
  root.style.setProperty('--edit-table-fix-left', `${x}px`);
  root.style.setProperty('--edit-table-fix-right', `${x + body.clientWidth - canvasWidth}px`);
  mergeLayer.updateVisibleContent(body.scrollTop);   // §11
}
body.addEventListener('scroll', onBodyScroll, { passive: true });
```

- 必须在 `scroll` 事件内同步写入，不用 rAF 延后，否则头体会错开一帧。
- 头表宽度与 canvas 宽度必须相等。

### 9.4 垂直滚动条补偿

头区右侧补一块占位，宽度 = `body.offsetWidth - body.clientWidth`；用 `ResizeObserver` 监听 body 视口与内容变化（滚动条出现 / 消失、列宽变化）并重算。

### 9.5 固定列（不使用 sticky）

固定列单元格（头表、主体表、固定对比行）带 `data-fixed='left|right'`，由 CSS 变量驱动 transform 补偿：

```css
.edit-table [data-fixed='left']  { transform: translate3d(var(--edit-table-fix-left, 0px), 0, 0); }
.edit-table [data-fixed='right'] { transform: translate3d(var(--edit-table-fix-right, 0px), 0, 0); }
```

- 左固定补偿 = `scrollLeft`；右固定补偿 = `scrollLeft + clientWidth − canvasWidth`。头表整体已经 `−scrollLeft`，固定格的补偿让净位移为 0，视觉不动。
- 固定格必须有不透明背景与高于普通格的 `z-index`；固定边界阴影仅在发生横向滚动时显示。
- 只在根节点写 CSS 变量，不逐格写样式。
- 选区层、合并层、编辑器浮层按列段拆成 `left / center / right` 三段：固定段跟随补偿，中间段用 `overflow:hidden` 容器裁剪，避免盖住固定列。

### 9.6 表头与列宽拖拽

- 表头只在头表中渲染，不进入虚拟化。
- 拖拽手柄在头表单元格右缘；拖拽中仅显示参考线，释放时一次性更新 `ColumnLayout`，在同一帧内更新两个 colgroup、canvas 宽度与各叠加层。
- 行号列默认固定在左。

### 9.7 行高与密度

- 默认固定行高，由密度变量决定（建议 `normal = 36px`、`compact = 28px`，可用 CSS 变量覆盖）。普通格默认单行省略。
- 启用虚拟化时，行高来源是固定值或测量缓存；滚动过程中禁止对全表同步调用 `getBoundingClientRect`。
- `rowHeight: 'auto'`（自动换行）作为 M7 增强：渲染后测量并写回 `rowMetrics`，未测量行使用估算高度。

### 9.8 刷新分级

| 级别 | 触发 | 动作 |
| --- | --- | --- |
| full | 初始化、配置更新、结构变化 | 重建视图模型与窗口 DOM |
| rows | 增删行、分组变化 | 局部重建受影响行段与 spans |
| cells | 值变化、校验状态变化 | 只写变化单元格 |
| layout | 列宽、密度、容器尺寸 | 只更新 colgroup、canvas、叠加层 |

写 DOM 前比对缓存（文本、class、style），相同则不写；纯文本使用 `textContent`，复杂内容经 `render` 容器。

### 9.9 已知风险清单（M0 必须逐项验证）

1. 触控板惯性滚动下，`scroll` 事件与合成器滚动异步，固定列可能出现一帧滞后。
2. 浏览器缩放 80%–200%、DPR 1 / 1.25 / 1.5 / 2 下，头体边框和固定列是否出现亚像素错位。
3. `scrollLeft` 为小数时 transform 补偿的取整策略。
4. 垂直滚动条出现 / 消失时头区的宽度补偿。
5. Safari、Firefox 下 `table-layout: fixed` 与 `colgroup` 宽度的一致性。
6. 编辑中的浮层、tooltip 与滚动的相互影响。

### 9.10 回退方案

若 M0 证明 transform 补偿在目标浏览器出现可见抖动，依次尝试：① 接管横向 `wheel`，`preventDefault` 后手动设置 `scrollLeft`，让头体与固定列在同一事件内更新；② 改为左 / 中 / 右三窗格，每窗格各自一对头表 + 主体表，垂直滚动同步。采用②时表数量变为 2×3，本章必须同步改写后再继续。

## 10. 固定对比行

### 10.1 目的与形态

用户把任意一行（真实记录或派生行）固定在表头正下方，滚动主体时它始终可见，用来与其他行逐列比较。它位于**头表**的 `tbody.et-pinned` 中，与表头同属固定区，因此自动复用主体的列宽、列显隐、横向滚动与固定列（这是选择两表布局的主要收益）。

### 10.2 配置与 API

```ts
type RowTarget =
  | { kind: 'record'; rowKey: string }
  | { kind: 'derived'; ruleKey: string; groupKey: string };

interface PinnedRowInfo {
  target: RowTarget;
  viewIndex: number;                 // 在主体中的位置；不存在时为 -1
  texts: Record<string, string>;     // 各列展示文本
}

// 配置：rowPinning: true | { maxRows?: number }，true 等价于 maxRows = 1
// 实例方法
pinRow(target: RowTarget | number): boolean;     // number 为视图行下标
unpinRow(target: RowTarget): boolean;
clearPinnedRows(): void;
getPinnedRows(): PinnedRowInfo[];
scrollToRow(target: RowTarget, opts?: { select?: boolean }): void;
```

事件：`pinnedRowsChange`，负载为 `{ rows: PinnedRowInfo[] }`。

### 10.3 行为规则

- **容量**：`maxRows` 默认 1；超出时按先进先出替换最早的一行；重复固定同一行是无操作。
- **渲染**：固定行属于头表，使用与主体同源的 `colgroup`；列宽拖拽、隐藏列、左右固定列、横向滚动全部自动生效。
- **内容来源**：取自视图模型的展示文本（与 §6.2 展示优先级一致），不抓取 DOM，不创建业务单元格，不复制按钮、输入框等交互节点。列可选配置 `pinnedText(value, row)` 覆盖自定义 `render` 列的展示。分组列显示该记录所属的分组值；派生行显示标签与聚合文本。
- **单行省略**：固定行强制单行省略，行高等于当前密度行高，悬停显示全文 tooltip；固定区总高度 = 表头高度 + n × 行高，可预期，不参与 `rowMetrics`。
- **只读**：不进入选区、编辑、键盘导航、剪贴板与历史；左侧显示图钉标识、取消按钮（×）与「定位到原行」按钮，后者调用 `scrollToRow(target, { select: true })`。
- **同步**：源行因编辑、撤销、计算或同 `rowKey` 的 `setDataSource` 变化时，刷新对应固定行；源行被删除、`rowKey` 不存在或派生行所属分组消失时自动取消固定，并且不会因撤销而恢复。
- **入口**：行右键菜单「固定为对比行 / 取消固定」、固定区的 ×、实例方法与命令。
- **虚拟化**：固定行内容来自视图模型，原行不在 DOM 窗口内也能展示。
- **视觉**：固定区底部有分隔线与轻阴影，背景与数据行区分；固定行数量变化会改变头区高度，需触发 `layout` 级刷新。
- **差异高亮（M7 增强）**：配置 `pinnedDiff: true` 后，活动行中与固定行同列文本不同的单元格添加 `et-diff` 标记，仅视觉，不改数据。

## 11. 虚拟滚动与合并叠加层

### 11.1 行度量

`rowMetrics` 保存每行高度与前缀和（建议 `Float64Array`），`rowAtOffset(y)` 用二分，`rowTop(i)` 为 O(1)。增删行时局部更新前缀和（块级前缀和或 Fenwick 树均可），不得每次全量重算。

### 11.2 窗口与节点池

- 行数 ≥ `threshold`（默认 200）才启用虚拟化；小表全量渲染，路径相同、只是窗口覆盖全部行。
- 可见范围 = 视口行区间 ± `overscan`（默认 8 行）。主体表由「上 spacer 行 + 窗口内行 + 下 spacer 行」组成，spacer 行高度来自前缀和。
- 窗口内的 `tr / td` 用节点池复用，滚动时只改动进出窗口的行。
- 正在编辑的行保持存活，不被回收；选区与活动格由 `select-layer` 按坐标绘制，不依赖 DOM 行是否存在。

### 11.3 规模上限

浏览器对单个元素高度有上限（约 1790 万至 3350 万 px，随浏览器而异）。行高 36px 时约为数十万行量级。超过估算上限时必须抛出配置警告，不得静默错位；缩放滚动条或分页加载放入路线图。

### 11.4 合并叠加层

- 主体表中，纵向合并列对应的格渲染为**占位格**（无内容，边框与背景一致），表结构保持规整。
- 每个与视口相交的合并块在 `et-merge-layer` 中生成一个绝对定位元素：`top = rowTop(start)`，`height = 块内各行高度之和`，`left / width` 来自 `ColumnLayout`。
- 块内容必须停留在「块 ∩ 视口」的可见部分并垂直居中，由 JS 在 scroll 事件中计算（不使用 sticky）：

```ts
const visTop = Math.max(blockTop, scrollTop);
const visBottom = Math.min(blockBottom, scrollTop + viewportHeight);
content.style.transform = `translate3d(0, ${visTop - blockTop}px, 0)`;
content.style.height = `${visBottom - visTop}px`;
```

- 与视口相交的块通过 `spans` 的有序索引（按起始视图行）二分查找，不遍历全部块。
- 位于左右固定列中的合并块放入对应的固定段层（§9.5）。
- **命中测试**：叠加层与占位格上的指针事件统一由根容器接管，用坐标换算 `rowAtOffset / colAtOffset / anchorOf` 得到逻辑单元格，不读取 `event.target`。
- 编辑合并格时，编辑器浮层定位到该块「块 ∩ 视口」的可见区域。
- 叠加元素提供 `role='gridcell'` 与 `aria-rowspan`。

### 11.5 性能目标（需实测并记录）

10 万行 × 12 列：首屏（含 flatten）< 1s；滚动期间每帧脚本耗时 < 8ms；单格编辑后「联动 + 计算 + 刷新」< 16ms。目标值以 M0 与 M8 的实测数据为准，写入文档站的性能页，保留原始采样。

## 12. 编辑、选择与剪贴板

### 12.1 编辑状态机

`idle → editing → committing → idle`。

- **进入**：双击、Enter、F2、直接键入（以键入字符作为初值）、IME 组合输入（组合期间不吞输入、不提前提交）。
- **退出**：Enter 提交并下移；Tab 提交并右移；Esc 取消；失焦提交（下拉搜索框等内部焦点不算失焦）；编辑行被删除时取消。
- **提交管线**：值规范化（数字清洗与 NaN 拒绝、日期格式化）→ `updateValueBefore`（可异步，带会话代次）→ 事务（联动 → 计算）→ 单格校验（可异步）→ 刷新。被拒绝时回到编辑态并提示原因。
- 所有异步环节使用同一会话代次：过期结果丢弃，不得写入数据、状态或 DOM。

### 12.2 内置编辑器

| 编辑器 | 要点 |
| --- | --- |
| text | 单行输入；`maxLength`、占位符 |
| number | 步进器、`min / max / step / precision`；非法输入不提交 |
| date | 自行实现日历浮层；格式可配；键盘可操作；日期选择后沿用提交管线 |
| select | 单选与多选；**可搜索**；静态或异步候选；加载态、空态、失败重试；选中勾选态；`disabled` 项 |
| cascader | 层级候选，叶子选中即提交 |

浮层挂载到 popup 层，定位在可见区域内，空间不足时翻转；表格滚动或窗口缩放时重新定位，目标单元格离开可视区时按提交规则关闭。

### 12.3 选择模型

- 选区以**逻辑坐标**（视图行 × 可见列）保存：`{ anchor, focus, ranges[] }`，支持多区域（Ctrl / Cmd）。
- **合并递归扩展**：点击合并格选中整块；范围触及合并块则扩展到包含整块，并迭代直到稳定。
- 整行（点击行号）、整列（点击表头）、全选；整列选择跳过派生行与固定对比行。
- 拖选到边缘时自动滚动（定时器），与虚拟化窗口配合；选区由 `select-layer` 绘制。
- 派生行默认可选可复制，但只读。

### 12.4 键盘

| 按键 | 行为 |
| --- | --- |
| 方向键 | 移动活动格；跳过 `navigable: false` 的列；固定对比行不参与 |
| Shift + 方向键 | 扩展选区 |
| Ctrl / Cmd + 方向键 | 跳到当前区块边缘 |
| Home / End、PageUp / PageDown | 行首行尾；按视口高度翻页 |
| Enter、F2 | 进入编辑；编辑中 Enter 提交并下移 |
| Tab / Shift + Tab | 提交并移动；末格行为可配 |
| Esc | 取消编辑；无编辑时清除多选 |
| Delete / Backspace | 清空选区内可清空且可写的格 |
| Ctrl / Cmd + A | 全选 |
| Ctrl / Cmd + C / X / V | 复制、剪切、粘贴 |
| Ctrl / Cmd + Z、Y、Shift + Z | 撤销、重做 |

### 12.5 剪贴板

- **复制**：同时写入 TSV 文本与 `text/html` 表格，使用原始值而非展示文本。合并块复制时每行重复分组值。优先 `navigator.clipboard`，失败回退 `copy` 事件的 `setData`。
- **粘贴**：读取 `paste` 事件的 `clipboardData`，识别 TSV、HTML table、单值、多行文本。单值填充整个选区；多值从活动格起铺开，不自动新增行，超出范围的部分计入 `truncated`。
- 逐格检查：只读、派生行、计算字段、`pasteable: false`、类型规范化失败的格被跳过或失败，其余继续写入；整个粘贴是一个事务、一条历史。联动或计算抛错则整体回滚（§7）。
- 返回 `PasteReport { applied, skipped: [{ target, reason }], failed, truncated }`，用于提示。
- 粘贴到分组合并块时，目标为主格，多行粘贴按行写入真实记录，语义与 §8.5 一致。

## 13. 校验、事务、命令与事件

### 13.1 校验

- 基于 async-validator；规则来自 `columns[].rules`（静态或随行动态生成）与 `deduplication`。
- 时机：编辑提交时校验该格；粘贴与批量操作后校验受影响格；`validate()` 校验全表。`validatable: false` 的列跳过。
- 错误状态以 `rowKey + field` 为键保存，单元格显示错误样式，悬停或聚焦显示错误浮层；校验中显示 pending 状态。
- 并发校验使用会话代次，过期结果丢弃。派生输入同样参与校验，`validateDerivedValues` 提供整体校验（§7.6）。
- `validate()` 返回 `{ valid, errors, firstError }`；`firstError` 用于 `scrollToRow` 并聚焦首个错误格。
- 提交采集：`getSubmission()` 返回 `{ records, derivedValues, summary }` 的冻结快照，不含展示文本与派生行。

### 13.2 事务与历史

- 事务 = 一次用户意图产生的全部原子变更（用户写入 + 联动 + 计算写回），携带 `source` 与可逆变更集。
- 应用方式：基于当前快照构造新快照，全部成功才替换；任何一步失败都不留下半成品。
- 历史栈只记录数据、独立输入与手动合并的变更，不含选区、滚动位置与固定对比行；默认容量 100；新事务清空重做栈。
- 任何整体数据替换（`setDataSource`、`replaceDataSource`）都清空历史，避免对不存在的行撤销。
- 撤销 / 重做应用逆变更，其中包含当初计算写回的字段，派生行随后重新投影。

### 13.3 命令

`executeCommand(name, payload?)` 返回 `Promise<CommandResult>`；`getCommandState(name)` 返回 `{ enabled, reason? }`。

| 命令 | 说明 |
| --- | --- |
| `undo` / `redo` | 历史 |
| `insertRowAbove` / `insertRowBelow` | 继承相邻记录的分组路径，插入后进入重算 |
| `deleteRows` | 删除选中的真实记录；分组变空时一并消失 |
| `duplicateRows` | 批量复制当前行（新 `rowKey`） |
| `lockRows` / `unlockRows` | 锁定行：整行只读、不可删除 |
| `mergeCells` / `unmergeCells` | 手动合并 |
| `pinRow` / `unpinRow` / `clearPinnedRows` | 固定对比行 |
| `selectAll` / `clearSelection` | 选择 |
| `copy` / `cut` / `paste` | 剪贴板 |
| `validate` | 全表校验 |

- 写命令按实例串行排队；`CommandResult = { ok, code?, message?, data? }`。
- 失败码至少包含：`readonly`、`invalid-target`、`rejected`、`validation`、`calc-error`、`stale`、`destroyed`。
- 实例销毁后的调用返回 `destroyed`，不抛错、不改状态。

### 13.4 事件

`on(event, handler)` 返回取消订阅函数；事件对象不可变（冻结）；同步派发，且发生在事务提交之后；处理函数抛错被捕获并转给 `onError`，不影响库。

| 事件 | 负载要点 |
| --- | --- |
| `dataChange` | `{ source, changes: [{ target, oldValue, newValue }], dataSource, revision }` |
| `derivedValuesChange` | `{ values, dropped }` |
| `summaryChange` | `{ summary }` |
| `selectionChange` | `{ ranges, active }` |
| `editStart` / `editEnd` | `{ target, committed }` |
| `validationChange` | `{ errors }` |
| `historyChange` | `{ canUndo, canRedo }` |
| `pinnedRowsChange` | `{ rows }` |
| `loadStateChange` | `{ state, error? }` |
| `columnResize` | `{ field, width }` |
| `configError` | `TableConfigError` |
| `commandExecuted` | `{ name, result }` |

## 14. 加载、行操作、列状态、外观与新增能力

### 14.1 数据加载状态

`DataState.status` 取值：`loading`、`refreshing`、`ready`、`empty`、`filtered-empty`、`error`、`refresh-error`；同时包含 `loading`、`hasData`、`error`、`requestId`。

两种接入方式：

1. **表格管理请求**：配置 `dataLoader({ signal, requestId })`，返回记录数组或 `{ rows, emptyReason? }`；配置后自动首次加载，之后用 `loadData()` / `retryLoad()`。
2. **宿主管理请求**：通过 `loading`、`loadError`、`emptyReason`、`onRetry` 同步状态，宿主自行保证请求竞态。

行为规则：

- 首次加载展示明确的加载态；刷新保留旧内容；刷新失败保留旧数据并提供重试；`emptyReason: 'filtered'` 只表示宿主筛选无结果，不开启内置过滤。`loading` 优先于空态和错误显示。
- `loadData()` 先保存当前编辑，失败返回 `false` 并保留错误状态。
- 新请求中止旧请求；即使服务端忽略 `AbortSignal`，也只有最新有效响应可以被应用（会话代次）。开始编辑、本地写入、外部换数或销毁都会使在途请求失效。加载流程不得排在可能永久等待的旧编辑命令之后。
- 加载成功等价于 `setDataSource`（不触发 `dataChange`，清空历史），并触发 `loadStateChange`，负载为 `DataState`。

### 14.2 行操作与右键菜单

`operations.actions` 支持 `add` / `remove` 简写，或完整对象：

```ts
interface OperationAction<TRow = Row> {
  key: string; label: string;
  kind?: 'add' | 'remove' | 'duplicate' | 'lock' | 'pin' | 'custom';
  icon?: string; danger?: boolean;
  scope?: 'row' | 'table' | string;          // 默认 row；也可为分组规则 key
  fields?: string[];
  position?: 'before' | 'after' | 'end';
  minRemaining?: number;                     // 删除后真实记录总数下限
  message?: string;
  rowDefaults?: Partial<TRow>;               // 新增行默认值
  inheritFields?: string[];                  // 从当前记录继承（如分组字段）
  visible?: (ctx: OperationContext<TRow>) => boolean;   // 决定菜单是否出现
  enabled?: (ctx: OperationContext<TRow>) => boolean;   // 决定能否执行；运行时必须再次检查
  create?: (ctx: OperationContext<TRow>) => TRow[] | false | Promise<TRow[] | false>;
  execute?: (ctx: OperationContext<TRow>) => void | Promise<void>;  // 替代内置流程
}
```

- `OperationContext.rows` 只含该作用域内的真实记录；`start / end` 是**源数据**闭区间，不是展示坐标。
- 默认菜单项（对应截图）：在上方插入一行、在下方插入一行、删除当前行、批量复制当前行、锁定当前行、固定为对比行。截图中的「锁定 / 冻结当前行」拆成两项：**锁定**（只读，§14.5）与**固定为对比行**（§10）。
- 菜单挂在 popup 层；派生行默认没有业务菜单；只读表禁用写入项；菜单项是否可用先看 `enabled`，执行时再检查一次。

### 14.3 列状态与几何

- 列宽拖拽按帧更新，遵循 `minWidth / maxWidth / resizable`，不触发整列选择，不重建数据与选区。
- 列显隐按 `field` 操作：`setHiddenColumns`、`setColumnVisibility`、`getHiddenColumns`。隐藏不删除配置与字段，计算与校验继续进行；键盘导航与剪贴板跳过隐藏列。
- 显隐变化按原编辑提交流程关闭编辑器并清除选区；单纯显隐不触发数据变更通知；新的 `columns` 配置以其中的 `hidden` 为准，省略则显示。

### 14.4 主题、密度与样式

- `theme`：`light | green | dark`，通过实例根节点 CSS 变量控制，切换保留数据与交互状态。`density`：`normal | compact`，与列预设无关，切换保留草稿和历史，不产生事务，只读表也可用。
- `cellStyle / cellClassName` 为静态值或同步函数，接收 `{ value, row, field, column, rowIndex }`，`row` 为冻结快照；布局格分别替代列的样式 / 类名，不逐属性合并；省略表示继承，`{}` 或空字符串表示清除。
- 允许颜色、字体、字号、行高、文字装饰、对齐、换行、padding 与业务 CSS 变量；尺寸、定位、边框、透明度等越界属性、组件保留类名及 `--edit-table-*` 变量声明会被拒绝。
- 状态优先级由低到高：主题与条纹 < 业务外观 < 禁用输入底色与文字 < 错误文字与入口；选择、活动格、编辑器使用独立交互层。
- 普通格默认单行省略；`normal` 自动换行，`pre-wrap` 保留换行。固定对比行复用计算后的主格样式，不重复执行条件函数。
- 持久化只存静态样式、类名或业务规则 ID；条件函数由应用代码重新绑定，不序列化、不执行函数字符串。

主要 CSS 变量：

| 变量 | 用途 |
| --- | --- |
| `--edit-table-bg` / `-text` / `-border` | 背景、文字、边框 |
| `--edit-table-header-bg` / `-header-text` | 表头 |
| `--edit-table-stripe-bg` / `-hover-bg` / `-selected-bg` | 条纹、悬停、选区 |
| `--edit-table-active-color` | 活动格描边 |
| `--edit-table-error-color` | 校验错误 |
| `--edit-table-derived-bg` | 派生行（小计 / 优惠）底色 |
| `--edit-table-pinned-bg` | 固定对比区底色 |
| `--edit-table-locked-bg` | 锁定行底色 |
| `--edit-table-row-height` / `-font-size` | 行高、字号（密度） |

### 14.5 新增能力（旧规格没有，截图需要）

| 能力 | 规格 |
| --- | --- |
| 批注角标 | `ColumnDef.comment?: (row, ctx) => string \| undefined`；返回非空时在单元格右上角显示红色小三角，悬停 200ms 在 popup 层显示提示；纯展示，不参与复制、校验、提交 |
| 下拉搜索 | `select` 的 `searchable: true`：输入即过滤候选，支持拼音 / 大小写不敏感匹配的自定义 `filterOption`；异步候选时搜索词作为参数 |
| 行锁定 | `lockRows / unlockRows` 命令；锁定行整行只读、不可删除、不接收粘贴与清空；锁定集合不属于真实记录，通过 `getLockedRows() / setLockedRows()` 同步，变化触发 `lockChange` |
| 批量复制行 | `duplicateRows`：在原行之后插入副本，生成新 `rowKey`；计算字段重算，独立输入不复制；一个事务、一条历史 |
| 固定对比行 | §10 |

## 15. 公共 API

### 15.1 入口与选项

```ts
function createTable<TRow = Row>(container: HTMLElement, options: CreateTableOptions<TRow>): TableInstance<TRow>;

interface CreateTableOptions<TRow = Row> {
  config: TableConfig<TRow>;
  rowKey?: string | ((row: TRow) => string);
  dataSource?: TRow[];
  derivedValues?: DerivedValue[];
  // 表格管理请求
  dataLoader?: (ctx: { signal: AbortSignal; requestId: number }) =>
    Promise<TRow[] | { rows: TRow[]; emptyReason?: 'empty' | 'filtered' }>;
  // 宿主管理请求
  loading?: boolean; loadError?: unknown; emptyReason?: 'empty' | 'filtered'; onRetry?: () => void;
  theme?: 'light' | 'green' | 'dark';
  density?: 'normal' | 'compact';
  currency?: string;
  height?: number | string;               // 表体可视高度；不设则随容器
  getPopupContainer?: () => HTMLElement;
  onError?: (error: Error) => void;
}
```

### 15.2 实例方法

```ts
interface TableInstance<TRow = Row> {
  // 数据
  setDataSource(rows: TRow[]): void;                 // 外部同步，不通知，清历史
  replaceDataSource(rows: TRow[]): void;             // 业务替换，通知，清历史
  getDataSource(): readonly TRow[];
  updateFields(patches: { rowKey: string; fields: Partial<TRow> }[]): CommandResult;
  setDerivedValues(values: DerivedValue[]): void;   // 传 [] 表示清空
  getDerivedValues(): readonly DerivedValue[];
  getDerivedRows(): readonly DerivedRowView[];
  getSummary(): Readonly<Record<string, Scalar>>;
  getSubmission(): Submission;                       // { records, derivedValues, summary }

  // 配置与外观
  updateConfig(next: TableConfig<TRow>): boolean;    // 失败返回 false 并触发 configError
  setTheme(theme: Theme): void;
  setDensity(density: Density): void;
  setReadonly(readonly: boolean): void;

  // 列与滚动
  setHiddenColumns(fields: string[]): void;
  setColumnVisibility(field: string, visible: boolean): void;
  getHiddenColumns(): string[];
  setColumnWidth(field: string, width: number): void;
  scrollToRow(target: RowTarget, opts?: { select?: boolean }): void;
  scrollToCell(target: CellTarget): void;

  // 选择与固定对比行
  getSelection(): SelectionSnapshot;
  setSelection(ranges: CellRange[]): void;
  pinRow(target: RowTarget | number): boolean;
  unpinRow(target: RowTarget): boolean;
  clearPinnedRows(): void;
  getPinnedRows(): PinnedRowInfo[];
  getLockedRows(): string[];
  setLockedRows(rowKeys: string[]): void;

  // 校验与加载
  validate(): Promise<ValidationResult>;
  loadData(): Promise<boolean>;
  retryLoad(): Promise<boolean>;
  getDataState(): DataState;

  // 命令与事件
  executeCommand(name: string, payload?: unknown): Promise<CommandResult>;
  getCommandState(name: string): { enabled: boolean; reason?: string };
  on<E extends EventName>(event: E, handler: (e: EventMap[E]) => void): () => void;

  focus(): void;
  destroy(): void;
}
```

### 15.3 生命周期与打包

- `destroy()` 必须清理：所有事件监听、`ResizeObserver`、定时器、popup 层、节点池、在途请求与异步编辑任务；重复调用幂等；销毁后所有方法为空操作或返回 `destroyed`。
- 多实例互不影响：每实例独立的 EventBus、store、编辑器、菜单、选择、历史、加载状态。
- 包导出：`exports` 含 `.`（`types` + `import`）与 `./style.css`；`sideEffects` 只声明 CSS；不得在模块顶层访问 `document / window`。
- 公共类型全部从入口导出，泛型 `TRow` 贯穿配置、事件与实例方法。

## 16. VitePress 文档站

### 16.1 目标

文档站同时承担三件事：**说明**（概念与用法）、**演示**（可交互 demo）、**API 文档**（配置、方法、事件、类型）。原则是「文档即验收」：每个 demo 对应一个自动化测试，每个公共 API 都能在文档中找到条目，示例代码来自真实可运行的文件。文档站从 M1 起建立骨架，随每个里程碑同步补充对应页面（见 §18）。

### 16.2 目录

```text
website/
├─ package.json
├─ .vitepress/
│  ├─ config.ts                 # 站点、导航、侧边栏、搜索、别名
│  └─ theme/
│     ├─ index.ts               # 扩展默认主题；引入 edit-table/style.css；注册全局组件
│     └─ components/
│        ├─ TableDemo.vue       # 通用 demo 容器
│        ├─ DemoToolbar.vue     # 切换主题 / 密度 / 数据规模
│        └─ ApiTable.vue        # 渲染参数表（可选）
├─ index.md                     # 首页
├─ guide/                       # 指南
├─ config/                      # 配置参考
├─ api/                         # API 参考（手写 + generated/）
├─ demos/                       # 每个 demo 一个目录：index.md + config.ts + setup.ts
├─ performance.md               # 基准报告
└─ public/
```

### 16.3 站点配置要点

- `lang: 'zh-CN'`，`themeConfig.search.provider = 'local'`，开启 `outline`、`editLink`、`lastUpdated`。
- `vite.resolve.alias` 把 `edit-table` 指向 `../packages/core/src/index.ts`，开发时可热更新；`docs:build` 前先执行核心包 `build`，并用同一别名保证文档与源码一致。
- `base` 由环境变量决定，便于子路径部署。
- 不允许 `ignoreDeadLinks: true`；构建时的死链必须修复。

### 16.4 TableDemo 组件规格

```vue
<script setup lang='ts'>
import { onMounted, onBeforeUnmount, ref } from 'vue';
import { useData } from 'vitepress';

const props = defineProps<{ factory: () => Promise<DemoSetup>; height?: number }>();
const el = ref<HTMLElement>();
const { isDark } = useData();
let instance: TableInstance | undefined;

onMounted(async () => {
  const { createTable } = await import('edit-table');   // 只在浏览器里加载
  const setup = await props.factory();
  instance = createTable(el.value!, { ...setup.options, theme: isDark.value ? 'dark' : 'light' });
});
onBeforeUnmount(() => instance?.destroy());
</script>

<template>
  <div ref='el' class='demo-table' :style='{ height: (height ?? 420) + `px` }' />
</template>
```

规则：

- **SSR 安全**：VitePress 构建会在 Node 中渲染页面，所以 `createTable` 只能在 `onMounted` 内调用，库入口本身也不得访问 DOM（§4）。必要时包裹 `<ClientOnly>`。
- 容器必须有显式高度，否则不会出现滚动与虚拟化。
- `onBeforeUnmount` 必须 `destroy()`；HMR 或路由切换后不得残留监听与浮层。
- 文档站的暗色模式切换同步到 `setTheme`。
- 每个 demo 的配置写在 `demos/<name>/config.ts`，页面里用代码引入语法 `<<< @/demos/<name>/config.ts` 展示，同一个文件同时被运行，避免文档与实际代码漂移。

### 16.5 页面清单

| 分组 | 页面 | 内容 |
| --- | --- | --- |
| 首页 | `/` | 定位、特性、内嵌一个分组合并 + 小计的 demo |
| 指南 | `introduction`、`getting-started` | 是什么；安装、引入 CSS、最小示例、销毁 |
|  | `concepts` | 四类数据、事务、命令与事件 |
|  | `two-table-layout` | 两表布局原理、为什么不用 sticky、固定列与横向同步 |
|  | `grouping-and-merge` | 连续分组、自动合并、小计行占位、手动合并 |
|  | `calculations`、`derived-rows` | 计算字段、字段联动、小计与优惠、汇总 |
|  | `editing`、`selection-keyboard`、`clipboard` | 编辑器、选区、键盘、复制粘贴 |
|  | `validation`、`history`、`loading` | 校验与提交、撤销重做、加载状态 |
|  | `pinned-rows`、`virtualization`、`theming` | 固定对比行、大数据、主题与密度 |
|  | `framework-integration`、`troubleshooting` | 原生 / React / Vue 封装示例；常见问题 |
| 配置 | `table-config`、`columns`、`editors` | 顶层、列、编辑器配置项 |
|  | `groups-merges`、`calculations`、`derived-rows`、`summary`、`operations`、`style-and-theme` | 各模块配置项 |
| API | `create-table`、`instance`、`commands`、`events`、`types`、`errors` | 入口、实例方法、命令、事件、类型、错误码 |
| 演示 | `basic`、`group-merge`、`subtotal-offer`、`pinned-compare`、`big-data` | 见 §16.6 |
|  | `validation-submit`、`loading-states`、`theme-density`、`quotation` | 见 §16.6 |
| 其他 | `performance`、`changelog` | 基准报告与变更记录 |

### 16.6 Demo 规格

| Demo | 数据规模 | 演示点 | 对应测试 |
| --- | --- | --- | --- |
| basic | 20 行 | 五类编辑器、键盘、复制粘贴、撤销重做 | 编辑与键盘用例 |
| group-merge | 24 行 | 两层分组、自动合并、改分组值整组改名 | 合并跨度与分组编辑 |
| subtotal-offer | 24 行 | 各层小计、优惠输入、汇总、一次输入一次撤销 | §17.1 样例与手算数据 |
| pinned-compare | 60 行 | 固定一到三行、滚动对比、源行变化同步、定位原行 | 固定对比行用例 |
| big-data | 切换 1 万 / 10 万 / 50 万 | 虚拟滚动、合并叠加层、帧率面板 | 滚动一致性与性能采样 |
| validation-submit | 30 行 | 动态规则、去重、提交首错定位 | 校验与提交用例 |
| loading-states | 可模拟 | 首次加载、刷新、空态、失败重试、竞态 | 加载状态用例 |
| theme-density | 24 行 | 三主题、两密度、条件样式 | 视觉快照 |
| quotation | 24 行 + 截图场景 | 综合：分组、联动、小计、优惠、固定列 | §17.2 手算数据 |

每个 demo 页面固定结构：目的 → 运行区 → 试一试（可操作清单）→ 配置代码 → 关键 API → 相关指南链接。

### 16.7 API 文档规范

- **双轨来源**：手写页面负责语义与示例；`typedoc` + `typedoc-plugin-markdown` 在 `docs:api` 脚本中生成 `api/generated/` 的类型签名。生成目录不手改，由 CI 在 `docs:build` 之前生成。
- 每个公共方法条目必须有：签名、参数表、返回值、同步 / 异步、失败条件与命令码、示例、相关事件。
- 每个配置项条目必须有：类型、默认值、是否必填、示例、对应的配置错误码、与其他配置项的约束。
- 事件页必须有：负载类型、触发时机、与 `dataChange` 的先后顺序。
- 所有代码示例要么来自可运行文件（代码引入），要么通过 `docs:check-snippets`（用 tsc 对示例做类型检查）。

### 16.8 文档站验收

1. 在 Node 中 `import 'edit-table'` 不报错，`docs:build` 零警告通过，无死链。
2. Playwright 遍历全部 demo 页面：无 console error，实例可创建、可销毁、重复进出路由后无残留浮层。
3. 亮 / 暗模式切换后 demo 显示正确。
4. 每个指南页都有「相关 API」链接；每个公共方法、配置项、事件在 API 页中有条目。
5. big-data demo 在 10 万行下可操作，性能页的数字来自实测并附原始采样。

## 17. 最小样例与报价案例

### 17.1 最小纵向切片（M1 验收）

首个纵向切片：普通编辑、计算字段、项目小计、独立优惠输入、最终汇总。金额用 number 仅为了便于手算。核心额外导出无 DOM 的 `createModel(options)`，提供 `TableInstance` 中数据、派生输入、汇总、历史、命令的子集；M1 至 M3 的测试只使用它。

```ts
interface GroupRule { key: string; fields: string[]; idField?: string; renameFields?: string[] }
// renameFields：在合并格上编辑这些字段，等于对组内全部真实记录写同一个值（§8.5）

const rows = [
  { id: 'r1', projectId: 'p1', project: '会场', name: '租赁', qty: 2, price: 100 },
  { id: 'r2', projectId: 'p1', project: '会场', name: '布置', qty: 1, price: 50 },
];

const config: TableConfig = {
  rowNumbers: true,
  rowPinning: { maxRows: 3 },
  columns: [
    { field: 'project', title: '项目', editable: true },
    { field: 'name', title: '需求', editable: true },
    { field: 'qty', title: '数量', editable: true, editor: 'number', valueType: 'number' },
    { field: 'price', title: '单价', editable: true, editor: 'number', valueType: 'number' },
    { field: 'total', title: '金额', format: 'amount' },
  ],
  groups: [{ key: 'project', fields: ['project'], idField: 'projectId', renameFields: ['project'] }],
  merges: { vertical: [{ column: 'project', by: 'project' }] },
  calculations: [{
    id: 'amount', scope: 'row', reads: ['qty', 'price'], writes: ['total'],
    compute: ({ row }) => ({ total: Number(row.qty) * Number(row.price) }),
  }],
  derivedRows: [
    { id: 'subtotal', level: 'project', labelColumn: 'name', label: '项目小计',
      cells: { total: { type: 'aggregate', of: 'total', agg: 'sum' } } },
    { id: 'offer', level: 'project', labelColumn: 'name', label: '项目打包价',
      cells: { total: { type: 'input', field: 'total', default: null, editor: 'number',
        rules: [{ validator: (_r, v) => v === null || Number(v) >= 0, message: '优惠价不能为负数' }] } } },
  ],
  summary: {
    items: [{
      key: 'payable', label: '应付金额',
      compute: ({ results }) => results
        .filter((r) => r.ruleKey === 'subtotal')
        .reduce((sum, st) => {
          const offer = results.find((r) => r.ruleKey === 'offer' && r.groupKey === st.groupKey);
          return sum + Number(offer?.values.total ?? st.values.total);
        }, 0),
    }],
  },
};

const table = createTable(container, { rowKey: 'id', dataSource: rows, config });
```

逐项验收：

1. 初始：真实记录 `total` 为 200 / 50；`getSummary().payable === 250`；`getDataSource().length === 2`（两条派生行不进入真实记录）。
2. 在「项目打包价」输入 180：`payable === 180`，真实记录的 `total` 仍为 200 / 50；`getDerivedValues()` 为 `[{ ruleKey: 'offer', groupKey: 'p1', field: 'total', value: 180 }]`。
3. 输入 0：`payable === 0`（0 是有效优惠，不等于未录入）。
4. 清空输入：`payable === 250`，`getDerivedValues()` 为 `[]`。
5. 修改项目名称：同组全部真实记录一起改名，打包价输入仍跟随稳定的 `projectId = 'p1'`。
6. 一次输入只产生一条历史：输入 180 后执行一次 `undo`，回到未录入状态。
7. 打包价输入负数：校验失败，错误提示为「优惠价不能为负数」，数据不写入。

不能只完成这个切片：它只证明流水线贯通，完整语义仍需 §19 的验收矩阵。

### 17.2 案例 A：通用报价（业务规则以此为准）

核心不得硬编码本节规则，全部通过配置与业务纯函数组合，放在 `examples/quotation`。

**规模与字段**：6 个分类，每类 1 个项目，每项目 4 条需求，共 24 条真实记录；分类为会务、住宿、交通、活动、物料、人员。性能场景另有 500 / 2000 行数据工厂，不作为演示默认规模。字段：`id`、`categoryName`、`projectName`、`projectId`、`requirement`、`qualityA`（数量）、`qualityB`（天数）、`unitPrice`（含税单价）、`invoiceType`、`taxRate`（百分数）、`unitCost`、`itemPrice`、`itemCost`、`taxDifference`、`remark`。

**预设**：`standard`（12 列）、`compact`（4 列）、`finance`（8 列），切换保留业务数据；这里的 compact 列组合与 `density: 'compact'` 是两个独立概念。

**分组与派生行**：分类 → 项目两层；小计与优惠使用 `${scope}-total` 与 `${scope}-offer`，整表优惠为 `grand-offer`；默认演示只显示部分层级，隐藏的结果仍参与计算。

**精确金额**：使用 BigNumber，内部小数精度 10 位，以十进制定点字符串返回，展示通常保留 2 位。设 Q = qualityA × qualityB，输入税率 r = taxRate / 100，输出税率 t = 0.06，税差因子 f = 0.12，服务费率 s（配置工厂默认 0，常用演示 0.05）：

| 输出 | 算法 |
| --- | --- |
| unitCost | unitPrice / (1 + r)，保留内部精度 |
| itemPrice | Q × unitPrice |
| itemCost | Q × 已保留内部精度的 unitCost |
| taxDifference | itemCost × (t − r) × f；taxRate 为 null 时明细税差为 null |
| serviceFee | itemCost × s |
| taxFee | (itemCost + serviceFee) × t |
| totalize | 不含税合计 + 服务费 + 税费 + 税差 |

**业务语义**：

- 发票映射（示例）：`normal → 0%`，`vat → 1.6%`。修改发票只影响当前明细，随后通过依赖更新金额。
- 打包价是人工提供的含税总价：用作用域第一条真实记录的税率反推不含税金额，再计算税差、服务费、税费。混合税率作用域的打包价不按明细加权，这是现有示例语义。
- 有效优惠替代当前组小计参与父级汇总；父级只累加直接子级的有效结果；整表优惠覆盖所有根组结果，避免重复计数。数字或有效十进制字符串 0 是有效金额；空值表示未录入。
- 互斥：`project-offer` 与 `grand-offer` 不得同时输入。有任何项目价时禁用总价输入，有总价时禁用项目输入，清空最后一笔后恢复；动态 `editable` 与 `validateDerivedValues` 同时约束，外部整批回填也必须遵守。

**手算验收**（qualityA = 2、qualityB = 1、unitPrice = 100、taxRate = 0、s = 0.05）：

- unitCost = 100，itemPrice = 200，itemCost = 200。
- taxDifference = 1.44，serviceFee = 10，taxFee = 12.6，totalize = 224.04。
- 该组输入打包价 180：itemCost = 180，taxDifference = 1.296，serviceFee = 9，taxFee = 11.34，totalize = 201.636，展示两位为 201.64。
- 打包价 0：该有效组全部金额归零；清空：恢复明细汇总。

### 17.3 案例 B：截图场景（含税金额 / 不含税 / 税额）

对应你提供的截图：分类 → 项目两层分组，每个项目一行小计，小计行从项目列起横向接管、标签在需求列。

**列**：分类、项目、需求、数量、天数、含税单价、发票类型（select，可搜索）、税率（由发票类型联动）、含税金额、不含税金额、税额、消费日期（date）、备注（带批注角标）。

**计算**（使用 BigNumber，内部 10 位小数，展示 2 位）：

```ts
calculations: [
  { id: 'gross', scope: 'row', reads: ['qty', 'days', 'price'], writes: ['gross'],
    compute: ({ row }) => ({ gross: bn(row.qty).times(row.days).times(row.price).toFixed(10) }) },
  { id: 'tax', scope: 'row', reads: ['gross', 'taxRate'], writes: ['net', 'tax'],
    compute: ({ row }) => {
      const net = bn(row.gross).div(bn(1).plus(bn(row.taxRate).div(100))).decimalPlaces(10);
      return { net: net.toFixed(10), tax: bn(row.gross).minus(net).toFixed(10) };
    } },
],
fieldTransitions: [
  { id: 'invoice-rate', trigger: { field: 'invoiceType' },
    apply: ({ newValue }) => ({ taxRate: INVOICE_RATE[String(newValue)] ?? null }) },
],
derivedRows: [
  { id: 'project-total', level: 'project', labelColumn: 'requirement',
    label: ({ group }) => `${group.values.project}总计`,
    cells: {
      gross: { type: 'aggregate', of: 'gross', agg: sumDecimal },
      net:   { type: 'aggregate', of: 'net',   agg: sumDecimal },
      tax:   { type: 'aggregate', of: 'tax',   agg: sumDecimal },
    } },
],
```

`INVOICE_RATE` 属于示例配置：验收数据只使用「增值税专用发票 → 6%」与「普通发票 → 0%」，其余发票类型的税率由示例自行约定。

**手算验收数据**（取自截图并已逐项复算）：

| 行 | 数量 × 天数 × 含税单价 | 税率 | 含税金额 | 不含税金额 | 税额 |
| --- | --- | --- | --- | --- | --- |
| 主会场半天 | 1 × 1 × 2,000 | 6% | 2,000.00 | 1,886.79 | 113.21 |
| 分会场讨论室 | 2 × 1 × 800 | 6% | 1,600.00 | 1,509.43 | 90.57 |
| 签到区 | 1 × 1 × 600 | 0% | 600.00 | 600.00 | 0.00 |
| 贵宾休息室 | 1 × 1 × 900 | 6% | 900.00 | 849.06 | 50.94 |
| 投影设备 | 1 × 1 × 500 | 6% | 500.00 | 471.70 | 28.30 |

| 小计 | 含税金额 | 不含税金额 | 税额 |
| --- | --- | --- | --- |
| 场地总计 | 5,100.00 | 4,845.28 | 254.72 |
| 设备总计 | 3,900.00 | 3,815.09 | 84.91 |
| 会场布置总计 | 3,800.00 | 3,584.91 | 215.09 |

- **小计必须用精确值求和后再舍入**，不能把明细的展示值相加。例如设备总计的不含税金额是 3,815.09，而四条明细舍入后相加是 3,815.10。
- **截图中第 12 行（商务双床房）存疑**：7,680.00 按 6% 反推不含税应为 7,245.28、税额 434.72，截图显示 7,246.23 与 433.77，疑似设计稿笔误，因此酒店总计不纳入验收数据。

**截图对照验收清单**：

1. 分类列（第 1 层）穿过各项目小计行；项目列（第 2 层）只覆盖数据行，不含小计行。
2. 活动格有高亮描边，当前行左侧有蓝色指示条。
3. 发票类型下拉含搜索框与「选中项勾选」状态，展开时不被表格裁剪。
4. 日期单元格弹出日历浮层，当前日期高亮。
5. 需求与备注列单元格右上角有红色批注角标，悬停显示提示（如「包含早餐」）。
6. 行右键菜单含：在上方插入一行、在下方插入一行、删除当前行、批量复制当前行、锁定当前行、固定为对比行。
7. 「消费日期」表头的排序图标本期只作为静态展示，排序功能在路线图。

## 18. 里程碑

通用完成定义（每个里程碑都适用）：测试与 lint 通过并给出**实际命令输出**；对应的文档页与 demo 已写；公共 API 无遗留 TODO；本文有冲突或补充时已更新本文。

### M0 技术验证（1–2 天，一次性原型，不进入正式 src）

**目标**：在写任何正式代码前，验证 §9.9 的 6 项风险，决定采用 §9.5 的 transform 补偿，还是启用 §9.10 的回退方案。

**交付物**：`spikes/two-table/` 独立页面 + `spikes/REPORT.md`。

- a. 两表布局：头体横向同步、垂直滚动条补偿。
- b. 固定列 transform 补偿 + 头表内的固定对比行；分别用触控板惯性滚动、拖动滚动条、键盘滚动观察是否滞后。
- c. 10 万行虚拟化 + 纵向合并叠加层（块高度大于视口）+ 坐标命中测试。
- d. **复现你遇到的 sticky 问题**：记录浏览器版本、现象与最小复现，作为必须避免的反例。
- e. 浏览器矩阵：最新 Chrome、Safari（macOS）、Firefox；DPR 1 与 2；浏览器缩放 80 / 100 / 125 / 150%。

**验收**：REPORT 逐项给出通过 / 失败、截图或录屏、结论与决策（采用 / 采用并接管 wheel / 改三窗格）。没有写下决策，不进入 M1。

### M1 工程与核心模型（含文档站骨架）

- **交付**：monorepo；TypeScript strict；§2.3 脚本；`createModel`；配置归一化与 `TableConfigError`；数据所有权（身份、冻结快照、结构共享）；分组；calculations（拓扑、作用域、失败原子）；fieldTransitions；derivedRows（聚合、独立输入、差量）；summary；`website/` 骨架（首页、getting-started、concepts），`docs:build` 通过。
- **验收**：§17.1 的 7 项；配置错误用例；随机编辑 100 次后，增量结果与全量重算完全一致（属性测试）；Node 中 `import 'edit-table'` 不报错。

### M2 事务、历史、命令与事件

- **交付**：事务应用与回滚；undo / redo；`executeCommand` 串行队列与 `CommandResult`；事件总线（冻结负载）；会话代次工具；`updateFields`；`setDataSource / replaceDataSource` 语义；`destroy` 幂等。
- **验收**：计算抛错时数据、独立输入、历史、事件均无变化；撤销后派生行与汇总正确；模拟的过期异步结果被丢弃。
- **文档**：history、命令与事件 API 页。

### M3 视图模型

- **交付**：flatten、spans、rowMetrics（前缀和）、coordinateMap；VerticalMerge / HorizontalMerge / rowRules；手动合并（模型层）。
- **验收**：以案例 B 的结构（两层分组 + 项目小计）断言每个合并块的起止与覆盖范围，覆盖 §8.3 全部规则；坐标往返一致；增量重建与全量重建一致（属性测试）；记录 10 万行下 flatten 与行度量构建耗时。
- **文档**：grouping-and-merge。

### M4 只读渲染与虚拟化

- **交付**：§9 两表布局全部；列宽拖拽、列显隐；固定列；行号与条纹；主题与密度；合并叠加层；固定对比行（只读，§10）；虚拟滚动（§11）；刷新分级；popup 层基础设施。
- **验收（真实浏览器）**：横向与纵向滚动中头体对齐（Playwright 断言偏差 ≤ 1px）；固定列位置在滚动中恒定；合并块内容始终居中于可见部分；10 万行下 DOM 数据行数不超过约 400；固定对比行随横向滚动与列宽联动；**源码与构建产物中不得出现 `position: sticky`**（CI 扫描）。
- **文档**：two-table-layout、virtualization、pinned-rows、theming；demo：pinned-compare、big-data（只读）。

### M5 编辑与交互

- **交付**：编辑状态机；5 类编辑器（select 可搜索）；IME；选区（合并扩展）与键盘；剪贴板；行右键菜单与 operations；边缘自动滚动。
- **验收**：§12 全部；提交走完整管线；虚拟化下编辑行保持存活；中文 IME 输入不丢字；粘贴报告正确。
- **文档**：editing、selection-keyboard、clipboard；demo：basic、group-merge、subtotal-offer。

### M6 校验、加载与手动合并

- **交付**：校验（规则、去重、首错定位、`getSubmission`）；加载状态（两种接入方式、竞态）；手动合并 UI（预览确认）。
- **验收**：§13.1 与 §14.1 全部；竞态用例：慢的旧请求晚于新请求返回时被丢弃。
- **文档**：validation、loading；demo：validation-submit、loading-states。

### M7 增强

- **交付**：批注角标、行锁定、批量复制行、固定对比行差异高亮、`rowHeight: 'auto'` 测量。
- **验收**：§14.5 逐项；自动行高下 10 万行抽样滚动不跳动。

### M8 案例、API 文档与发布

- **交付**：`examples/quotation`（案例 A 与案例 B）；quotation demo；完整 API 页（含 typedoc 生成部分）；性能报告（含原始采样）；基础无障碍检查（键盘可达、合并格 aria）；发布配置（`exports`、`files`、`npm pack` 验证、changelog）。
- **验收**：§19 全部；`docs:build` 零警告；§17.2 与 §17.3 的手算数据全部通过。

### M9 React 薄适配（可选）

- **交付**：`<EditTable />` 组件，`ref` 取实例；`config` 变化走 `updateConfig`；`dataSource` 采用显式同步策略，不在每次 render 时调用 `setDataSource`；自定义内容经 portal 渲染；framework-integration 文档。
- **验收**：StrictMode 双挂载后无残留；卸载时 `destroy`。

## 19. 验收矩阵

| 领域 | 必须验证 | 手段 | 里程碑 |
| --- | --- | --- | --- |
| 所有权 | 不修改宿主对象；读取返回冻结快照；未变更记录引用复用 | Vitest | M1 |
| 配置 | 未知引用、重复 id、循环依赖、交叉布局、越界样式均给出带 `path / code` 的 `TableConfigError` | Vitest | M1 |
| 计算 | 拓扑顺序；作用域；抛错整体回滚 | Vitest | M1 / M2 |
| 派生行 | 差量聚合等于全量；输入随 `groupKey` 迁移；丢弃上报 | Vitest | M1 |
| 样例 | §17.1 七项 | Vitest | M1 |
| 事务历史 | 一次意图一条历史；撤销重做包含计算写回 | Vitest | M2 |
| 命令 | 串行；失败码；`destroyed` | Vitest | M2 |
| 异步竞态 | 命令、加载、候选、拦截、校验的旧结果被丢弃 | Vitest | M2 / M6 |
| 视图模型 | 合并覆盖规则；坐标往返；增量等于全量 | Vitest | M3 |
| 两表对齐 | 滚动中头体对齐；滚动条出现 / 消失 | Playwright | M4 |
| 固定列 | 各滚动位置恒定；阴影仅在滚动时出现 | Playwright | M4 |
| 无 sticky | 源码与产物扫描 | CI 脚本 | M4 |
| 缩放与 DPR | 80%–200%、DPR 1 / 2 下无可见错位 | Playwright + 人工 | M4 |
| 虚拟化 | DOM 行数上限；快速滚动无白屏；编辑行存活 | Playwright | M4 / M5 |
| 合并叠加层 | 块高于视口时内容居中于可见部分；命中测试 | Playwright | M4 |
| 固定对比行 | 容量先进先出；同步；源行删除自动取消；横向联动；不进选区与历史 | Vitest + Playwright | M4 |
| 编辑 | 状态机；提交管线；IME | Playwright | M5 |
| 选择与键盘 | 合并扩展；整列跳过派生行；边缘滚动；§12.4 全部按键 | Playwright | M5 |
| 剪贴板 | 复制 TSV + HTML；粘贴报告；合并块粘贴 | Playwright | M5 |
| 行操作 | 菜单显隐与可用；最少剩余；复制行；锁定行 | Vitest + Playwright | M5 / M7 |
| 校验 | 动态规则；去重；首错定位；提交采集 | Vitest | M6 |
| 加载 | 状态机；刷新失败保留旧数据；竞态 | Vitest | M6 |
| 外观 | 主题；密度；状态优先级；越界样式拒绝 | Playwright + 快照 | M4 / M5 |
| 生命周期 | `destroy` 清理；多实例隔离；重复 `destroy` | Vitest + Playwright | M2 / M4 |
| SSR | Node 中导入不报错；`docs:build` 通过 | CI | M1 起 |
| 文档站 | §16.8 五项 | CI + Playwright | M8 |
| 性能 | §11.5 目标实测并附原始采样 | 基准脚本 | M8 |
| 案例 | §17.2、§17.3 手算数据 | Vitest + Playwright | M8 |

## 20. 工程约定与 agent 规则

### 20.1 开工清单

```bash
mkdir edit-table && cd edit-table && git init
# 1. 初始化 workspace：packages/core、website（可选 packages/react、examples/quotation、e2e）
# 2. 开发依赖：typescript vite vitest playwright vitepress typedoc typedoc-plugin-markdown
# 3. 运行时依赖：async-validator（仅 packages/core）
# 4. 先完成 M0 的 spike 与 REPORT，再开始 M1
```

### 20.2 规则

1. 遇到本文没写的细节：先查本文，仍不明确就提出具体问题，或在仓库的 `DECISIONS.md` 记录假设，不得自行扩大范围。
2. 声称完成之前必须运行对应测试，并贴出命令与真实输出；不得声称未运行的测试通过。
3. 核心包不出现业务词汇（报价、税率、发票），不新增运行时依赖，除非在 `DECISIONS.md` 记录原因。
4. 公共 API 或配置项变更必须同步更新文档站对应页面与 demo。
5. 性能结论必须附原始采样与环境（浏览器版本、机器、DPR、数据规模）。
6. 全库禁止 `position: sticky`；类名前缀 `et-`，CSS 变量前缀 `--edit-table-`。
7. 模型层与视图层保持纯函数优先，不 import DOM 类型；测试金字塔以模型单测为主，jsdom 少量，Playwright 只覆盖布局、滚动、IME、剪贴板与关键路径。
8. 每个里程碑结束时回读本文，把实现中确认的新事实写回对应章节。

## 21. 路线图（本期不做）

单元格公式与依赖图；排序与过滤；多级表头；列拖拽重排与行拖拽排序；填充柄；历史持久化；实时协作；Canvas 渲染；超大高度的滚动条缩放与服务端行模型；导入导出（CSV / xlsx / PDF）；多 Sheet；完整屏幕阅读器支持；自动列宽；Vue / Angular 适配包。

## 附录 A. 与旧规格的配置名称对照

| 旧规格 | 本文 |
| --- | --- |
| `calculations[].key / dependsOn / calculate(row)` | `id / reads / compute({ row })`，增加 `scope` |
| `merges.vertical[].fields / scope` | `merges.vertical[].column / by` |
| `derivedRows[].scope` | `derivedRows[].level` |
| `derivedRows[].cells`（数组，`range` / `content.parts`） | `cells`（按列 field 的记录）+ `labelColumn` + `label` |
| `derivedRows[].inputs` 与 `calculate` | `cells[field]` 的 `type: 'input' \| 'aggregate' \| 'compute'` |
| `summary.items[]` 与整体 `calculate` | `summary.items[].compute` |
| `groups[].key / fields / idField / renameFields` | 保持不变 |
| 只读固定对比区（独立滚动与高度限制） | 头表内的固定对比行：单行省略、容量限制，无独立滚动 |
| 分离的 header / body table + 滚动补偿 | 保留两表，明确同步规则、固定列 transform 补偿，禁用 sticky |

## 实现补充记录（2026-10-30）

以下解释已经用户确认：GroupRule 标识统一为 key；派生 input 可编辑，其余派生单元格只读；pinnedText / comment / pinnedDiff / rowHeight 补入公共类型；列宽拖动先显示参考线，释放后统一提交。用户免除旧 sticky 异常追溯，要求参考 Ant Design Table 的表头、表体与列宽组织。

新增可选工具栏参数位于 CreateTableOptions：toolbar 默认 true，toolbarActions 可追加业务按钮。内置撤销、重做、主题、密度、列显隐、全屏，以及按配置启用的合并与固定对比图标。saveEdit 与 setLoadingState 分别明确提交草稿及宿主加载状态同步入口。独立输入可通过 setDerivedValue 命令写入。

分组跨度和精确金额以案例 B 的手算数据验证；截图中酒店第二行采用复算后的 7,245.28 / 434.72。实际验收证据、性能边界与尚需人工复核的项目见 IMPLEMENTATION.md、spikes/REPORT.md 与 website/performance.md。性能目标与实测结果分开，不将目标值声明为已达到。
