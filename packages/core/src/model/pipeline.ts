import type {
  DerivedContext,
  DerivedRowView,
  DerivedValue,
  GroupNode,
  Scalar,
  RecordChange,
  TableConfig,
} from '../types';
import { CalculationError } from './config';
import { groupRows, type GroupTree } from './grouping';
import {
  derivedKey,
  errorOf,
  freeze,
  freezeContainer,
  read,
  record,
  same,
  scalar,
} from '../utils/immutable';
import type { SourceSplice } from './splice';
export type Entry<TRow extends object> = { key: string; row: TRow };
export type Projection<TRow extends object> = {
  identity: object;
  change?: { base: object; splice: SourceSplice };
  entries: readonly Entry<TRow>[];
  rows: readonly TRow[];
  tree: GroupTree;
  results: readonly DerivedRowView[];
  values: readonly DerivedValue[];
  summary: Readonly<Record<string, Scalar>>;
  indices: ReadonlyMap<string, number>;
  changedKeys: readonly string[];
};
export function tableGroup(count: number): GroupNode {
  return {
    id: 'table',
    key: 'table',
    scope: 'table',
    values: {},
    parentId: null,
    depth: -1,
    occurrence: 0,
    start: 0,
    end: count - 1,
    children: [],
  };
}
export function project<TRow extends object>(
  entries: readonly Entry<TRow>[],
  values: readonly DerivedValue[],
  config: TableConfig<TRow>,
  changed?: Map<string, Set<string>>,
  previous?: Projection<TRow>,
  sourceSplice?: SourceSplice,
): Projection<TRow> {
  let working = entries;
  let rowSnapshot: readonly TRow[] | undefined;
  // 大表快照按需物化：只读取 row 的计算规则不会反复复制和冻结全表数组。
  const getRows = (): readonly TRow[] =>
    (rowSnapshot ??=
      previous?.entries === working
        ? previous.rows
        : freezeContainer(working.map((entry) => entry.row)));
  const groupFields = new Set(
    (config.groups ?? []).flatMap((g) => [...g.fields, ...(g.idField ? [g.idField] : [])]),
  );
  let structural =
    !previous ||
    previous.entries.length !== entries.length ||
    !changed ||
    [...(changed?.values() ?? [])].some((fields) => [...fields].some((f) => groupFields.has(f)));
  const indices = structural
    ? new Map(entries.map((entry, index) => [entry.key, index]))
    : previous!.indices;
  const groupingDirty = changed
    ? [...changed.keys()].flatMap((key) => {
        const index = indices.get(key);
        return index === undefined ? [] : [index];
      })
    : [];
  if (sourceSplice)
    groupingDirty.push(
      ...[
        sourceSplice.start - 1,
        sourceSplice.start,
        sourceSplice.start + sourceSplice.insertCount - 1,
      ].filter((index) => index >= 0 && index < entries.length),
    );
  let tree =
    structural && !config.groups?.length
      ? ({ roots: [], nodes: [], paths: [] } satisfies GroupTree)
      : structural
        ? groupRows(
            getRows(),
            config.groups ?? [],
            previous && changed && (sourceSplice || entries.length === previous.entries.length)
              ? previous.tree
              : undefined,
            groupingDirty,
            sourceSplice,
          )
        : previous!.tree;
  freeze(tree);
  const dirty = changed
    ? new Map([...changed].map(([key, fields]) => [key, new Set(fields)]))
    : undefined;
  for (const rule of config.calculations ?? []) {
    let next: Entry<TRow>[] | undefined;
    const ruleEntries = working;
    let ruleRows: readonly TRow[] | undefined;
    const affected =
      !dirty || structural
        ? working.map((_, index) => index)
        : rule.scope === 'row'
          ? [...dirty]
              .filter(([, fields]) => rule.reads.some((field) => fields.has(field)))
              .map(([key]) => indices.get(key)!)
              .filter((index) => index !== undefined)
          : tree.nodes
              .filter(
                (group) =>
                  typeof rule.scope === 'object' &&
                  group.key === rule.scope.group &&
                  [...dirty].some(([key, fields]) => {
                    const index = indices.get(key);
                    return (
                      index !== undefined &&
                      index >= group.start &&
                      index <= group.end &&
                      rule.reads.some((field) => fields.has(field))
                    );
                  }),
              )
              .flatMap((group) =>
                Array.from(
                  { length: group.end - group.start + 1 },
                  (_, offset) => group.start + offset,
                ),
              );
    for (const index of affected) {
      const entry = working[index]!;
      const fields = dirty?.get(entry.key);
      if (
        rule.scope === 'row' &&
        dirty &&
        !structural &&
        !rule.reads.some((field) => fields?.has(field))
      )
        continue;
      let group: GroupNode | undefined;
      if (rule.scope !== 'row') {
        const scope = rule.scope.group;
        group = tree.nodes.find((g) => g.key === scope && index >= g.start && index <= g.end);
        if (
          dirty &&
          !structural &&
          group &&
          !working
            .slice(group.start, group.end + 1)
            .some((e) => rule.reads.some((f) => dirty.get(e.key)?.has(f)))
        )
          continue;
      }
      try {
        const output = rule.compute({
          row: entry.row,
          get rows(): readonly TRow[] {
            return group
              ? freezeContainer(
                  ruleEntries.slice(group.start, group.end + 1).map((entry) => entry.row),
                )
              : (ruleRows ??= freezeContainer(ruleEntries.map((entry) => entry.row)));
          },
          group,
          context: config.context,
        });
        if (output && typeof Reflect.get(output, 'then') === 'function')
          throw new Error('计算必须同步返回');
        if (output === null) continue;
        if (!record(output)) throw new Error('计算必须返回字段记录或 null');
        const changedFields: [string, Scalar][] = [];
        for (const [field, value] of Object.entries(output)) {
          if (!rule.writes.includes(field) || !scalar(value))
            throw new Error(`规则输出了未声明字段或非法值：${field}`);
          if (!same(read(entry.row, field), value)) changedFields.push([field, value]);
        }
        if (!changedFields.length) continue;
        const patch = Object.fromEntries(changedFields);
        next ??= working.slice();
        next[index] = { key: entry.key, row: freezeContainer({ ...entry.row, ...patch }) };
        if (dirty) {
          const affected = dirty.get(entry.key) ?? new Set<string>();
          for (const field of Object.keys(patch)) affected.add(field);
          dirty.set(entry.key, affected);
        }
      } catch (error) {
        throw new CalculationError(rule.id, entry.key, errorOf(error).message);
      }
    }
    if (next) {
      working = next;
      rowSnapshot = undefined;
      if (rule.writes.some((field) => groupFields.has(field))) {
        structural = true;
        tree = groupRows(getRows(), config.groups ?? []);
        freeze(tree);
      }
    }
  }
  freeze(tree);
  const previousResults = new Map(
    (previous?.results ?? []).map((result) => [
      JSON.stringify([result.ruleKey, result.groupKey]),
      result,
    ]),
  );
  const previousGroups = new Set(previous?.tree.nodes);
  const dirtyIndices = [...(dirty?.keys() ?? [])]
    .flatMap((key) => {
      const index = indices.get(key);
      return index === undefined ? [] : [index];
    })
    .sort((a, b) => a - b);
  const previousInputs = new Map(
    (previous?.values ?? []).map((value) => [derivedKey(value), value.value]),
  );
  const changedInputGroups = new Set(
    values
      .filter((value) => !same(previousInputs.get(derivedKey(value)), value.value))
      .map((value) => value.groupKey),
  );
  for (const value of previous?.values ?? [])
    if (!values.some((next) => derivedKey(next) === derivedKey(value)))
      changedInputGroups.add(value.groupKey);
  const results: DerivedRowView[] = [],
    inputs = new Map(values.map((value) => [derivedKey(value), value]));
  const retained: DerivedValue[] = [];
  // 子组先投影，父组可以读取此前已产生的子组结果；同组按声明顺序处理。
  function derive(group: GroupNode): void {
    for (const child of group.children) derive(child);
    if (!(config.derivedRows ?? []).some((rule) => rule.level === group.key)) return;
    let scopeRows: readonly TRow[] | undefined;
    const getScopeRows = (): readonly TRow[] =>
      (scopeRows ??= freezeContainer(
        working.slice(group.start, group.end + 1).map((entry) => entry.row),
      ));
    for (const rule of config.derivedRows ?? []) {
      if (rule.level !== group.key) continue;
      const previousResult = previousResults.get(JSON.stringify([rule.id, group.id]));
      const memberRowsUnchanged =
        (previousGroups.has(group) || tree.unchanged?.has(group)) &&
        !dirtyIndices.some((index) => index >= group.start && index <= group.end);
      const groupDirty =
        (structural && !previousGroups.has(group)) ||
        dirtyIndices.some((index) => index >= group.start && index <= group.end);
      if (
        previousResult &&
        (!structural || previousGroups.has(group)) &&
        !groupDirty &&
        !changedInputGroups.has(group.id) &&
        !Object.values(rule.cells).some((cell) => cell.type === 'compute')
      ) {
        results.push(previousResult);
        for (const cell of Object.values(rule.cells))
          if (cell.type === 'input') {
            const stored = inputs.get(
              derivedKey({ ruleKey: rule.id, groupKey: group.id, field: cell.field }),
            );
            if (stored && !same(stored.value, cell.default ?? null)) retained.push(stored);
          }
        continue;
      }
      const independent: Record<string, Scalar> = {};
      for (const cell of Object.values(rule.cells))
        if (cell.type === 'input') {
          const saved = inputs.get(
            derivedKey({ ruleKey: rule.id, groupKey: group.id, field: cell.field }),
          );
          const value = saved ? saved.value : (cell.default ?? null);
          independent[cell.field] = value;
          if (saved && !same(saved.value, cell.default ?? null)) retained.push(saved);
        }
      const precedingCount = results.length;
      let resultSnapshot: readonly DerivedRowView[] | undefined;
      const ctx: DerivedContext<TRow> = {
        get rows(): readonly TRow[] {
          return getScopeRows();
        },
        group,
        context: config.context,
        inputs: freeze(independent),
        get results(): readonly DerivedRowView[] {
          return (resultSnapshot ??= freezeContainer(results.slice(0, precedingCount)));
        },
      };
      const output: Record<string, Scalar> = {};
      for (const [field, cell] of Object.entries(rule.cells)) {
        let value: Scalar;
        if (cell.type === 'input') value = independent[cell.field];
        else if (cell.type === 'text') value = cell.text;
        else if (cell.type === 'compute') value = cell.fn(ctx);
        else if (previousResult && memberRowsUnchanged && typeof cell.agg !== 'function')
          value = previousResult.values[field];
        else if (cell.agg === 'sum' && previousResult && previous && !structural) {
          const fieldName = cell.of ?? field;
          value =
            Number(previousResult.values[field] ?? 0) +
            dirtyIndices
              .filter((index) => index >= group.start && index <= group.end)
              .reduce((delta, index) => {
                const nextValue = Number(read(working[index]!.row, fieldName) ?? 0),
                  oldValue = Number(read(previous.entries[index]!.row, fieldName) ?? 0);
                return (
                  delta +
                  (Number.isFinite(nextValue) ? nextValue : 0) -
                  (Number.isFinite(oldValue) ? oldValue : 0)
                );
              }, 0);
        } else if (typeof cell.agg === 'function') value = cell.agg(getScopeRows(), ctx);
        else {
          const numbers = getScopeRows()
            .map((row) => read(row, cell.of ?? field))
            .filter(
              (value) =>
                value !== null && value !== undefined && value !== '' && typeof value !== 'boolean',
            )
            .map(Number)
            .filter(Number.isFinite);
          const sum = numbers.reduce((total, v) => total + v, 0);
          value =
            cell.agg === 'count'
              ? group.end - group.start + 1
              : cell.agg === 'sum'
                ? sum
                : !numbers.length
                  ? null
                  : cell.agg === 'avg'
                    ? sum / numbers.length
                    : cell.agg === 'min'
                      ? numbers.reduce((min, value) => Math.min(min, value), Infinity)
                      : numbers.reduce((max, value) => Math.max(max, value), -Infinity);
        }
        if (!scalar(value))
          throw new CalculationError(rule.id, group.id, `派生字段 ${field} 必须返回有限标量`);
        output[field] = value;
      }
      const view: DerivedRowView = {
        kind: 'derived',
        ruleKey: rule.id,
        groupKey: group.id,
        depth: group.depth,
        label: typeof rule.label === 'function' ? rule.label(ctx) : rule.label,
        labelColumn: rule.labelColumn,
        values: freeze(output),
        visible: rule.visible?.(ctx) ?? true,
      };
      results.push(previousResult && same(previousResult, view) ? previousResult : freeze(view));
    }
  }
  for (const root of tree.roots) derive(root);
  derive(tableGroup(working.length));
  let recordChanges: readonly RecordChange<TRow>[] | undefined;
  const getChanges = (): readonly RecordChange<TRow>[] => {
    if (recordChanges) return recordChanges;
    const keys = new Set(dirty?.keys());
    if (sourceSplice && previous) {
      for (const entry of previous.entries.slice(
        sourceSplice.start,
        sourceSplice.start + sourceSplice.deleteCount,
      ))
        keys.add(entry.key);
      for (const entry of working.slice(
        sourceSplice.start,
        sourceSplice.start + sourceSplice.insertCount,
      ))
        keys.add(entry.key);
    }
    return (recordChanges = freeze(
      [...keys].flatMap((rowKey) => {
        const before = previous?.entries[previous.indices.get(rowKey) ?? -1]?.row,
          after = working[indices.get(rowKey) ?? -1]?.row;
        return before === after ? [] : [{ rowKey, before, after }];
      }),
    ));
  };
  const summary = Object.fromEntries(
    (config.summary?.items ?? []).map((item) => {
      const ctx = {
        get rows(): readonly TRow[] {
          return getRows();
        },
        results: freeze(results),
        context: config.context,
      };
      try {
        const value =
          item.update && previous && changed
            ? item.update({
                get rows(): readonly TRow[] {
                  return getRows();
                },
                results: ctx.results,
                context: config.context,
                previous: previous.summary[item.key],
                changes: getChanges(),
                previousResults: previous.results,
              })
            : item.compute(ctx);
        if (!scalar(value)) throw new Error('汇总必须返回有限标量');
        return [item.key, value];
      } catch (error) {
        throw new CalculationError(item.key, 'table', errorOf(error).message);
      }
    }),
  );
  return {
    identity: {},
    change:
      previous && changed
        ? {
            base: previous.identity,
            splice: (() => {
              let start = sourceSplice?.start ?? working.length,
                oldEnd = sourceSplice ? start + sourceSplice.deleteCount : 0,
                newEnd = sourceSplice ? start + sourceSplice.insertCount : 0;
              for (const key of dirty?.keys() ?? []) {
                const before = previous.indices.get(key),
                  after = indices.get(key);
                if (before !== undefined) {
                  start = Math.min(start, before);
                  oldEnd = Math.max(oldEnd, before + 1);
                }
                if (after !== undefined) {
                  start = Math.min(start, after);
                  newEnd = Math.max(newEnd, after + 1);
                }
              }
              const delta = working.length - previous.entries.length;
              oldEnd = Math.max(start, oldEnd, newEnd - delta);
              newEnd = oldEnd + delta;
              return { start, deleteCount: oldEnd - start, insertCount: newEnd - start };
            })(),
          }
        : undefined,
    entries: working,
    get rows(): readonly TRow[] {
      return getRows();
    },
    tree,
    results:
      previous &&
      results.length === previous.results.length &&
      results.every((row, index) => row === previous.results[index])
        ? previous.results
        : freeze(results),
    values: previous && same(previous.values, retained) ? previous.values : freeze(retained),
    summary: previous && same(previous.summary, summary) ? previous.summary : freeze(summary),
    indices,
    changedKeys: dirty ? [...dirty.keys()] : [],
  };
}
