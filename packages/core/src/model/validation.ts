import AsyncValidator from 'async-validator';
import type {
  CellTarget,
  ColumnDef,
  DerivedValue,
  Rule,
  TableConfig,
  ValidationError,
} from '../types';
import type { Projection } from './pipeline';
import { derivedKey, errorOf, read, same, scalar, targetKey } from '../utils/immutable';
import { recordBehavior } from './capabilities';
import { dateFormat, parseDate } from '../utils/date';

export async function validateRules(
  value: unknown,
  rules: Rule[],
  field: string,
): Promise<string | null> {
  try {
    if (!rules.length) return null;
    // async-validator 的 Node CJS 与 Vite ESM 入口采用不同的默认导出包装。
    const Schema = (
      'default' in AsyncValidator ? AsyncValidator.default : AsyncValidator
    ) as typeof AsyncValidator;
    await new Schema({ [field]: rules }).validate({ [field]: value });
    return null;
  } catch (error) {
    if (
      error !== null &&
      typeof error === 'object' &&
      'errors' in error &&
      Array.isArray(error.errors)
    ) {
      const first: unknown = error.errors[0];
      if (first !== null && typeof first === 'object' && 'message' in first)
        return String(first.message);
    }
    return errorOf(error).message;
  }
}
export function normalizeValue<TRow extends object>(
  value: unknown,
  column: Pick<ColumnDef<TRow>, 'valueType' | 'editor' | 'editorProps'>,
): unknown {
  const type = column.valueType ?? (typeof column.editor === 'string' ? column.editor : 'text');
  const collection =
    column.editor === 'cascader' ||
    (column.editor === 'select' && column.editorProps?.multiple === true);
  if (collection) {
    if (column.valueType && column.valueType !== 'string')
      throw new Error('多选和级联编辑器不能配置标量 valueType');
    if (value === '' || value === null || value === undefined) return [];
    let values: unknown = value;
    if (typeof value === 'string') {
      try {
        values = JSON.parse(value);
      } catch (error) {
        throw new Error('多选和级联值请使用 JSON 数组，例如 ["a","b"]', { cause: error });
      }
    }
    if (!Array.isArray(values) || !values.every(scalar))
      throw new Error('多选和级联值必须是由标量组成的 JSON 数组');
    return values;
  }
  if (value === '' || value === undefined || value === null)
    return type === 'number' ? null : (value ?? '');
  if (type === 'number') {
    const number =
      typeof value === 'string' ? Number(value.replace(/[,，\s]/g, '')) : Number(value);
    if (!Number.isFinite(number)) throw new Error('请输入有效数字');
    const props = column.editorProps ?? {};
    if (typeof props.min === 'number' && number < props.min)
      throw new Error(`数值不能小于 ${props.min}`);
    if (typeof props.max === 'number' && number > props.max)
      throw new Error(`数值不能大于 ${props.max}`);
    return typeof props.precision === 'number'
      ? Number(number.toFixed(Math.max(0, Math.min(15, props.precision))))
      : number;
  }
  if (type === 'boolean') {
    if (value === true || value === 'true' || value === 1 || value === '1') return true;
    if (value === false || value === 'false' || value === 0 || value === '0') return false;
    throw new Error('请输入 true 或 false');
  }
  if (type === 'date') {
    const text = String(value),
      format = dateFormat(column.editorProps);
    if (!parseDate(text, format)) throw new Error(`请输入有效日期 ${format}`);
    return text;
  }
  return value;
}
export async function validateCell<TRow extends object>(
  state: Projection<TRow>,
  config: TableConfig<TRow>,
  target: CellTarget,
  value?: unknown,
): Promise<string | null> {
  try {
    if (target.kind === 'derived') {
      const cell = Object.values(
        config.derivedRows?.find((rule) => rule.id === target.ruleKey)?.cells ?? {},
      ).find((item) => item.type === 'input' && item.field === target.field);
      if (cell?.type !== 'input') return null;
      const stored = state.values.find(
        (item: DerivedValue) => derivedKey(item) === derivedKey(target),
      );
      return await validateRules(
        value === undefined ? (stored ? stored.value : (cell.default ?? null)) : value,
        cell.rules ?? [],
        target.field,
      );
    }
    const row = state.entries[state.indices.get(target.rowKey) ?? -1]?.row;
    const column = config.columns.find((col) => col.field === target.field);
    if (!row || !column || !recordBehavior(config, row, column, 'validatable')) return null;
    const actual = value === undefined ? read(row, target.field) : value;
    const rules =
      typeof column.rules === 'function' ? column.rules(actual, row) : (column.rules ?? []);
    const message = await validateRules(actual, rules, target.field);
    if (message) return message;
    const dedup = column.deduplication;
    if (
      dedup &&
      actual !== null &&
      actual !== undefined &&
      actual !== '' &&
      (dedup.when?.(row) ?? true)
    ) {
      const index = state.indices.get(target.rowKey) ?? -1;
      const group = state.tree.nodes.find(
        (g) => g.key === dedup.scope && index >= g.start && index <= g.end,
      );
      const duplicate = state.entries.some((entry, other) => {
        if (other === index || !(dedup.when?.(entry.row) ?? true)) return false;
        if (dedup.scope && dedup.scope !== 'table' && group) {
          const inside = other >= group.start && other <= group.end;
          if (dedup.excludeCurrentGroup ? inside : !inside) return false;
        }
        return same(read(entry.row, target.field), actual);
      });
      if (duplicate) return dedup.message ?? `${column.title}不能重复`;
    }
    return null;
  } catch (error) {
    return errorOf(error).message;
  }
}
export async function validateProjection<TRow extends object>(
  state: Projection<TRow>,
  config: TableConfig<TRow>,
  covered: Set<string> = new Set(),
): Promise<ValidationError[]> {
  try {
    const targets: CellTarget[] = [];
    for (const entry of state.entries)
      for (const column of config.columns)
        if (
          (column.rules || column.deduplication) &&
          !covered.has(targetKey({ kind: 'record', rowKey: entry.key, field: column.field }))
        )
          targets.push({ kind: 'record', rowKey: entry.key, field: column.field });
    for (const row of state.results)
      for (const cell of Object.values(
        config.derivedRows?.find((rule) => rule.id === row.ruleKey)?.cells ?? {},
      ))
        if (
          cell.type === 'input' &&
          !covered.has(
            targetKey({
              kind: 'derived',
              ruleKey: row.ruleKey,
              groupKey: row.groupKey,
              field: cell.field,
            }),
          )
        )
          targets.push({
            kind: 'derived',
            ruleKey: row.ruleKey,
            groupKey: row.groupKey,
            field: cell.field,
          });
    const errors: ValidationError[] = [];
    // 分批执行，避免十万行校验同时建立十万个 Promise。
    for (let i = 0; i < targets.length; i += 100) {
      const batch = await Promise.all(
        targets.slice(i, i + 100).map(async (target) => {
          try {
            const message = await validateCell(state, config, target);
            return message ? { target, message } : null;
          } catch (error) {
            return { target, message: errorOf(error).message };
          }
        }),
      );
      for (const result of batch) if (result) errors.push(result);
    }
    const global = config.validateDerivedValues?.(state.values, config.context);
    if (global) errors.push({ message: global });
    return errors;
  } catch (error) {
    return [{ message: errorOf(error).message }];
  }
}
