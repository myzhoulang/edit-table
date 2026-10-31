import type { RuleItem } from 'async-validator';

export type Scalar = string | number | boolean | null | undefined;
export type Row = Record<string, unknown>;
export type Theme = 'light' | 'green' | 'dark';
export type Density = 'normal' | 'compact';
export type EditorName = 'text' | 'number' | 'date' | 'select' | 'cascader';
export type Rule = RuleItem;
export type Option =
  Scalar | { label: string; value: Scalar; disabled?: boolean; children?: Option[] };
export type CellStyle = Record<string, string | number>;
export type RowTarget =
  { kind: 'record'; rowKey: string } | { kind: 'derived'; ruleKey: string; groupKey: string };
export type CellTarget = RowTarget & { field: string };
export type CellRef = { row: number; col: number };
export type CellRange = { anchor: CellRef; focus: CellRef };
export type SelectionSnapshot = {
  ranges: readonly CellRange[];
  active: CellRef | null;
  mode?: 'row' | 'column';
};
export type DerivedValue = { ruleKey: string; groupKey: string; field: string; value: Scalar };
export type DerivedRowView = {
  kind: 'derived';
  ruleKey: string;
  groupKey: string;
  depth: number;
  label: string;
  labelColumn: string;
  values: Readonly<Record<string, Scalar>>;
  visible: boolean;
};
export type GroupNode = {
  id: string;
  key: string;
  scope: string;
  values: Readonly<Record<string, unknown>>;
  parentId: string | null;
  depth: number;
  occurrence: number;
  start: number;
  end: number;
  children: GroupNode[];
};
export type GroupContext<TRow extends object = Row> = {
  rows: readonly TRow[];
  group: GroupNode;
  context: unknown;
};
export type DerivedContext<TRow extends object = Row> = GroupContext<TRow> & {
  inputs: Readonly<Record<string, Scalar>>;
  results: readonly DerivedRowView[];
};
export type SummaryContext<TRow extends object = Row> = {
  rows: readonly TRow[];
  results: readonly DerivedRowView[];
  context: unknown;
};
export type RecordChange<TRow extends object = Row> = {
  rowKey: string;
  before?: Readonly<TRow>;
  after?: Readonly<TRow>;
  /** dataChange 中提供前后源下标，便于同步增删和顺序变化。 */
  beforeIndex?: number;
  afterIndex?: number;
};
export type SummaryUpdateContext<TRow extends object = Row> = SummaryContext<TRow> & {
  previous: Scalar;
  changes: readonly RecordChange<TRow>[];
  previousResults: readonly DerivedRowView[];
};
export type CalcContext<TRow extends object = Row> = {
  row: Readonly<TRow>;
  rows: readonly TRow[];
  group?: GroupNode;
  context: unknown;
};
export type CellStyleContext<TRow extends object = Row> = {
  value: unknown;
  row: Readonly<TRow>;
  field: string;
  column: ColumnDef<TRow>;
  rowIndex: number;
};
export type CellBehaviors = Partial<
  Record<
    | 'selectable'
    | 'navigable'
    | 'copyable'
    | 'editable'
    | 'clearable'
    | 'pasteable'
    | 'menuable'
    | 'validatable'
    | 'columnSelectable'
    | 'pasteTarget'
    | 'expandSelection'
    | 'mergeable',
    boolean
  >
