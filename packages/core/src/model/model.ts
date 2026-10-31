import type {
  CellChange,
  RecordChange,
  CellTarget,
  CommandResult,
  CreateModelOptions,
  DerivedValue,
  ManualMerge,
  ModelInstance,
  Row,
  RowTarget,
  TableConfig,
  ValidationError,
  ValidationResult,
} from '../types';
import { createEventBus } from '../commands/events';
import { createEpoch } from '../utils/epoch';
import {
  clone,
  derivedKey,
  errorOf,
  freeze,
  freezeContainer,
  own,
  read,
  record,
  same,
  scalar,
  mergeTargets,
  rowTargetKey,
  targetKey,
} from '../utils/immutable';
import { normalizeConfig, TableConfigError } from './config';
import { project, tableGroup, type Entry, type Projection } from './pipeline';
import { normalizeValue, validateCell, validateProjection } from './validation';
import { createView, type ViewModel } from '../view/view';
import type { SourceSplice } from './splice';

export type CellWrite = { target: CellTarget; value: unknown };
export interface ModelController<TRow extends object> {
  api: ModelInstance<TRow>;
  getState: () => Projection<TRow>;
  getConfig: () => TableConfig<TRow>;
  getMerges: () => readonly ManualMerge[];
  getErrors: () => readonly ValidationError[];
  getPending: () => ReadonlySet<string>;
  getLocked: () => ReadonlySet<string>;
  write: (writes: CellWrite[], source: string, epoch?: number) => Promise<CommandResult>;
  canWrite: (target: CellTarget) => boolean;
  invalidate: () => number;
  epoch: ReturnType<typeof createEpoch>;
  bus: ReturnType<typeof createEventBus<TRow>>;
  subscribe: (handler: () => void) => () => void;
  destroyed: () => boolean;
  handleCommand: (name: string, payload: unknown) => Promise<CommandResult>;
}
type History<TRow extends object> = { state: Projection<TRow>; merges: readonly ManualMerge[] };
const success = (data?: unknown): CommandResult => ({
  ok: true,
  ...(data === undefined ? {} : { data }),
});
const failure = (code: string, message: string): CommandResult => ({ ok: false, code, message });

