import type { DerivedRowView, RowTarget, TableConfig } from '../types';
import type { Projection } from '../model/pipeline';
import { findSplice } from '../model/splice';
import { freeze, read, rowTargetKey, same } from '../utils/immutable';
import { RowMetrics } from './metrics';
import type { ViewModel, VisualRow } from './view';

type ExtraRow = { source: number; row: DerivedRowView; priority: number; viewIndex: number };
const emptyPath = freeze<string[]>([]);
export interface RowProjection {
  rows: VisualRow[];
  extras: ExtraRow[];
  sourceView: (source: number) => number;
  targetView: (target: RowTarget) => number;
  metrics: RowMetrics;
  splice?: { start: number; deleteCount: number; insertCount: number };
}

/** 只按派生行建立坐标索引，真实记录的坐标由源下标加此前派生行数得到。 */
export function projectRows<TRow extends object>(
  state: Projection<TRow>,
  config: TableConfig<TRow>,
  height: number,
  previous?: ViewModel<TRow>,
): RowProjection {
  const groups = new Map(
    state.tree.nodes.map((group) => [JSON.stringify([group.key, group.id]), group]),
  );
  const extras: ExtraRow[] = state.results
    .filter((row) => row.visible)
    .flatMap((row) => {
      const rule = config.derivedRows?.find((rule) => rule.id === row.ruleKey),
        group = groups.get(JSON.stringify([rule?.level, row.groupKey]));
      if (!state.entries.length && row.groupKey !== 'table') return [];
      const before = rule?.position === 'before-group';
      return [
        {
          source: before ? (group?.start ?? 0) : (group?.end ?? state.entries.length - 1) + 1,
          row,
          priority: before ? 1 : 0,
          viewIndex: 0,
        },
      ];
    });
  extras.sort(
    (a, b) =>
      a.source - b.source ||
      (state.entries.length ? a.priority - b.priority : b.priority - a.priority) ||
      (a.priority ? a.row.depth - b.row.depth : b.row.depth - a.row.depth),
  );
  for (const [index, extra] of extras.entries()) extra.viewIndex = extra.source + index;
  const countBefore = (source: number, inclusive: boolean): number => {
    let low = 0,
      high = extras.length;
    while (low < high) {
      const mid = (low + high) >>> 1;
      if (extras[mid]!.source < source || (inclusive && extras[mid]!.source === source))
        low = mid + 1;
      else high = mid;
    }
    return low;
  };
  const sourceView = (source: number): number => source + countBefore(source, true);
  const byId = new Map(extras.map((extra) => [rowTargetKey(extra.row), extra]));
  const targetView = (target: RowTarget): number => {
    if (target.kind === 'derived') return byId.get(rowTargetKey(target))?.viewIndex ?? -1;
    const source = state.indices.get(target.rowKey);
    return source === undefined ? -1 : sourceView(source);
  };
  const record = (source: number, index: number, old?: VisualRow): VisualRow => {
    const entry = state.entries[source]!,
      groupPath = state.tree.paths[source] ?? emptyPath;
    const layout =
      old?.kind === 'record' && previous?.projection.entries[old.sourceIndex]?.row === entry.row
        ? old.layout
        : config.rowRules?.find((rule) =>
            same(read(entry.row, rule.match.field), rule.match.equals),
          )?.layout;
    return old?.kind === 'record' &&
      old.rowKey === entry.key &&
      old.sourceIndex === source &&
      old.viewIndex === index &&
      old.groupPath === groupPath &&
      old.layout === layout
      ? old
      : {
          kind: 'record',
          viewIndex: index,
          sourceIndex: source,
          rowKey: entry.key,
          groupPath,
          layout,
        };
  };
  const range = (start: number, end: number): VisualRow[] => {
    const rows: VisualRow[] = [];
    let at = countBefore(start, false),
      index = start + at;
    for (let source = start; source <= end; source++) {
      while (at < extras.length && extras[at]!.source === source) {
        rows.push({ ...extras[at]!.row, viewIndex: index++ });
        at++;
      }
      if (source < end) rows.push(record(source, index++));
    }
    return rows;
  };
  if (!previous)
    return {
      rows: range(0, state.entries.length),
      extras,
      sourceView,
      targetView,
      metrics: new RowMetrics(state.entries.length + extras.length, height),
    };

  const sourceChange =
    state.change?.base === previous.projection.identity
      ? state.change.splice
      : findSplice(previous.projection.entries, state.entries);
  const delta = sourceChange.insertCount - sourceChange.deleteCount;
  const shiftSource = (source: number): number =>
    source < sourceChange.start
      ? source
      : source >= sourceChange.start + sourceChange.deleteCount
        ? source + delta
        : -1;
  const sameExtra = (old: ExtraRow, next: ExtraRow): boolean =>
    rowTargetKey(old.row) === rowTargetKey(next.row) && shiftSource(old.source) === next.source;
  const oldExtras = previous.extras;
  let prefix = 0,
    oldEnd = oldExtras.length,
    newEnd = extras.length;
  while (prefix < oldEnd && prefix < newEnd && sameExtra(oldExtras[prefix]!, extras[prefix]!))
    prefix++;
  while (
    oldEnd > prefix &&
    newEnd > prefix &&
    sameExtra(oldExtras[oldEnd - 1]!, extras[newEnd - 1]!)
  ) {
    oldEnd--;
    newEnd--;
  }
  const startSource = Math.min(
    sourceChange.start,
    oldEnd > prefix ? oldExtras[prefix]!.source : sourceChange.start,
    newEnd > prefix ? extras[prefix]!.source : sourceChange.start,
  );
  const oldLast = Math.max(
    sourceChange.start + sourceChange.deleteCount,
    oldEnd > prefix ? oldExtras[oldEnd - 1]!.source : 0,
    newEnd > prefix ? extras[newEnd - 1]!.source - delta : 0,
  );
  const newLast = oldLast + delta;
  const oldStart = startSource + oldExtras.filter((extra) => extra.source < startSource).length,
    newStart = startSource + countBefore(startSource, false);
  const oldLimit = oldLast + oldExtras.filter((extra) => extra.source <= oldLast).length,
    newLimit = sourceView(newLast);
  // 顺序或数量不满足共同前后段时走完整投影，避免业务 visible 函数造成错配。
  if (
    oldStart !== newStart ||
    previous.rows.length - oldLimit !== state.entries.length + extras.length - newLimit
  )
    return {
      rows: range(0, state.entries.length),
      extras,
      sourceView,
      targetView,
      metrics: new RowMetrics(state.entries.length + extras.length, height),
    };
  const middle = range(startSource, newLast),
    viewDelta = newLimit - oldLimit;
  const reuse = (row: VisualRow, index: number): VisualRow => {
    if (row.kind === 'record')
      return record(row.sourceIndex + (index >= newLimit ? delta : 0), index, row);
    const next = byId.get(rowTargetKey(row))!.row;
    return row.viewIndex === index &&
      row.values === next.values &&
      row.label === next.label &&
      row.labelColumn === next.labelColumn &&
      row.depth === next.depth
      ? row
      : { ...next, viewIndex: index };
  };
  const rows = [
    ...previous.rows.slice(0, oldStart).map((row, index) => reuse(row, index)),
    ...middle,
  ];
  for (let index = oldLimit; index < previous.rows.length; index++)
    rows.push(reuse(previous.rows[index]!, index + viewDelta));
  const metrics = previous.metrics.splice(oldStart, oldLimit - oldStart, middle.length);
  const oldHeights = new Map(
    previous.rows
      .slice(oldStart, oldLimit)
      .map((row) => [rowTargetKey(row), { row, height: previous.metrics.height(row.viewIndex) }]),
  );
  for (const row of middle) {
    const old = oldHeights.get(rowTargetKey(row));
    if (
      old &&
      (row.kind === 'record' && old.row.kind === 'record'
        ? state.entries[row.sourceIndex]?.row ===
          previous.projection.entries[old.row.sourceIndex]?.row
        : row.kind === 'derived' &&
          old.row.kind === 'derived' &&
          row.values === old.row.values &&
          row.label === old.row.label)
    )
      metrics.setHeight(row.viewIndex, old.height);
  }
  return {
    rows,
    extras,
    sourceView,
    targetView,
    metrics,
    splice: { start: oldStart, deleteCount: oldLimit - oldStart, insertCount: middle.length },
  };
}