>;
export type CellLayout = (
  { column: string; range?: never } | { column?: never; range: { from: string; until?: string } }
) & {
  field?: string;
  content?: { parts: (string | { field: string })[] };
  render?: (container: HTMLElement, row: Readonly<object>) => void | (() => void);
  behaviors?: CellBehaviors;
  cellStyle?: CellStyle;
  cellClassName?: string;
};
export type RowLayout = { cells: CellLayout[] };
export type RowRule = { id: string; match: { field: string; equals: unknown }; layout: RowLayout };
export type VerticalMerge = { column: string; by: string };
export type HorizontalMerge = { rule: string; from: string; until?: string };
export type ManualMergeRule = { column: string; rowKinds?: ('record' | 'derived')[] };
export type ManualMerge = {
  field: string;
  /** 真实记录的兼容查询字段；包含派生行时使用 targets 保存完整顺序。 */
  rowKeys: readonly string[];
  targets?: readonly RowTarget[];
};
export type DedupConfig<TRow extends object = Row> = {
  scope?: 'table' | string;
  excludeCurrentGroup?: boolean;
  when?: (row: Readonly<TRow>) => boolean;
  message?: string;
};
export interface ColumnDef<TRow extends object = Row> extends Omit<CellBehaviors, 'editable'> {
  field: string;
  key?: string;
  title: string;
  width?: number;
  minWidth?: number;
  maxWidth?: number;
  resizable?: boolean;
  fixed?: 'left' | 'right';
  hidden?: boolean;
  align?: 'left' | 'center' | 'right';
  editable?: boolean | ((row: Readonly<TRow>, rows: readonly TRow[]) => boolean);
  editor?: EditorName | ((row: Readonly<TRow>, field: string) => EditorName);
  options?: Option[] | ((row: Readonly<TRow>, search?: string) => Option[] | Promise<Option[]>);
  editorProps?: Record<string, unknown>;
  valueType?: 'string' | 'number' | 'boolean' | 'date';
  rules?: Rule[] | ((value: unknown, row: Readonly<TRow>) => Rule[]);
  deduplication?: DedupConfig<TRow>;
  updateValueBefore?: (
    value: unknown,
    row: Readonly<TRow>,
    table: TableInstance<TRow>,
  ) => boolean | void | Promise<boolean | void>;
  render?: (
    value: unknown,
    row: Readonly<TRow>,
    rows: readonly TRow[],
    container: HTMLElement,
  ) => void | (() => void);
  formatter?: (value: unknown, ctx: { currency: string }) => string | number;
  format?: 'amount';
  emptyValue?: string;
  overflowTooltip?: boolean;
  pinnedText?: (value: unknown, row: Readonly<TRow>) => string;
  comment?: (row: Readonly<TRow>, ctx: CellStyleContext<TRow>) => string | undefined;
  cellStyle?: CellStyle | ((ctx: CellStyleContext<TRow>) => CellStyle | undefined);
  cellClassName?: string | ((ctx: CellStyleContext<TRow>) => string | undefined);
}
export interface GroupRule {
  key: string;
  fields: string[];
  idField?: string;
  renameFields?: string[];
}
export interface CalculationRule<TRow extends object = Row> {
  id: string;
  scope: 'row' | { group: string };
  reads: string[];
  writes: string[];
  compute: (ctx: CalcContext<TRow>) => Record<string, Scalar> | null;
}
export interface FieldTransition<TRow extends object = Row> {
  id: string;
  trigger: { field: string };
  apply: (ctx: {
    row: Readonly<TRow>;
    oldValue: unknown;
    newValue: unknown;
  }) => Partial<TRow> | null;
}
export type DerivedCell<TRow extends object = Row> =
  | {
      type: 'aggregate';
      of?: string;
      agg:
        | 'sum'
        | 'count'
        | 'min'
        | 'max'
        | 'avg'
        | ((rows: readonly TRow[], ctx: GroupContext<TRow>) => Scalar);
    }
  | {
      type: 'input';
      field: string;
      default?: Scalar;
      editor?: EditorName;
      rules?: Rule[];
      editable?: boolean | ((ctx: DerivedContext<TRow>) => boolean);
    }
  | { type: 'compute'; fn: (ctx: DerivedContext<TRow>) => Scalar }
  | { type: 'text'; text: string };