/** 每实例独立状态；所有投影成功后才替换当前快照并派发事件。 */
export function createController<TRow extends object = Row>(
  options: CreateModelOptions<TRow>,
): ModelController<TRow> {
  let config = normalizeConfig(options.config),
    serial = 0,
    revision = 0,
    dead = false;
  const report = (error: Error): void => {
    if (options.onError) {
      try {
        options.onError(error);
      } catch (nested) {
        console.error('EditTable onError 处理失败', nested);
      }
    } else console.error('EditTable', error);
  };
  const bus = createEventBus<TRow>(report),
    epoch = createEpoch(),
    listeners = new Set<() => void>();
  let errors: readonly ValidationError[] = [],
    locked = new Set<string>(),
    merges: readonly ManualMerge[] = [];
  let validationSerial = 0,
    pendingValidation: ReadonlySet<string> = new Set();
  let past: History<TRow>[] = [],
    future: History<TRow>[] = [],
    queue = Promise.resolve<CommandResult>(success());
  const keyOf = (row: TRow): string => {
    const key =
      typeof options.rowKey === 'function'
        ? options.rowKey(row)
        : options.rowKey
          ? read(row, options.rowKey)
          : undefined;
    return key === undefined ? `et-${++serial}` : String(key);
  };
  function entriesOf(rows: readonly TRow[]): Entry<TRow>[] {
    const found = new Set<string>();
    return rows.map((row) => {
      const key = keyOf(row);
      if (found.has(key))
        throw new TableConfigError('dataSource.rowKey', 'duplicate-id', `重复行标识：${key}`);
      found.add(key);
      return { key, row: own(row) };
    });
  }
  let state = project(
    entriesOf(options.dataSource ?? []),
    own(options.derivedValues ?? []),
    config,
  );
  function notify(): void {
    for (const listener of listeners) {
      try {
        listener();
      } catch (error) {
        report(errorOf(error));
      }
    }
  }
  function historyChanged(): void {
    bus.emit('historyChange', { canUndo: past.length > 0, canRedo: future.length > 0 });
  }
  function live(): CommandResult | null {
    return dead ? failure('destroyed', '表格已销毁') : null;
  }
  function canWrite(target: CellTarget): boolean {
    if (dead || config.readonly) return false;
    if (
      merges.some((merge) =>
        mergeTargets(merge)
          .slice(1)
          .some((row) => targetKey(mergedCell(merge, row)) === targetKey(target)),
      )
    )
      return false;
    if (target.kind === 'derived') {
      const rule = config.derivedRows?.find((r) => r.id === target.ruleKey),
        cell = Object.values(rule?.cells ?? {}).find(
          (c) => c.type === 'input' && c.field === target.field,
        );
      const result = state.results.find(
        (r) => r.ruleKey === target.ruleKey && r.groupKey === target.groupKey,
      );
      if (cell?.type !== 'input' || !result) return false;
      const group =
        state.tree.nodes.find((g) => g.key === rule?.level && g.id === target.groupKey) ??
        tableGroup(state.entries.length);
      return typeof cell.editable === 'function'
        ? cell.editable({
            group,
            rows: state.rows.slice(group.start, group.end + 1),
            inputs: result.values,
            results: state.results,
            context: config.context,
          })
        : cell.editable !== false;
    }
    if (locked.has(target.rowKey)) return false;
    const entry = state.entries[state.indices.get(target.rowKey) ?? -1],
      column = config.columns.find((c) => c.field === target.field);
    if (
      !entry ||
      !column ||
      config.calculations?.some((rule) => rule.writes.includes(target.field))
    )
      return false;
    const layout = config.rowRules?.find((rule) =>
      same(read(entry.row, rule.match.field), rule.match.equals),
    )?.layout;
    if (layout) {
      const binding = layout.cells.find(
        (cell) =>
          cell.field === target.field ||
          (!cell.field &&
            cell.column === (column.key ?? column.field) &&
            !cell.content &&
            !cell.render),
      );
      if (!binding) return false;
      if (binding.behaviors?.editable !== undefined) return binding.behaviors.editable;
    }
    return typeof column.editable === 'function'
      ? column.editable(entry.row, state.rows)
      : column.editable === true;
  }
  function mergedCell(merge: ManualMerge, target: RowTarget): CellTarget {
    const cell =
      target.kind === 'derived'
        ? config.derivedRows?.find((rule) => rule.id === target.ruleKey)?.cells[merge.field]
        : undefined;
    return { ...target, field: cell?.type === 'input' ? cell.field : merge.field };
  }
  function validMerge(
    merge: ManualMerge,
    view: ViewModel<TRow> = createView(state, config, new Set(), new Map(), 40, []),
  ): boolean {
    const rule = config.manualMerge?.rules.find(
      (item) =>
        item.column === merge.field ||
        config.columns.find((column) => column.field === merge.field)?.key === item.column,
    );
    if (!rule) return false;
    const targets = mergeTargets(merge),
      col = view.columns.findIndex((column) => column.field === merge.field);
    return (
      col >= 0 &&
      targets.length >= 2 &&
      targets.every((target, i) => {
        const position = view.targetView(target);
        if (position < 0 || (rule.rowKinds && !rule.rowKinds.includes(target.kind))) return false;
        if (i > 0 && position !== view.targetView(targets[i - 1]!) + 1) return false;
        const row = view.rows[position]!,
          span = view.spanOf({ row: position, col });
        if (
          span &&
          (span.kind !== 'layout' ||
            span.colSpan !== 1 ||
            span.layout?.content ||
            span.layout?.render ||
            (span.field && span.field !== merge.field))
        )
          return false;
        if ((span?.layout?.behaviors?.mergeable ?? view.columns[col]!.mergeable) === false)
          return false;
        if (row.kind === 'record' && row.layout && !span?.layout) return false;
        return true;
      })
    );
  }
  function commit(
    next: Projection<TRow>,
    source: string,
    changes: CellChange[],
    nextMerges = merges,
    history = true,
    emitData = true,
  ): void {
    if (next === state && same(nextMerges, merges)) return;
    const before = state;
    if (history) {
      past.push({ state, merges });
      if (past.length > (options.historyLimit ?? 100)) past.shift();
      future = [];
    }
    state = next;
    merges = nextMerges;
    revision++;
    epoch.bump();
    validationSerial++;
    pendingValidation = new Set();
    const hadErrors = errors.length > 0;
    errors = [];
    if (before.tree !== state.tree)
      locked = new Set([...locked].filter((key) => state.indices.has(key)));
    const mergeView = merges.length
      ? createView(state, config, new Set(), new Map(), 40, [])
      : undefined;
    const invalid = merges.filter((merge) => !validMerge(merge, mergeView));
    if (invalid.length) {
      merges = merges.filter((merge) => !invalid.includes(merge));
      bus.emit('mergeInvalidated', { merges: invalid });
    }
    // 先更新视图，让所有业务监听拿到与快照一致的界面。
    notify();
    if (hadErrors) bus.emit('validationChange', { errors });
    if (
      emitData &&
      bus.has('dataChange') &&
      (before.entries !== state.entries ||
        changes.some((change) => change.target.kind === 'record'))
    ) {
      // 普通编辑按已知变更取记录；结构操作与历史恢复才比较完整身份集合。
      const keys = changes.length
        ? new Set(
            changes.flatMap((change) =>
              change.target.kind === 'record' ? [change.target.rowKey] : [],
            ),
          )
        : new Set([...before.indices.keys(), ...state.indices.keys()]);
      const recordChanges: RecordChange<TRow>[] = [];
      const cellChanges = changes.length ? changes : [];
      for (const rowKey of keys) {
        const beforeIndex = before.indices.get(rowKey),
          afterIndex = state.indices.get(rowKey);
        const oldRow = beforeIndex === undefined ? undefined : before.entries[beforeIndex]?.row;
        const newRow = afterIndex === undefined ? undefined : state.entries[afterIndex]?.row;
        if (oldRow === newRow && beforeIndex === afterIndex) continue;
        recordChanges.push({ rowKey, before: oldRow, after: newRow, beforeIndex, afterIndex });
        if (!changes.length && oldRow !== newRow)
          for (const field of new Set([
            ...Object.keys(oldRow ?? {}),
            ...Object.keys(newRow ?? {}),
          ])) {
            const oldValue = oldRow ? read(oldRow, field) : undefined,
              newValue = newRow ? read(newRow, field) : undefined;
            if (!same(oldValue, newValue))
              cellChanges.push({ target: { kind: 'record', rowKey, field }, oldValue, newValue });
          }
      }
      bus.emit('dataChange', {
        source,
        changes: cellChanges,
        recordChanges,
        dataSource: state.rows,
        revision,
      });
    }
    if (!same(before.values, state.values))
      bus.emit('derivedValuesChange', {
        values: state.values,
        dropped: before.values.filter(
          (v) =>
            !state.values.some((n) => derivedKey(n) === derivedKey(v)) &&
            !state.results.some((r) => r.ruleKey === v.ruleKey && r.groupKey === v.groupKey),
        ),
      });
    if (!same(before.summary, state.summary)) bus.emit('summaryChange', { summary: state.summary });
    historyChanged();
  }
  function apply(
    writes: CellWrite[],
    source: string,
    appliedChanges?: CellChange[],
  ): CommandResult {
    const inactive = live();
    if (inactive) return inactive;
    if (config.readonly) return failure('readonly', '表格为只读模式');
    try {
      let entries: readonly Entry<TRow>[] = state.entries;
      const pending = new Map<string, DerivedValue>(state.values.map((v) => [derivedKey(v), v]));
      const changed = new Map<string, Set<string>>(),
        changes: CellChange[] = [];
      const user = ['edit', 'paste', 'clear', 'cut'].includes(source);
      const byKey = state.indices;
      // 同一合并格只展开一次；冲突值整体拒绝，避免末值覆盖和平方级写入。
      const unique = new Map<string, CellWrite>();
      const renamed = new Map<string, { write: CellWrite; start: number; end: number }>();
      const groupLists = new Map<string, typeof state.tree.nodes>();
      for (const group of state.tree.nodes) {
        const list = groupLists.get(group.key) ?? [];
        list.push(group);
        groupLists.set(group.key, list);
      }
      for (const write of writes) {
        const target = write.target;
        const merge =
          user && target.kind === 'record'
            ? config.merges?.vertical?.find(
                (item) =>
                  item.column === target.field ||
                  config.columns.some(
                    (column) => column.field === target.field && column.key === item.column,
                  ),
              )
            : undefined;
        const rule = config.groups?.find((item) => item.key === merge?.by);
        const index = target.kind === 'record' ? byKey.get(target.rowKey) : undefined;
        const groups = rule ? (groupLists.get(rule.key) ?? []) : [];
        let low = 0,
          high = groups.length;
        while (low < high) {
          const mid = (low + high) >>> 1;
          if (groups[mid]!.end < (index ?? -1)) low = mid + 1;
          else high = mid;
        }
        const group = index === undefined ? undefined : groups[low];
        const rename =
          group &&
          index !== undefined &&
          group.start <= index &&
          rule?.renameFields?.includes(target.field);
        const key = rename
          ? JSON.stringify([group.key, group.id, target.field])
          : targetKey(target);
        const previous = rename ? renamed.get(key)?.write : unique.get(key);
        if (user && previous && !same(previous.value, write.value))
          return failure(
            'conflicting-values',
            '同一单元格或分组合并区域不能粘贴不同值，请分别编辑或通过 updateFields 拆分分组',
          );
        if (rename) renamed.set(key, { write, start: group.start, end: group.end });
        else unique.set(key, write);
      }
      for (const { write, start, end } of renamed.values())
        for (let index = start; index <= end; index++) {
          const target = {
            kind: 'record',
            rowKey: state.entries[index]!.key,
            field: write.target.field,
          } satisfies CellTarget;
          unique.set(targetKey(target), { target, value: write.value });
        }
      const expanded = [...unique.values()];
      for (const write of expanded) {
        if (!canWrite(write.target)) return failure('readonly', '目标单元格不可编辑');
        const target = write.target;
        if (target.kind === 'derived') {
          if (!scalar(write.value)) throw new Error('独立输入只能是有限标量');
          const saved = pending.get(derivedKey(target));
          const cell = Object.values(
            config.derivedRows?.find((rule) => rule.id === target.ruleKey)?.cells ?? {},
          ).find((item) => item.type === 'input' && item.field === target.field);
          const oldValue = saved
            ? saved.value
            : cell?.type === 'input'
              ? (cell.default ?? null)
              : null;
          pending.set(derivedKey(target), {
            ruleKey: target.ruleKey,
            groupKey: target.groupKey,
            field: target.field,
            value: write.value,
          });
          if (!same(oldValue, write.value))
            changes.push({ target, oldValue, newValue: write.value });
          continue;
        }
        const index = byKey.get(target.rowKey);
        if (index === undefined) return failure('invalid-target', '目标行不存在');
        const original = entries[index]!,
          column = config.columns.find((c) => c.field === target.field)!;
        const resolvedColumn =
          typeof column.editor === 'function'
            ? { ...column, editor: column.editor(original.row, target.field) }
            : column;
        const editor =
          typeof resolvedColumn.editor === 'string'
            ? resolvedColumn.editor
            : resolvedColumn.valueType === 'date'
              ? 'date'
              : resolvedColumn.valueType === 'number'
                ? 'number'
                : 'text';
        const value = normalizeValue(write.value, {
            ...resolvedColumn,
            editorProps: { ...config.editorOptions?.[editor], ...resolvedColumn.editorProps },
          }),
          oldValue = read(original.row, target.field);
        if (same(oldValue, value)) continue;
        const fields: Record<string, unknown> = { [target.field]: value };
        if (user) {
          const transitions = [{ field: target.field, oldValue, newValue: value }];
          const seen = new Set<string>();
          for (let i = 0; i < transitions.length; i++) {
            if (i >= 32) throw new Error('字段联动超过最大深度 32，可能存在循环');
            const transition = transitions[i]!;
            const signature = JSON.stringify([transition.field, transition.newValue]);
            if (seen.has(signature)) throw new Error('字段联动存在循环');
            seen.add(signature);
            for (const rule of config.fieldTransitions ?? [])
              if (rule.trigger.field === transition.field) {
                const output = rule.apply({
                  row: own({ ...original.row, ...fields }),
                  oldValue: transition.oldValue,
                  newValue: transition.newValue,
                });
                if (output && typeof Reflect.get(output, 'then') === 'function')
                  throw new Error('字段联动必须同步返回');
                for (const [field, nextValue] of Object.entries(output ?? {})) {
                  if (!config.columns.some((col) => col.field === field))
                    throw new Error(`联动返回未知字段 ${field}`);
                  const before = field in fields ? fields[field] : read(original.row, field);
                  if (!same(before, nextValue)) {
                    fields[field] = nextValue;
                    transitions.push({ field, oldValue: before, newValue: nextValue });
                  }
                }
              }
          }
        }
        if (entries === state.entries) entries = state.entries.slice();
        const mutable = entries as Entry<TRow>[];
        mutable[index] = {
          key: original.key,
          row: freezeContainer({ ...original.row, ...own(fields) }),
        };
        const dirty = changed.get(original.key) ?? new Set<string>();
        for (const [field, newValue] of Object.entries(fields)) {
          dirty.add(field);
          changes.push({
            target: { kind: 'record', rowKey: original.key, field },
            oldValue: read(original.row, field),
            newValue,
          });
        }
        changed.set(original.key, dirty);
      }
      if (!changes.length) return success();
      const next = project(entries, [...pending.values()], config, changed, state);
      const global = config.validateDerivedValues?.(next.values, config.context);
      if (global) return failure('validation', global);
      for (const key of next.changedKeys) {
        const entry = next.entries[next.indices.get(key) ?? -1];
        if (!entry) continue;
        const old = state.entries[byKey.get(entry.key) ?? -1];
        if (old?.row !== entry.row)
          for (const rule of config.calculations ?? [])
            for (const field of rule.writes) {
              const oldValue = old ? read(old.row, field) : undefined,
                newValue = read(entry.row, field);
              if (!same(oldValue, newValue))
                changes.push({
                  target: { kind: 'record', rowKey: entry.key, field },
                  oldValue,
                  newValue,
                });
            }
      }
      if (appliedChanges) for (const change of changes) appliedChanges.push(change);
      commit(next, source, changes);
      return success();
    } catch (error) {
      return failure(
        error instanceof Error && error.name === 'CalculationError' ? 'calc-error' : 'rejected',
        errorOf(error).message,
      );
    }
  }
  async function write(
    writes: CellWrite[],
    source: string,
    expected = epoch.current(),
  ): Promise<CommandResult> {
    let validationId = -1;
    try {
      for (const item of writes)
        if (item.target.kind === 'derived') {
          const error = await validateCell(state, config, item.target, item.value);
          if (!epoch.valid(expected) || dead)
            return failure(dead ? 'destroyed' : 'stale', '编辑结果已过期');
          if (error) return failure('validation', error);
        }
      if (!epoch.valid(expected)) return failure('stale', '编辑结果已过期');
      const previousErrors = errors;
      const previousState = state;
      const actualChanges: CellChange[] = [];
      const result = apply(writes, source, actualChanges);
      if (result.ok) {
        const validationEpoch = epoch.current();
        validationId = ++validationSerial;
        const targets = new Map(
          [...writes, ...actualChanges].map((item) => [targetKey(item.target), item.target]),
        );
        const changedRows = new Set(
          actualChanges.flatMap((item) =>
            item.target.kind === 'record' ? [item.target.rowKey] : [],
          ),
        );
        // 去重的 when/scope 和动态规则可依赖其他字段，不能只校验直接写入目标。
        for (const column of config.columns) {
          const changedEntries = [...changedRows].flatMap((key) => {
            const entry = state.entries[state.indices.get(key) ?? -1];
            return entry ? [entry] : [];
          });
          const affectedValues = column.deduplication
            ? [...changedRows]
                .flatMap((key) => {
                  const old = previousState.entries[previousState.indices.get(key) ?? -1];
                  const next = state.entries[state.indices.get(key) ?? -1];
                  return [
                    old ? read(old.row, column.field) : undefined,
                    next ? read(next.row, column.field) : undefined,
                  ];
                })
                .filter((value) => value !== undefined && value !== null && value !== '')
            : [];
          const rows =
            column.deduplication && changedRows.size
              ? state.entries.filter(
                  (entry) =>
                    changedRows.has(entry.key) ||
                    affectedValues.some((value) => same(value, read(entry.row, column.field))),
                )
              : typeof column.rules === 'function'
                ? changedEntries
                : [];
          for (const entry of rows) {
            const target = {
              kind: 'record',
              rowKey: entry.key,
              field: column.field,
            } satisfies CellTarget;
            targets.set(targetKey(target), target);
          }
        }
        const covered = new Set(
          merges.flatMap((merge) =>
            mergeTargets(merge)
              .slice(1)
              .map((target) => targetKey(mergedCell(merge, target))),
          ),
        );
        for (const key of covered) targets.delete(key);
        const touched = new Set(targets.keys());
        pendingValidation = touched;
        notify();
        const nextErrors: ValidationError[] = [];
        for (const target of targets.values()) {
          const message = await validateCell(state, config, target);
          if (!epoch.valid(validationEpoch) || validationId !== validationSerial || dead) break;
          if (message) nextErrors.push({ target, message });
        }
        if (epoch.valid(validationEpoch) && validationId === validationSerial && !dead) {
          errors = freeze([
            ...previousErrors.filter((error) => {
              const target = error.target;
              return (
                target &&
                !touched.has(targetKey(target)) &&
                (target.kind === 'record'
                  ? state.indices.has(target.rowKey)
                  : state.results.some(
                      (row) => row.ruleKey === target.ruleKey && row.groupKey === target.groupKey,
                    ))
              );
            }),
            ...nextErrors,
          ]);
          bus.emit('validationChange', { errors });
          notify();
        }
      }
      return result;
    } catch (error) {
      return failure('rejected', errorOf(error).message);
    } finally {
      if (validationId === validationSerial) {
        pendingValidation = new Set();
        notify();
      }
    }
  }
  function replace(rows: TRow[], business: boolean): void {
    if (dead) return;
    try {
      const next = project(entriesOf(rows), state.values, config);
      past = [];
      future = [];
      commit(next, 'replace', [], [], false, business);
    } catch (error) {
      report(errorOf(error));
    }
  }
  async function handleCommand(name: string, payload: unknown): Promise<CommandResult> {
    try {
      const inactive = live();
      if (inactive) return inactive;
      const data = record(payload) ? payload : {};
      if (name === 'undo' || name === 'redo') {
        if (config.readonly) return failure('readonly', '表格为只读模式');
        const from = name === 'undo' ? past : future,
          to = name === 'undo' ? future : past,
          frame = from.pop();
        if (!frame) return failure('rejected', '没有可用历史');
        to.push({ state, merges });
        commit(frame.state, name, [], frame.merges, false);
        return success();
      }
      if (name === 'validate') return success(await api.validate());
      if (name === 'setDerivedValue') {
        if (
          typeof data.ruleKey !== 'string' ||
          typeof data.groupKey !== 'string' ||
          typeof data.field !== 'string'
        )
          return failure('invalid-target', '请指定 ruleKey、groupKey 和 field');
        return await write(
          [
            {
              target: {
                kind: 'derived',
                ruleKey: data.ruleKey,
                groupKey: data.groupKey,
                field: data.field,
              },
              value: data.value,
            },
          ],
          'edit',
        );
      }
      if (name === 'updateFields') {
        if (!Array.isArray(payload)) return failure('invalid-target', '请提供字段更新数组');
        const patches: { rowKey: string; fields: Partial<TRow> }[] = [];
        for (const patch of payload)
          if (record(patch) && typeof patch.rowKey === 'string' && record(patch.fields))
            patches.push({ rowKey: patch.rowKey, fields: patch.fields as Partial<TRow> });
        return api.updateFields(patches);
      }
      const keys = [
        ...new Set(
          Array.isArray(data.rowKeys)
            ? data.rowKeys.filter((key): key is string => typeof key === 'string')
            : typeof data.rowKey === 'string'
              ? [data.rowKey]
              : [],
        ),
      ];
      if (name === 'lockRows' || name === 'unlockRows') {
        locked = new Set(locked);
        if (config.readonly) return failure('readonly', '表格为只读模式');
        for (const key of keys) {
          if (!state.entries.some((e) => e.key === key))
            return failure('invalid-target', `行不存在：${key}`);
          if (name === 'lockRows') locked.add(key);
          else locked.delete(key);
        }
        bus.emit('lockChange', { rowKeys: [...locked] });
        notify();
        return success();
      }
      if (config.readonly) return failure('readonly', '表格为只读模式');
      if (name === 'mergeCells' || name === 'unmergeCells') {
        if (typeof data.field !== 'string') return failure('invalid-target', '请指定合并列');
        const targets: RowTarget[] = Array.isArray(data.targets)
          ? data.targets.flatMap<RowTarget>((item: unknown) => {
              if (!record(item)) return [];
              if (item.kind === 'record' && typeof item.rowKey === 'string')
                return [{ kind: 'record', rowKey: item.rowKey } satisfies RowTarget];
              if (
                item.kind === 'derived' &&
                typeof item.ruleKey === 'string' &&
                typeof item.groupKey === 'string'
              )
                return [
                  {
                    kind: 'derived',
                    ruleKey: item.ruleKey,
                    groupKey: item.groupKey,
                  } satisfies RowTarget,
                ];
              return [];
            })
          : keys.map((rowKey) => ({ kind: 'record', rowKey }));
        const ids = new Set(targets.map(rowTargetKey));
        if (name === 'unmergeCells') {
          commit(
            state,
            name,
            [],
            merges.filter(
              (m) =>
                m.field !== data.field ||
                !mergeTargets(m).some((target) => ids.has(rowTargetKey(target))),
            ),
          );
          return success();
        }
        const field = data.field;
        const view = createView(state, config, new Set(), new Map(), 40, []);
        targets.sort((a, b) => view.targetView(a) - view.targetView(b));
        const merge: ManualMerge = {
          field,
          rowKeys: targets.flatMap((target) => (target.kind === 'record' ? [target.rowKey] : [])),
          targets,
        };
        if (
          ids.size !== targets.length ||
          !validMerge(merge, view) ||
          merges.some(
            (m) =>
              m.field === field && mergeTargets(m).some((target) => ids.has(rowTargetKey(target))),
          )
        )
          return failure(
            'invalid-target',
            '只允许规则指定行类型中的连续单元格，且不能与现有合并或布局重叠',
          );
        commit(state, name, [], [...merges, own(merge)]);
        return success();
      }
      if (!['deleteRows', 'duplicateRows', 'insertRowAbove', 'insertRowBelow'].includes(name))
        return failure('invalid-target', `未知命令：${name}`);
      if (keys.some((key) => !state.indices.has(key)))
        return failure('invalid-target', '部分目标行不存在');
      const index = state.entries.findIndex((entry) => keys.includes(entry.key));
      if (index < 0 && state.entries.length) return failure('invalid-target', '目标行不存在');
      let entries = state.entries.slice();
      let splice: SourceSplice;
      const changed = new Map<string, Set<string>>();
      if (name === 'deleteRows') {
        if (keys.some((key) => locked.has(key))) return failure('readonly', '锁定行不可删除');
        if (
          entries.length - keys.length <
          (typeof data.minRemaining === 'number' ? data.minRemaining : 0)
        )
          return failure(
            'rejected',
            typeof data.message === 'string' ? data.message : '删除后记录数低于最小限制',
          );
        const selected = new Set(keys),
          positions = keys.map((key) => state.indices.get(key)!);
        const start = positions.reduce((min, value) => Math.min(min, value), entries.length),
          end = positions.reduce((max, value) => Math.max(max, value + 1), start);
        entries = entries.filter((entry) => !selected.has(entry.key));
        splice = { start, deleteCount: end - start, insertCount: end - start - keys.length };
      } else {
        const source = state.entries[index]?.row;
        const sourceRows =
          name === 'duplicateRows'
            ? state.entries
                .filter((entry) => keys.includes(entry.key))
                .map((entry) => clone(entry.row))
            : Array.isArray(data.rows)
              ? data.rows.filter((row): row is TRow => record(row))
              : [
                  {
                    ...(source
                      ? Object.fromEntries(
                          (config.groups ?? [])
                            .flatMap((g) => [...g.fields, ...(g.idField ? [g.idField] : [])])
                            .map((field) => [field, read(source, field)]),
                        )
                      : {}),
                    ...(record(data.rowDefaults) ? data.rowDefaults : {}),
                  } as TRow,
                ];
        const occupied = new Set(state.entries.map((entry) => entry.key));
        const added = sourceRows.map((row) => {
          let key: string;
          do {
            key = `et-new-${++serial}`;
          } while (occupied.has(key));
          occupied.add(key);
          const next = clone(row);
          if (typeof options.rowKey === 'string') Reflect.set(next, options.rowKey, key);
          return { key, row: own(next) };
        });
        const insertAt =
          data.position === 'end'
            ? entries.length
            : name === 'insertRowAbove'
              ? Math.max(0, index)
              : keys.reduce((last, key) => Math.max(last, state.indices.get(key) ?? -1), index) + 1;
        entries = [...entries.slice(0, insertAt), ...added, ...entries.slice(insertAt)];
        splice = { start: insertAt, deleteCount: 0, insertCount: added.length };
        for (const entry of added) changed.set(entry.key, new Set(Object.keys(entry.row)));
      }
      commit(project(entries, state.values, config, changed, state, splice), name, []);
      return success();
    } catch (error) {
      return failure('calc-error', errorOf(error).message);
    }
  }
  const api: ModelInstance<TRow> = {
    setDataSource: (rows) => replace(rows, false),
    replaceDataSource: (rows) => replace(rows, true),
    getDataSource: () => state.rows,
    updateFields(patches) {
      return apply(
        patches.flatMap((patch) =>
          Object.entries(patch.fields).map(([field, value]) => ({
            target: { kind: 'record', rowKey: patch.rowKey, field } satisfies CellTarget,
            value,
          })),
        ),
        'api',
      );
    },
    setDerivedValues(values) {
      if (dead) return;
      try {
        for (const value of values)
          if (!scalar(value.value)) throw new Error('独立输入必须为有限标量');
        const next = project(state.entries, own(values), config, new Map(), state);
        const message = config.validateDerivedValues?.(next.values, config.context);
        if (message) throw new Error(message);
        commit(next, 'external-derived', [], merges, false, false);
      } catch (error) {
        report(errorOf(error));
      }
    },
    getDerivedValues: () => state.values,
    getDerivedRows: () => state.results,
    getSummary: () => state.summary,
    getSubmission: () =>
      freeze({ records: state.rows, derivedValues: state.values, summary: state.summary }),
    updateConfig(next) {
      if (dead) return false;
      try {
        const normalized = normalizeConfig(next);
        const projected = project(state.entries, state.values, normalized);
        config = normalized;
        past = [];
        future = [];
        commit(projected, 'config', [], [], false, false);
        return true;
      } catch (error) {
        const configError =
          error instanceof TableConfigError
            ? error
            : new TableConfigError('config', 'invalid-value', errorOf(error).message);
        bus.emit('configError', configError);
        return false;
      }
    },
    setReadonly(value) {
      if (dead) return;
      config = { ...config, readonly: value };
      epoch.bump();
      notify();
    },
    async validate(): Promise<ValidationResult> {
      const validationId = ++validationSerial;
      try {
        if (dead) return { valid: false, errors: [{ message: '表格已销毁' }], firstError: null };
        const token = epoch.current();
        pendingValidation = new Set(['*']);
        notify();
        const covered = new Set(
          merges.flatMap((merge) =>
            mergeTargets(merge)
              .slice(1)
              .map((target) => targetKey(mergedCell(merge, target))),
          ),
        );
        const result = await validateProjection(state, config, covered);
        if (!epoch.valid(token) || validationId !== validationSerial || dead)
          return { valid: false, errors: [{ message: '校验结果已过期' }], firstError: null };
        errors = freeze(result);
        bus.emit('validationChange', { errors });
        notify();
        return freeze({ valid: !errors.length, errors, firstError: errors[0] ?? null });
      } catch (error) {
        const result = { message: errorOf(error).message };
        return { valid: false, errors: [result], firstError: result };
      } finally {
        if (validationId === validationSerial) {
          pendingValidation = new Set();
          notify();
        }
      }
    },
    executeCommand(name, payload) {
      const token = epoch.current();
      queue = queue.then(async () => {
        try {
          const result = dead
            ? failure('destroyed', '表格已销毁')
            : name !== 'validate' && !epoch.valid(token) && ['setDerivedValue'].includes(name)
              ? failure('stale', '命令结果已过期')
              : await handleCommand(name, payload);
          bus.emit('commandExecuted', { name, result });
          return result;
        } catch (error) {
          return failure('rejected', errorOf(error).message);
        }
      });
      return queue;
    },
    getCommandState(name) {
      if (dead) return { enabled: false, reason: 'destroyed' };
      if (
        ![
          'undo',
          'redo',
          'insertRowAbove',
          'insertRowBelow',
          'deleteRows',
          'duplicateRows',
          'lockRows',
          'unlockRows',
          'mergeCells',
          'unmergeCells',
          'validate',
          'setDerivedValue',
          'updateFields',
        ].includes(name)
      )
        return { enabled: false, reason: 'invalid-target' };
      if (dead) return { enabled: false, reason: 'destroyed' };
      if (name === 'validate') return { enabled: true };
      if (config.readonly) return { enabled: false, reason: 'readonly' };
      return {
        enabled: name === 'undo' ? past.length > 0 : name === 'redo' ? future.length > 0 : true,
      };
    },
    on: bus.on,
    getLockedRows: () => [...locked],
    setLockedRows(keys) {
      if (dead) return;
      const known = new Set(state.entries.map((e) => e.key));
      locked = new Set(keys.filter((key) => known.has(key)));
      bus.emit('lockChange', { rowKeys: [...locked] });
      notify();
    },
    destroy() {
      if (dead) return;
      dead = true;
      epoch.bump();
      bus.clear();
      listeners.clear();
      past = [];
      future = [];
    },
  };
  return {
    api,
    getState: () => state,
    getConfig: () => config,
    getMerges: () => merges,
    getErrors: () => errors,
    getPending: () => pendingValidation,
    getLocked: () => locked,
    write,
    canWrite,
    invalidate: epoch.bump,
    epoch,
    bus,
    subscribe(handler) {
      listeners.add(handler);
      return () => {
        listeners.delete(handler);
      };
    },
    destroyed: () => dead,
    handleCommand,
  };
}
export function createModel<TRow extends object = Row>(
  options: CreateModelOptions<TRow>,
): ModelInstance<TRow> {
  return createController(options).api;
}
