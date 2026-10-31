import type {
  CellLayout,
  CellRange,
  CellRef,
  ColumnDef,
  DerivedRowView,
  ManualMerge,
  RowLayout,
  TableConfig,
} from '../types';
import type { Projection } from '../model/pipeline';
import { mergeTargets } from '../utils/immutable';
import { projectRows } from './rows';
import { RowMetrics } from './metrics';
import { fitColumnWidths } from './columns';
export type VisualRow =
  | {
      kind: 'record';
      viewIndex: number;
      sourceIndex: number;
      rowKey: string;
      groupPath: string[];
      layout?: RowLayout;
    }
  | (DerivedRowView & { viewIndex: number });
export type Span = {
  start: number;
  end: number;
  col: number;
  colSpan: number;
  kind: 'group' | 'manual' | 'layout';
  field?: string;
  layout?: CellLayout;
};
export type ViewModel<TRow extends object> = {
  config: TableConfig<TRow>;
  projection: Projection<TRow>;
  extras: ReturnType<typeof projectRows<TRow>>['extras'];
  splice?: { start: number; deleteCount: number; insertCount: number };
  targetView: (target: import('../types').RowTarget) => number;
  rows: VisualRow[];
  columns: ColumnDef<TRow>[];
  widths: number[];
  lefts: number[];
  width: number;
  metrics: RowMetrics;
  spans: Span[];
  viewIndexOfRow: (key: string) => number;
  sourceIndexOfView: (index: number) => number;
  colAtOffset: (x: number) => number;
  anchorOf: (row: number, col: number) => CellRef;
  spanOf: (cell: CellRef) => Span | undefined;
  intersecting: (start: number, end: number) => Span[];
};
/** 派生行在源坐标之外插入，分组跨度只穿过更深层派生行。 */
export function createView<TRow extends object>(
  state: Projection<TRow>,
  config: TableConfig<TRow>,
  hidden: Set<string>,
  widths: Map<string, number>,
  height: number,
  manual: readonly ManualMerge[],
  previous?: ViewModel<TRow>,
  availableWidth = 0,
): ViewModel<TRow> {
  const visible = config.columns.filter((column) => !hidden.has(column.field));
  const columns = [
    ...visible.filter((c) => c.fixed === 'left'),
    ...visible.filter((c) => !c.fixed),
    ...visible.filter((c) => c.fixed === 'right'),
  ];
  const colWidths = fitColumnWidths(columns, widths, availableWidth),
    lefts: number[] = [];
  let width = 0;
  for (const value of colWidths) {
    lefts.push(width);
    width += value;
  }
  const compatible =
    previous?.config === config &&
    previous.metrics.estimate === height &&
    columns.length === previous.columns.length &&
    columns.every(
      (column, index) =>
        column === previous.columns[index] && colWidths[index] === previous.widths[index],
    );
  const rowProjection = projectRows(state, config, height, compatible ? previous : undefined),
    { rows, sourceView, targetView } = rowProjection;
  const splice = rowProjection.splice;
  const spans: Span[] = [],
    verticalByCol = new Map<number, Span[]>(),
    horizontalByRow = new Map<number, Span[]>();
  function add(span: Span): void {
    spans.push(span);
    const map = span.start === span.end ? horizontalByRow : verticalByCol;
    const key = span.start === span.end ? span.start : span.col;
    const list = map.get(key) ?? [];
    list.push(span);
    map.set(key, list);
  }
  for (const merge of config.merges?.vertical ?? []) {
    const col = columns.findIndex((c) => c.field === merge.column || c.key === merge.column);
    if (col < 0) continue;
    for (const group of state.tree.nodes)
      if (group.key === merge.by) {
        const start = sourceView(group.start),
          last = sourceView(group.end);
        if (start === undefined || last === undefined) continue;
        let end = last;
        while (end + 1 < rows.length) {
          const next = rows[end + 1]!;
          if (next.kind !== 'derived' || next.depth <= group.depth) break;
          end++;
        }
        if (end > start)
          add({ start, end, col, colSpan: 1, kind: 'group', field: columns[col]!.field });
      }
  }
  for (const merge of manual) {
    const targets = mergeTargets(merge);
    const col = columns.findIndex((c) => c.field === merge.field),
      start = targets[0] ? targetView(targets[0]) : undefined,
      end = targets.length ? targetView(targets[targets.length - 1]!) : undefined;
    if (col >= 0 && start !== undefined && start >= 0 && end !== undefined && end >= 0)
      add({ start, end, col, colSpan: 1, kind: 'manual', field: merge.field });
  }
  if (splice && previous)
    for (const span of previous.spans)
      if (
        span.kind === 'layout' &&
        (span.start < splice.start || span.start >= splice.start + splice.deleteCount)
      )
        add(
          span.start < splice.start
            ? span
            : {
                ...span,
                start: span.start + splice.insertCount - splice.deleteCount,
                end: span.end + splice.insertCount - splice.deleteCount,
              },
        );
  const layoutRows = splice ? rows.slice(splice.start, splice.start + splice.insertCount) : rows;
  for (const row of layoutRows) {
    if (row.kind === 'derived') {
      const label = columns.findIndex((c) => c.field === row.labelColumn);
      const ownGroup = (config.groups ?? [])[Math.max(row.depth, 0)];
      const ownMerge = config.merges?.vertical?.find((m) => m.by === ownGroup?.key);
      const from =
        row.depth < 0
          ? 0
          : columns.findIndex((c) => c.field === ownMerge?.column || c.key === ownMerge?.column);
      if (label >= 0 && from >= 0 && label > from)
        add({
          start: row.viewIndex,
          end: row.viewIndex,
          col: from,
          colSpan: label - from,
          kind: 'layout',
        });
    } else if (row.layout) {
      for (const cell of row.layout.cells) {
        const allKeys = config.columns.map((c) => c.key ?? c.field),
          from = allKeys.indexOf(cell.column ?? cell.range?.from ?? ''),
          until = cell.column
            ? from + 1
            : cell.range?.until
              ? allKeys.indexOf(cell.range.until)
              : allKeys.length;
        const included = columns
          .map((column, index) => ({ index, original: config.columns.indexOf(column) }))
          .filter((c) => c.original >= from && c.original < until);
        if (included.length)
          add({
            start: row.viewIndex,
            end: row.viewIndex,
            col: included[0]!.index,
            colSpan: included.length,
            kind: 'layout',
            field: cell.field,
            layout: cell,
          });
      }
    }
  }
  for (const merge of config.merges?.horizontal ?? []) {
    for (const row of layoutRows) {
      const rule =
        row.kind === 'derived'
          ? row.ruleKey
          : config.rowRules?.find((r) => r.layout === row.layout)?.id;
      if (rule !== merge.rule) continue;
      const start = columns.findIndex((c) => c.key === merge.from || c.field === merge.from),
        end = merge.until
          ? columns.findIndex((c) => c.key === merge.until || c.field === merge.until)
          : columns.length;
      if (
        start >= 0 &&
        end > start &&
        !(horizontalByRow.get(row.viewIndex) ?? []).some(
          (s) => start < s.col + s.colSpan && end > s.col,
        )
      )
        add({
          start: row.viewIndex,
          end: row.viewIndex,
          col: start,
          colSpan: end - start,
          kind: 'layout',
        });
    }
  }
  spans.sort(
    (a, b) => a.start - b.start || a.col - b.col || a.end - b.end || a.kind.localeCompare(b.kind),
  );
  for (const values of verticalByCol.values()) values.sort((a, b) => a.start - b.start);
  function verticalAt(row: number, col: number): Span | undefined {
    const list = verticalByCol.get(col) ?? [];
    let low = 0,
      high = list.length;
    while (low < high) {
      const mid = (low + high) >>> 1;
      if (list[mid]!.start <= row) low = mid + 1;
      else high = mid;
    }
    const span = list[low - 1];
    return span && span.end >= row ? span : undefined;
  }
  function spanOf(cell: CellRef): Span | undefined {
    return (
      verticalAt(cell.row, cell.col) ??
      horizontalByRow
        .get(cell.row)
        ?.find((span) => cell.col >= span.col && cell.col < span.col + span.colSpan)
    );
  }
  return {
    config,
    projection: state,
    extras: rowProjection.extras,
    splice,
    targetView,
    rows,
    columns,
    widths: colWidths,
    lefts,
    width,
    metrics: rowProjection.metrics,
    spans,
    viewIndexOfRow: (rowKey) => targetView({ kind: 'record', rowKey }),
    sourceIndexOfView: (index) => {
      const row = rows[index];
      return row?.kind === 'record' ? row.sourceIndex : -1;
    },
    colAtOffset(x) {
      let low = 0,
        high = columns.length;
      while (low < high) {
        const mid = (low + high) >>> 1;
        if (lefts[mid]! + colWidths[mid]! <= x) low = mid + 1;
        else high = mid;
      }
      return Math.max(0, Math.min(columns.length - 1, low));
    },
    spanOf,
    anchorOf(row, col) {
      const span = spanOf({ row, col });
      return span ? { row: span.start, col: span.col } : { row, col };
    },
    intersecting(start, end) {
      const result: Span[] = [];
      for (const list of verticalByCol.values()) {
        let low = 0,
          high = list.length;
        while (low < high) {
          const mid = (low + high) >>> 1;
          if (list[mid]!.end < start) low = mid + 1;
          else high = mid;
        }
        for (let i = low; i < list.length && list[i]!.start <= end; i++) result.push(list[i]!);
      }
      return result;
    },
  };
}
export function expandRange<TRow extends object>(
  range: CellRange,
  view: ViewModel<TRow>,
  shouldExpand: (cell: CellRef) => boolean = () => true,
): CellRange {
  let top = Math.min(range.anchor.row, range.focus.row),
    bottom = Math.max(range.anchor.row, range.focus.row),
    left = Math.min(range.anchor.col, range.focus.col),
    right = Math.max(range.anchor.col, range.focus.col);
  let again = true;
  while (again) {
    again = false;
    for (const span of view.spans) {
      if (
        !shouldExpand({ row: span.start, col: span.col }) ||
        span.end < top ||
        span.start > bottom ||
        span.col > right ||
        span.col + span.colSpan - 1 < left
      )
        continue;
      const next = [
        Math.min(top, span.start),
        Math.max(bottom, span.end),
        Math.min(left, span.col),
        Math.max(right, span.col + span.colSpan - 1),
      ];
      if (next[0] !== top || next[1] !== bottom || next[2] !== left || next[3] !== right) {
        [top, bottom, left, right] = next as [number, number, number, number];
        again = true;
      }
    }
  }
  return { anchor: { row: top, col: left }, focus: { row: bottom, col: right } };
}