export interface DerivedRowRule<TRow extends object = Row> {
  id: string;
  level: string | 'table';
  position?: 'after-group' | 'before-group';
  labelColumn: string;
  label: string | ((ctx: GroupContext<TRow>) => string);
  cells: Record<string, DerivedCell<TRow>>;
  visible?: (ctx: GroupContext<TRow>) => boolean;
}
export interface SummaryConfig<TRow extends object = Row> {
  items: {
    key: string;
    label: string;
    compute: (ctx: SummaryContext<TRow>) => Scalar;
    /** 可选的纯函数差量更新；首次创建和配置变化仍调用 compute。 */
    update?: (ctx: SummaryUpdateContext<TRow>) => Scalar;
  }[];
}
export type OperationContext<TRow extends object = Row> = {
  rows: readonly TRow[];
  row: Readonly<TRow> | undefined;
  rowKey: string | undefined;
  start: number;
  end: number;
  table: TableInstance<TRow>;
  context: unknown;
};
export interface OperationAction<TRow extends object = Row> {
  key: string;
  label: string;
  kind?: 'add' | 'remove' | 'duplicate' | 'lock' | 'pin' | 'custom';
  icon?: string;
  danger?: boolean;
  scope?: 'row' | 'table' | string;
  fields?: string[];
  position?: 'before' | 'after' | 'end';
  minRemaining?: number;
  message?: string;
  rowDefaults?: Partial<TRow>;
  inheritFields?: string[];
  visible?: (ctx: OperationContext<TRow>) => boolean;
  enabled?: (ctx: OperationContext<TRow>) => boolean;
  create?: (ctx: OperationContext<TRow>) => TRow[] | false | Promise<TRow[] | false>;
  execute?: (ctx: OperationContext<TRow>) => void | Promise<void>;
}
export type Locale = {
  empty: string;
  loading: string;
  retry: string;
  noOptions: string;
  search: string;
  readonly: string;
};
export interface TableConfig<TRow extends object = Row> {
  columns: ColumnDef<TRow>[];
  readonly?: boolean;
  rowNumbers?: boolean;
  striped?: boolean;
  rowPinning?: boolean | { maxRows?: number };
  pinnedDiff?: boolean;
  virtualization?: boolean | { threshold?: number; overscan?: number };
  rowHeight?: number | 'auto';
  rowRules?: RowRule[];
  groups?: GroupRule[];
  merges?: { vertical?: VerticalMerge[]; horizontal?: HorizontalMerge[] };
  manualMerge?: { rules: ManualMergeRule[] };
  fieldTransitions?: FieldTransition<TRow>[];
  operations?: { actions: (OperationAction<TRow> | 'add' | 'remove')[] };
  calculations?: CalculationRule<TRow>[];
  derivedRows?: DerivedRowRule<TRow>[];
  validateDerivedValues?: (values: readonly DerivedValue[], ctx: unknown) => string | null;
  summary?: SummaryConfig<TRow>;
  context?: unknown;
  locale?: Partial<Locale>;
  editorOptions?: Partial<Record<EditorName, Record<string, unknown>>>;
}
export interface CreateModelOptions<TRow extends object = Row> {
  config: TableConfig<TRow>;
  rowKey?: string | ((row: TRow) => string);
  dataSource?: TRow[];
  derivedValues?: DerivedValue[];
  onError?: (error: Error) => void;
  historyLimit?: number;
}
export interface CreateTableOptions<TRow extends object = Row> extends CreateModelOptions<TRow> {
  dataLoader?: (ctx: {
    signal: AbortSignal;
    requestId: number;
  }) => Promise<TRow[] | { rows: TRow[]; emptyReason?: 'empty' | 'filtered' }>;
  loading?: boolean;
  loadError?: unknown;
  emptyReason?: 'empty' | 'filtered';
  onRetry?: () => void;
  theme?: Theme;
  density?: Density;
  currency?: string;
  toolbar?: boolean;
  toolbarActions?: {
    key: string;
    label: string;
    icon?: string;
    execute: (table: TableInstance<TRow>) => void | Promise<void>;
  }[];
  height?: number | string;
  getPopupContainer?: () => HTMLElement;
}
export type CommandResult = { ok: boolean; code?: string; message?: string; data?: unknown };
export type ValidationError = { target?: CellTarget; message: string };
export type ValidationResult = {
  valid: boolean;
  errors: readonly ValidationError[];
  firstError: ValidationError | null;
};
export type DataState = {
  status:
    'loading' | 'refreshing' | 'ready' | 'empty' | 'filtered-empty' | 'error' | 'refresh-error';
  loading: boolean;
  hasData: boolean;
  error?: unknown;
  requestId: number;
};
export type PinnedRowInfo = {
  target: RowTarget;
  viewIndex: number;
  texts: Readonly<Record<string, string>>;
};
export type Submission<TRow extends object = Row> = {
  records: readonly TRow[];
  derivedValues: readonly DerivedValue[];
  summary: Readonly<Record<string, Scalar>>;
};
export type CellChange = { target: CellTarget; oldValue: unknown; newValue: unknown };
export type PasteReport = {
  applied: number;
  skipped: { target: CellTarget; reason: string }[];
  failed: { target: CellTarget; reason: string }[];
  truncated: number;
};
export interface TableEvents<TRow extends object = Row> {
  dataChange: {
    source: string;
    changes: readonly CellChange[];
    recordChanges: readonly RecordChange<TRow>[];
    dataSource: readonly TRow[];
    revision: number;
  };
  derivedValuesChange: { values: readonly DerivedValue[]; dropped: readonly DerivedValue[] };
  summaryChange: { summary: Readonly<Record<string, Scalar>> };
  selectionChange: SelectionSnapshot;
  editStart: { target: CellTarget; committed: boolean };
  editEnd: { target: CellTarget; committed: boolean };
  validationChange: { errors: readonly ValidationError[] };
  historyChange: { canUndo: boolean; canRedo: boolean };
  pinnedRowsChange: { rows: readonly PinnedRowInfo[] };
  lockChange: { rowKeys: readonly string[] };
  loadStateChange: DataState;
  columnResize: { field: string; width: number };
  configError: Error & { path: string; code: string };
  commandExecuted: { name: string; result: CommandResult };
  mergeInvalidated: { merges: readonly ManualMerge[] };
}
export type EventName = keyof TableEvents;
export type EventMap = TableEvents;
export interface ModelInstance<TRow extends object = Row> {
  setDataSource(rows: TRow[]): void;
  replaceDataSource(rows: TRow[]): void;
  getDataSource(): readonly TRow[];
  updateFields(patches: { rowKey: string; fields: Partial<TRow> }[]): CommandResult;
  setDerivedValues(values: DerivedValue[]): void;
  getDerivedValues(): readonly DerivedValue[];
  getDerivedRows(): readonly DerivedRowView[];
  getSummary(): Readonly<Record<string, Scalar>>;
  getSubmission(): Submission<TRow>;
  updateConfig(next: TableConfig<TRow>): boolean;
  setReadonly(value: boolean): void;
  validate(): Promise<ValidationResult>;
  executeCommand(name: string, payload?: unknown): Promise<CommandResult>;
  getCommandState(name: string): { enabled: boolean; reason?: string };
  on<E extends EventName>(event: E, handler: (e: TableEvents<TRow>[E]) => void): () => void;
  getLockedRows(): string[];
  setLockedRows(rowKeys: string[]): void;
  destroy(): void;
}
export interface TableInstance<TRow extends object = Row> extends ModelInstance<TRow> {
  setTheme(theme: Theme): void;
  setDensity(density: Density): void;
  setHiddenColumns(fields: string[]): void;
  setColumnVisibility(field: string, visible: boolean): void;
  getHiddenColumns(): string[];
  setColumnWidth(field: string, width: number): void;
  scrollToRow(target: RowTarget, opts?: { select?: boolean }): void;
  scrollToCell(target: CellTarget): void;
  getSelection(): SelectionSnapshot;
  setSelection(ranges: CellRange[]): void;
  pinRow(target: RowTarget | number): boolean;
  unpinRow(target: RowTarget): boolean;
  clearPinnedRows(): void;
  getPinnedRows(): PinnedRowInfo[];
  loadData(): Promise<boolean>;
  retryLoad(): Promise<boolean>;
  getDataState(): DataState;
  /** 提交当前草稿，提交失败时保留编辑器。 */
  saveEdit(): Promise<boolean>;
  /** 同步宿主管理的加载状态。 */
  setLoadingState(state: {
    loading?: boolean;
    loadError?: unknown;
    emptyReason?: 'empty' | 'filtered';
  }): void;
  focus(): void;
}
