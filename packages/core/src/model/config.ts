import type { CalculationRule, CellStyle, Row, TableConfig } from '../types';
import { own } from '../utils/immutable';
export class TableConfigError extends Error {
  override name = 'TableConfigError';
  constructor(
    public path: string,
    public code: string,
    message: string,
  ) {
    super(`${path}: ${message}`);
  }
}
export class CalculationError extends Error {
  override name = 'CalculationError';
  constructor(
    public ruleId: string,
    public rowKey: string,
    message: string,
    public code = 'calc-error',
  ) {
    super(message);
  }
}
function fail(path: string, code: string, message: string): never {
  throw new TableConfigError(path, code, message);
}
function unique(values: string[], path: string): void {
  const found = new Set<string>();
  for (const value of values) {
    if (!value || found.has(value)) fail(path, 'duplicate-id', `标识为空或重复：${value}`);
    found.add(value);
  }
}
const allowedStyle =
  /^(color|backgroundColor|background|fontFamily|fontSize|fontWeight|fontStyle|lineHeight|textDecoration|textAlign|whiteSpace|wordBreak|overflowWrap|padding|paddingTop|paddingBottom|paddingLeft|paddingRight|--(?!edit-table-)[\w-]+)$/;
export function validateStyle(style: CellStyle | undefined, path: string): void {
  for (const key of Object.keys(style ?? {}))
    if (!allowedStyle.test(key)) fail(path, 'invalid-style', `不允许修改布局属性 ${key}`);
}
export function validateClass(value: string | undefined, path: string): void {
  if (value?.split(/\s+/).some((name) => name.startsWith('et-') || name === 'edit-table'))
    fail(path, 'reserved-class', '不可使用组件保留类名');
}
/** 从声明的读取和输出推导拓扑，确保每个计算字段只有一个写入者。 */
export function sortCalculations<TRow extends object>(
  rules: CalculationRule<TRow>[],
): CalculationRule<TRow>[] {
  unique(
    rules.map((rule) => rule.id),
    'calculations',
  );
  const writer = new Map<string, CalculationRule<TRow>>();
  for (const rule of rules)
    for (const field of rule.writes) {
      if (writer.has(field)) fail('calculations', 'duplicate-writer', `${field} 被多条规则写入`);
      writer.set(field, rule);
    }
  const visited = new Set<string>(),
    visiting = new Set<string>(),
    ordered: CalculationRule<TRow>[] = [];
  function visit(rule: CalculationRule<TRow>): void {
    if (visited.has(rule.id)) return;
    if (visiting.has(rule.id)) fail('calculations', 'cyclic-dependency', `循环依赖：${rule.id}`);
    visiting.add(rule.id);
    for (const field of rule.reads) {
      const dependency = writer.get(field);
      if (dependency) visit(dependency);
    }
    visiting.delete(rule.id);
    visited.add(rule.id);
    ordered.push(rule);
  }
  for (const rule of rules) visit(rule);
  return ordered;
}
export function normalizeConfig<TRow extends object = Row>(
  input: TableConfig<TRow>,
): TableConfig<TRow> {
  const allowed = new Set([
    'columns',
    'readonly',
    'rowNumbers',
    'striped',
    'rowPinning',
    'pinnedDiff',
    'virtualization',
    'rowHeight',
    'rowRules',
    'groups',
    'merges',
    'manualMerge',
    'fieldTransitions',
    'operations',
    'calculations',
    'derivedRows',
    'validateDerivedValues',
    'summary',
    'context',
    'locale',
    'editorOptions',
  ]);
  for (const key of Object.keys(input))
    if (!allowed.has(key)) fail(key, 'unsupported-option', `不支持配置项 ${key}`);
  if (!Array.isArray(input.columns) || !input.columns.length)
    fail('columns', 'required', '至少配置一列');
  unique(
    input.columns.map((col) => col.field),
    'columns.field',
  );
  unique(
    input.columns.map((col) => col.key ?? col.field),
    'columns.key',
  );
  const fields = new Set(input.columns.map((col) => col.field)),
    keys = input.columns.map((col) => col.key ?? col.field);
  const reference = (field: string, path: string): void => {
    if (!fields.has(field) && !keys.includes(field))
      fail(path, 'unknown-reference', `未知列：${field}`);
  };
  for (const [i, col] of input.columns.entries()) {
    const props = {
      ...(typeof col.editor === 'string' ? input.editorOptions?.[col.editor] : {}),
      ...col.editorProps,
    };
    if (
      (col.editor === 'cascader' || (col.editor === 'select' && props.multiple === true)) &&
      col.valueType &&
      col.valueType !== 'string'
    )
      fail(
        `columns[${i}].valueType`,
        'incompatible-editor',
        '多选和级联编辑器不能配置标量 valueType',
      );
    if (
      (col.width ?? 140) <= 0 ||
      (col.minWidth ?? 40) <= 0 ||
      (col.maxWidth ?? Infinity) < (col.minWidth ?? 40)
    )
      fail(`columns[${i}]`, 'invalid-width', '列宽必须为正数且最大值不小于最小值');
    if (typeof col.cellStyle === 'object') validateStyle(col.cellStyle, `columns[${i}].cellStyle`);
    if (typeof col.cellClassName === 'string')
      validateClass(col.cellClassName, `columns[${i}].cellClassName`);
  }
  const groups = input.groups ?? [];
  unique(
    groups.map((g) => g.key),
    'groups',
  );
  for (const group of groups) {
    if (!group.fields.length) fail('groups', 'required', '分组至少有一个字段');
    for (const field of group.fields) reference(field, `groups.${group.key}`);
  }
  const groupKeys = new Set(groups.map((g) => g.key));
  const groupRef = (key: string, path: string): void => {
    if (!groupKeys.has(key)) fail(path, 'unknown-reference', `未知分组：${key}`);
  };
  for (const merge of input.merges?.vertical ?? []) {
    reference(merge.column, 'merges.vertical.column');
    groupRef(merge.by, 'merges.vertical.by');
  }
  unique(
    (input.merges?.vertical ?? []).map((m) => m.column),
    'merges.vertical',
  );
  const ordered = sortCalculations(input.calculations ?? []);
  for (const rule of ordered) {
    if (rule.scope !== 'row') groupRef(rule.scope.group, `calculations.${rule.id}.scope`);
    for (const field of [...rule.reads, ...rule.writes])
      reference(field, `calculations.${rule.id}`);
  }
  unique(
    (input.fieldTransitions ?? []).map((r) => r.id),
    'fieldTransitions',
  );
  for (const column of input.columns) {
    const scope = column.deduplication?.scope;
    if (scope && scope !== 'table') groupRef(scope, `columns.${column.field}.deduplication.scope`);
  }
  for (const transition of input.fieldTransitions ?? [])
    reference(transition.trigger.field, `fieldTransitions.${transition.id}`);
  unique(
    (input.derivedRows ?? []).map((r) => r.id),
    'derivedRows',
  );
  for (const rule of input.derivedRows ?? []) {
    if (rule.level !== 'table') groupRef(rule.level, `derivedRows.${rule.id}.level`);
    reference(rule.labelColumn, `derivedRows.${rule.id}.labelColumn`);
    for (const [field, cell] of Object.entries(rule.cells)) {
      reference(field, `derivedRows.${rule.id}.cells`);
      if (cell.type === 'input') {
        const column = input.columns.find((item) => item.field === field)!;
        const editor = cell.editor ?? 'text';
        const props = { ...input.editorOptions?.[editor], ...column.editorProps };
        if (editor === 'cascader' || (editor === 'select' && props.multiple === true))
          fail(
            `derivedRows.${rule.id}.cells.${field}`,
            'incompatible-editor',
            '派生输入只支持标量，请使用单选或文本编辑器',
          );
      }
      if (cell.type === 'aggregate' && cell.of)
        reference(cell.of, `derivedRows.${rule.id}.cells.${field}.of`);
    }
  }
  unique(
    (input.rowRules ?? []).map((r) => r.id),
    'rowRules',
  );
  for (const rule of input.rowRules ?? []) {
    const occupied = new Set<number>();
    for (const cell of rule.layout.cells) {
      const from = keys.indexOf(cell.column ?? cell.range?.from ?? ''),
        until = cell.column
          ? from + 1
          : cell.range?.until
            ? keys.indexOf(cell.range.until)
            : keys.length;
      if (from < 0 || until <= from) fail(`rowRules.${rule.id}`, 'invalid-range', '布局范围无效');
      if (cell.field) reference(cell.field, `rowRules.${rule.id}.field`);
      if (
        new Set(input.columns.slice(from, until).map((column) => column.fixed ?? 'center')).size > 1
      )
        fail(`rowRules.${rule.id}`, 'crossing-layout', '布局不能跨越固定列分区');
      if (cell.content && cell.render)
        fail(`rowRules.${rule.id}`, 'conflicting-content', 'content 和 render 互斥');
      for (let i = from; i < until; i++) {
        if (occupied.has(i)) fail(`rowRules.${rule.id}`, 'crossing-layout', '布局范围相交');
        occupied.add(i);
      }
      validateStyle(cell.cellStyle, `rowRules.${rule.id}.cellStyle`);
      validateClass(cell.cellClassName, `rowRules.${rule.id}.cellClassName`);
    }
  }
  for (const merge of input.merges?.horizontal ?? []) {
    if (
      !(input.rowRules ?? []).some((r) => r.id === merge.rule) &&
      !(input.derivedRows ?? []).some((r) => r.id === merge.rule)
    )
      fail('merges.horizontal.rule', 'unknown-reference', `未知布局规则 ${merge.rule}`);
    reference(merge.from, 'merges.horizontal.from');
    if (merge.until) reference(merge.until, 'merges.horizontal.until');
  }
  for (const rule of input.manualMerge?.rules ?? []) reference(rule.column, 'manualMerge.rules');
  unique(
    (input.summary?.items ?? []).map((item) => item.key),
    'summary.items',
  );
  if (
    typeof input.rowPinning === 'object' &&
    (!Number.isInteger(input.rowPinning.maxRows ?? 1) || (input.rowPinning.maxRows ?? 1) < 1)
  )
    fail('rowPinning.maxRows', 'invalid-value', '必须为正整数');
  if (typeof input.rowHeight === 'number' && input.rowHeight < 20)
    fail('rowHeight', 'invalid-value', '行高不能小于 20');
  return own({
    ...input,
    columns: input.columns.map((col) => ({
      ...col,
      key: col.key ?? col.field,
      width: Math.round(
        Math.max(col.minWidth ?? 40, Math.min(col.maxWidth ?? 2000, col.width ?? 140)),
      ),
    })),
    calculations: ordered,
  });
}
