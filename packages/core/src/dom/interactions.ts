import type {
  CellRange,
  CellRef,
  CommandResult,
  PasteReport,
  SelectionSnapshot,
  TableInstance,
} from '../types';
import type { ModelController, CellWrite } from '../model/model';
import type { Renderer } from './renderer';
import type { Editors } from './editors';
import { expandRange } from '../view/view';
import { clipboardRange, parseTSV, stringifyHTML, stringifyTSV } from '../utils/clipboard';
import { errorOf, freeze, read, record, targetKey } from '../utils/immutable';
import { normalizeValue } from '../model/validation';
import { el } from './elements';
export interface Interactions {
  getSelection: () => SelectionSnapshot;
  setSelection: (ranges: CellRange[]) => void;
  selectRows: (start: number, end?: number, base?: readonly CellRange[]) => void;
  execute: (name: string, payload?: unknown) => Promise<CommandResult | null>;
  move: (dr: number, dc: number, extend?: boolean) => void;
  destroy: () => void;
}
export function createInteractions<TRow extends object>(
  renderer: Renderer<TRow>,
  model: ModelController<TRow>,
  editors: Editors,
  table: () => TableInstance<TRow>,
): Interactions {
  let selection: SelectionSnapshot = freeze({ ranges: [], active: null }),
    anchor: CellRef | null = null,
    dragging = false,
    pointer = { x: 0, y: 0 },
    columnMode = false,
    rowMode = false,
    rowDragging = false,
    rowAnchor: number | null = null;
  let dragBase: readonly CellRange[] = [];
  let autoScroll: ReturnType<typeof setInterval> | undefined,
    menu: HTMLElement | null = null,
    tooltip: HTMLElement | null = null,
    tooltipTimer: ReturnType<typeof setTimeout> | undefined;
  const abort = new AbortController(),
    root = renderer.root;
  const rowMergeCoverage = new Map<string, boolean>();
  function publish(ranges: CellRange[], active: CellRef | null): void {
    rowMergeCoverage.clear();
    selection = freeze({
      ranges,
      active,
      ...(rowMode ? { mode: 'row' } : columnMode ? { mode: 'column' } : {}),
    });
    renderer.renderSelection(selection);
    model.bus.emit('selectionChange', selection);
    if (active && !columnMode && document.activeElement === renderer.body) {
      const rect = renderer.rect(active);
      showCellTooltip(active, rect.left, rect.top + rect.height, 0);
    }
  }
  function setSelection(ranges: CellRange[]): void {
    const view = renderer.view();
    columnMode = false;
    rowMode = false;
    rowAnchor = null;
    if (!view.rows.length || !view.columns.length) {
      publish([], null);
      return;
    }
    const valid = ranges
      .filter((range) =>
        [range.anchor.row, range.focus.row, range.anchor.col, range.focus.col].every(
          Number.isFinite,
        ),
      )
      .map((range) => {
        const clamp = (cell: CellRef): CellRef => ({
          row: Math.max(0, Math.min(view.rows.length - 1, Math.trunc(cell.row))),
          col: Math.max(0, Math.min(view.columns.length - 1, Math.trunc(cell.col))),
        });
        return expandRange(
          { anchor: clamp(range.anchor), focus: clamp(range.focus) },
          view,
          (cell) => renderer.behavior(cell, 'expandSelection'),
        );
      });
    anchor = valid[0]?.anchor ?? null;
    publish(valid, anchor);
  }
  function choose(
    cell: CellRef,
    extend = false,
    multiple = false,
    base?: readonly CellRange[],
  ): void {
    const view = renderer.view();
    if (!view.rows[cell.row] || !view.columns[cell.col] || !renderer.behavior(cell, 'selectable'))
      return;
    columnMode = false;
    rowMode = false;
    rowAnchor = null;
    const active = view.anchorOf(cell.row, cell.col);
    if (!extend || !anchor) anchor = active;
    const range = expandRange({ anchor, focus: active }, view, (cell) =>
      renderer.behavior(cell, 'expandSelection'),
    );
    publish(base ? [...base, range] : multiple ? [...selection.ranges, range] : [range], active);
  }
  /** 行号选择保留逻辑行边界，不向纵向合并的其他记录扩展。 */
  function selectRows(start: number, end = start, base: readonly CellRange[] = []): void {
    const view = renderer.view();
    if (!view.rows.length || !view.columns.length) return;
    const clamp = (index: number): number =>
      Math.max(0, Math.min(view.rows.length - 1, Math.trunc(index)));
    start = clamp(start);
    end = clamp(end);
    columnMode = false;
    rowMode = true;
    rowAnchor = start;
    // 编辑入口选择当前行内的单元格，避免 Enter 跳到分类合并的起始行。
    const col = view.columns.findIndex((_column, index) => {
      const span = view.spanOf({ row: end, col: index });
      return (
        (!span || span.start === span.end) &&
        renderer.behavior({ row: end, col: index }, 'selectable')
      );
    });
    anchor = { row: start, col: Math.max(0, col) };
    publish(
      [
        ...base,
        { anchor: { row: start, col: 0 }, focus: { row: end, col: view.columns.length - 1 } },
      ],
      { row: end, col: Math.max(0, col) },
    );
  }
  function partialRowMerge(cell: CellRef): boolean {
    if (!rowMode) return false;
    const span = renderer.view().spanOf(cell);
    if (!span || span.start === span.end) return false;
    const key = `${span.start}:${span.end}:${cell.col}`,
      cached = rowMergeCoverage.get(key);
    if (cached !== undefined) return cached;
    // 合并跨度可能包含十万行，按选区区间合并判断覆盖，避免逐行重复扫描。
    const intervals = selection.ranges
      .filter(
        (range) =>
          cell.col >= Math.min(range.anchor.col, range.focus.col) &&
          cell.col <= Math.max(range.anchor.col, range.focus.col),
      )
      .map((range) => ({
        start: Math.min(range.anchor.row, range.focus.row),
        end: Math.max(range.anchor.row, range.focus.row),
      }))
      .sort((a, b) => a.start - b.start);
    let covered = span.start;
    for (const interval of intervals) {
      if (interval.start > covered) break;
      covered = Math.max(covered, interval.end + 1);
      if (covered > span.end) break;
    }
    const partial = covered <= span.end;
    rowMergeCoverage.set(key, partial);
    return partial;
  }
  function move(dr: number, dc: number, extend = false): void {
    const view = renderer.view();
    if (!view.rows.length || !view.columns.length) return;
    const current = selection.active ?? { row: 0, col: 0 },
      span = view.spanOf(current);
    let row = current.row + (dr > 0 ? (span?.end ?? current.row) - current.row + dr : dr),
      col = current.col + (dc > 0 ? (span?.colSpan ?? 1) - 1 + dc : dc);
    if (dc && (col < 0 || col >= view.columns.length)) {
      row += col < 0 ? -1 : 1;
      col = col < 0 ? view.columns.length - 1 : 0;
    }
    row = Math.max(0, Math.min(view.rows.length - 1, row));
    col = Math.max(0, Math.min(view.columns.length - 1, col));
    for (let count = 0; count < view.rows.length * view.columns.length; count++) {
      const candidate = view.anchorOf(row, col);
      if (renderer.behavior(candidate, 'navigable') && renderer.behavior(candidate, 'selectable'))
        break;
      if (dc) {
        col += dc < 0 ? -1 : 1;
        if (col < 0 || col >= view.columns.length) {
          row += col < 0 ? -1 : 1;
          col = col < 0 ? view.columns.length - 1 : 0;
        }
      } else row += dr < 0 ? -1 : 1;
      if (row < 0 || row >= view.rows.length) return;
    }
    choose({ row, col }, extend);
    const target = renderer.target({ row, col });
    if (target) table().scrollToCell(target);
  }
  function cellWrites(clear: boolean, ranges = selection.ranges, copiedOnly = false): CellWrite[] {
    const view = renderer.view(),
      writes = new Map<string, CellWrite>();
    for (const range of ranges)
      for (
        let row = Math.min(range.anchor.row, range.focus.row);
        row <= Math.max(range.anchor.row, range.focus.row);
        row++
      )
        for (
          let col = Math.min(range.anchor.col, range.focus.col);
          col <= Math.max(range.anchor.col, range.focus.col);
          col++
        ) {
          const cell = { row, col },
            column = view.columns[col],
            target = renderer.target(cell);
          if (
            columnMode &&
            !selection.ranges.some(
              (selected) =>
                row >= Math.min(selected.anchor.row, selected.focus.row) &&
                row <= Math.max(selected.anchor.row, selected.focus.row),
            )
          )
            continue;
          if (
            !target ||
            !column ||
            !model.canWrite(target) ||
            (clear && !renderer.behavior(cell, 'clearable')) ||
            (copiedOnly && !renderer.behavior(cell, 'copyable')) ||
            partialRowMerge(cell) ||
            (columnMode && target.kind === 'derived')
          )
            continue;
          const span = view.spanOf(cell);
          if (span?.kind === 'manual' && row !== span.start) continue;
          writes.set(targetKey(target), {
            target,
            value: column.valueType === 'number' || column.editor === 'number' ? null : '',
          });
        }
    return [...writes.values()];
  }
  type CopyPlan = { text: string; html: string; writes: CellWrite[]; epoch: number };
  let fallbackPlan: CopyPlan | null = null;
  let fallbackWritten = false;
  function clipboard(): CopyPlan {
    const view = renderer.view(),
      range = clipboardRange(
        columnMode && selection.ranges.length
          ? [
              {
                anchor: selection.ranges[0]!.anchor,
                focus: selection.ranges[selection.ranges.length - 1]!.focus,
              },
            ]
          : selection.ranges,
      ),
      epoch = model.epoch.current();
    if (!range) return { text: '', html: '<table></table>', writes: [], epoch };
    const grid: unknown[][] = [];
    for (
      let row = Math.min(range.anchor.row, range.focus.row);
      row <= Math.max(range.anchor.row, range.focus.row);
      row++
    ) {
      if (columnMode && view.rows[row]?.kind === 'derived') continue;
      if (
        columnMode &&
        !selection.ranges.some(
          (selected) =>
            row >= Math.min(selected.anchor.row, selected.focus.row) &&
            row <= Math.max(selected.anchor.row, selected.focus.row),
        )
      )
        continue;
      const cells: unknown[] = [];
      for (
        let col = Math.min(range.anchor.col, range.focus.col);
        col <= Math.max(range.anchor.col, range.focus.col);
        col++
      ) {
        const span = view.spanOf({ row, col });
        cells.push(
          !renderer.behavior({ row, col }, 'copyable') ||
            (span?.kind === 'manual' && row !== span.start)
            ? ''
            : renderer.value({ row, col }),
        );
      }
      grid.push(cells);
    }
    return {
      text: stringifyTSV(grid),
      html: stringifyHTML(grid),
      writes: cellWrites(true, [range], true),
      epoch,
    };
  }
  async function copy(cut: boolean): Promise<CommandResult> {
    try {
      const data = clipboard();
      let copied = false;
      try {
        if (navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
          await navigator.clipboard.write([
            new ClipboardItem({
              'text/plain': new Blob([data.text], { type: 'text/plain' }),
              'text/html': new Blob([data.html], { type: 'text/html' }),
            }),
          ]);
          copied = true;
        }
      } catch (error) {
        root.dataset.clipboardFallback = errorOf(error).name;
      }
      if (!copied) {
        fallbackPlan = data;
        fallbackWritten = false;
        try {
          copied = document.execCommand('copy') && fallbackWritten;
        } finally {
          fallbackPlan = null;
        }
      }
      if (!copied)
        return {
          ok: false,
          code: 'rejected',
          message: '浏览器未允许复制，请使用 Ctrl/Cmd+C',
          data,
        };
      if (cut) return await model.write(data.writes, 'cut', data.epoch);
      return { ok: true, data };
    } catch (error) {
      return { ok: false, code: 'rejected', message: errorOf(error).message };
    }
  }
  function parseHTML(html: string): string[][] {
    const doc = new DOMParser().parseFromString(html, 'text/html'),
      table = doc.querySelector('table');
    if (!table) return [];
    const grid: string[][] = [];
    let rowIndex = 0;
    for (const row of table.rows) {
      grid[rowIndex] ??= [];
      let col = 0;
      for (const cell of row.cells) {
        while (grid[rowIndex]![col] !== undefined) col++;
        for (let dr = 0; dr < Math.max(1, cell.rowSpan); dr++)
          for (let dc = 0; dc < Math.max(1, cell.colSpan); dc++) {
            grid[rowIndex + dr] ??= [];
            grid[rowIndex + dr]![col + dc] = cell.textContent ?? '';
          }
        col += cell.colSpan;
      }
      rowIndex++;
    }
    return grid.map((row) => Array.from({ length: row.length }, (_, index) => row[index] ?? ''));
  }
  async function paste(payload: unknown): Promise<CommandResult> {
    try {
      if (!(await editors.save()))
        return { ok: false, code: 'rejected', message: '请先修正当前编辑' };
      const data = record(payload) ? payload : {},
        text =
          typeof payload === 'string' ? payload : typeof data.text === 'string' ? data.text : '',
        html = typeof data.html === 'string' ? data.html : '';
      const parsed = html ? parseHTML(html) : [],
        grid = parsed.length ? parsed : parseTSV(text),
        view = renderer.view(),
        start = selection.active;
      if (!start) return { ok: false, code: 'invalid-target', message: '请先选择粘贴起点' };
      if (!renderer.behavior(start, 'pasteTarget'))
        return { ok: false, code: 'readonly', message: '该单元格不能作为粘贴起点' };
      const report: PasteReport = { applied: 0, skipped: [], failed: [], truncated: 0 },
        writes: CellWrite[] = [],
        token = model.epoch.current();
      const placements: { cell: CellRef; value: string }[] = [];
      if (grid.length === 1 && grid[0]!.length === 1) {
        for (const range of selection.ranges)
          for (
            let row = Math.min(range.anchor.row, range.focus.row);
            row <= Math.max(range.anchor.row, range.focus.row);
            row++
          )
            for (
              let col = Math.min(range.anchor.col, range.focus.col);
              col <= Math.max(range.anchor.col, range.focus.col);
              col++
            )
              placements.push({ cell: { row, col }, value: grid[0]![0]! });
      } else {
        let index = start.row;
        for (const values of grid) {
          while (view.rows[index]?.kind === 'derived') index++;
          values.forEach((value, offset) =>
            placements.push({ cell: { row: index, col: start.col + offset }, value }),
          );
          index++;
        }
      }
      for (const { cell, value } of placements) {
        const row = view.rows[cell.row],
          column = view.columns[cell.col];
        if (!row || !column) {
          report.truncated++;
          continue;
        }
        const target = renderer.target(cell);
        if (!target) {
          report.truncated++;
          continue;
        }
        const span = view.spanOf(cell);
        const reason =
          row.kind === 'derived'
            ? '派生行不接收普通粘贴'
            : !renderer.behavior(cell, 'pasteable')
              ? '该列不允许粘贴'
              : !model.canWrite(target)
                ? '单元格只读或行已锁定'
                : partialRowMerge(cell)
                  ? '行选择未覆盖完整合并区域'
                  : span?.kind === 'manual' && cell.row !== span.start
                    ? '手动合并覆盖格'
                    : null;
        if (reason) {
          report.skipped.push({ target, reason });
          continue;
        }
        try {
          const recordRow =
            row.kind === 'record' ? model.getState().entries[row.sourceIndex]?.row : undefined;
          const kind =
            typeof column.editor === 'function' && recordRow
              ? column.editor(recordRow, column.field)
              : typeof column.editor === 'string'
                ? column.editor
                : column.valueType === 'number'
                  ? 'number'
                  : column.valueType === 'date'
                    ? 'date'
                    : 'text';
          const normalized = normalizeValue(value, {
            ...column,
            editor: kind,
            editorProps: { ...model.getConfig().editorOptions?.[kind], ...column.editorProps },
          });
          if (column.updateValueBefore && target.kind === 'record') {
            if (!recordRow) throw new Error('目标行不存在');
            if ((await column.updateValueBefore(normalized, recordRow, table())) === false)
              throw new Error('写入检查拒绝');
          }
          if (!model.epoch.valid(token) || model.destroyed())
            return { ok: false, code: 'stale', message: '粘贴结果已过期' };
          writes.push({ target, value: normalized });
        } catch (error) {
          report.failed.push({ target, reason: errorOf(error).message });
        }
      }
      const result = await model.write(writes, 'paste', token);
      if (!result.ok) return result;
      report.applied = writes.length;
      return { ok: true, data: freeze(report) };
    } catch (error) {
      return { ok: false, code: 'rejected', message: errorOf(error).message };
    }
  }
  const selectedKeys = (): string[] => {
    const view = renderer.view(),
      keys = new Set<string>();
    for (const range of selection.ranges)
      for (
        let row = Math.min(range.anchor.row, range.focus.row);
        row <= Math.max(range.anchor.row, range.focus.row);
        row++
      ) {
        const item = view.rows[row];
        if (item?.kind === 'record') keys.add(item.rowKey);
      }
    return [...keys];
  };
  async function execute(name: string, payload?: unknown): Promise<CommandResult | null> {
    try {
      if (name === 'selectAll') {
        const view = renderer.view();
        setSelection(
          view.rows.length && view.columns.length
            ? [
                {
                  anchor: { row: 0, col: 0 },
                  focus: { row: view.rows.length - 1, col: view.columns.length - 1 },
                },
              ]
            : [],
        );
        return { ok: true };
      }
      if (name === 'clearSelection') {
        setSelection([]);
        return { ok: true };
      }
      if (name === 'copy' || name === 'cut') return await copy(name === 'cut');
      if (name === 'paste') return await paste(payload);
      if (name === 'clear') return await model.write(cellWrites(true), 'clear');
      if (name === 'mergeCells' || name === 'unmergeCells') {
        if (
          record(payload) &&
          typeof payload.field === 'string' &&
          (Array.isArray(payload.rowKeys) || Array.isArray(payload.targets)) &&
          (name === 'unmergeCells' || payload.confirm === true)
        )
          return await model.handleCommand(name, payload);
        const active = selection.active,
          column = active ? renderer.view().columns[active.col] : undefined;
        if (!active || !column)
          return { ok: false, code: 'invalid-target', message: '请先选择合并范围' };
        if (
          selection.ranges.some(
            (range) => range.anchor.col !== active.col || range.focus.col !== active.col,
          )
        )
          return { ok: false, code: 'invalid-target', message: '手动合并仅支持同一列的纵向选区' };
        const rowKeys = selectedKeys(),
          targets = [
            ...new Map(
              selection.ranges
                .flatMap((range) => {
                  const rows = renderer
                    .view()
                    .rows.slice(
                      Math.min(range.anchor.row, range.focus.row),
                      Math.max(range.anchor.row, range.focus.row) + 1,
                    );
                  return rows.map((row) =>
                    row.kind === 'record'
                      ? { kind: 'record' as const, rowKey: row.rowKey }
                      : { kind: 'derived' as const, ruleKey: row.ruleKey, groupKey: row.groupKey },
                  );
                })
                .map((target) => [JSON.stringify(target), target]),
            ).values(),
          ];
        if (name === 'unmergeCells' || (record(payload) && payload.confirm === true))
          return await model.handleCommand(name, {
            field: column.field,
            rowKeys,
            targets,
            ...(record(payload) ? payload : {}),
          });
        menu?.remove();
        const preview = el('div', 'et-merge-preview');
        menu = preview;
        const covered = rowKeys.slice(1).filter((key) => {
          const row = model.getState().entries.find((entry) => entry.key === key)?.row;
          return row && read(row, column.field) != null && read(row, column.field) !== '';
        }).length;
        preview.append(
          el('p', '', `合并 ${targets.length} 行，隐藏 ${covered} 个非空值。原始值保留。`),
        );
        const rect = renderer.rect(active);
        renderer.placePopup(
          preview,
          Math.min(rect.left, window.innerWidth - 340),
          Math.min(rect.top + 40, window.innerHeight - 150),
        );
        const confirm = el('button', '', '确认合并'),
          cancel = el('button', '', '取消');
        confirm.addEventListener('click', () => {
          void table().executeCommand('mergeCells', { confirm: true });
          preview.remove();
        });
        cancel.addEventListener('click', () => preview.remove());
        preview.append(confirm, cancel);
        renderer.popup.append(preview);
        return { ok: true, data: { preview: true, covered } };
      }
      if (
        [
          'deleteRows',
          'duplicateRows',
          'insertRowAbove',
          'insertRowBelow',
          'lockRows',
          'unlockRows',
        ].includes(name)
      )
        return await model.handleCommand(name, payload ?? { rowKeys: selectedKeys() });
      return null;
    } catch (error) {
      return { ok: false, code: 'rejected', message: errorOf(error).message };
    }
  }
  function showMenu(event: MouseEvent): void {
    event.preventDefault();
    const cell = renderer.hit(event.clientX, event.clientY);
    if (!cell || cell.col < 0) return;
    const target = renderer.target(cell);
    const row = renderer.view().rows[cell.row];
    if (!target || row?.kind !== 'record' || !renderer.behavior(cell, 'menuable')) return;
    choose(cell);
    menu?.remove();
    menu = el('div', 'et-context-menu');
    menu.setAttribute('role', 'menu');
    renderer.placePopup(
      menu,
      Math.max(4, Math.min(event.clientX, window.innerWidth - 220)),
      Math.max(4, Math.min(event.clientY, window.innerHeight - 340)),
    );
    const add = (label: string, command: string, disabled: boolean, danger = false): void => {
      const btn = el('button', `et-menu-item${danger ? ' et-danger' : ''}`, label);
      btn.type = 'button';
      btn.disabled = disabled;
      btn.setAttribute('role', 'menuitem');
      btn.addEventListener('click', () => {
        menu?.remove();
        void table().executeCommand(command);
      });
      menu!.append(btn);
    };
    const readonly = model.getConfig().readonly === true,
      locked = model.api.getLockedRows().includes(row.rowKey);
    add('↑  在上方插入一行', 'insertRowAbove', readonly);
    add('↓  在下方插入一行', 'insertRowBelow', readonly);
    add('⌫  删除当前行', 'deleteRows', readonly || locked, true);
    add('⧉  复制当前行', 'duplicateRows', readonly);
    add(locked ? '♧  解锁当前行' : '♧  锁定当前行', locked ? 'unlockRows' : 'lockRows', readonly);
    if (model.getConfig().rowPinning) {
      const pinned = table()
        .getPinnedRows()
        .some((info) => info.target.kind === 'record' && info.target.rowKey === row.rowKey);
      add(pinned ? '⌖  取消固定对比行' : '⌖  固定为对比行', pinned ? 'unpinRow' : 'pinRow', false);
    }
    if (
      model
        .getConfig()
        .manualMerge?.rules.some((rule) => rule.column === renderer.view().columns[cell.col]!.field)
    ) {
      add('⇅  合并选中单元格', 'mergeCells', readonly);
      add('↕  拆分合并', 'unmergeCells', readonly);
    }
    for (const entry of model.getConfig().operations?.actions ?? []) {
      if (typeof entry === 'string') continue;
      const index = row.sourceIndex,
        group = model
          .getState()
          .tree.nodes.find(
            (node) => node.key === entry.scope && index >= node.start && index <= node.end,
          ),
        start = entry.scope === 'table' ? 0 : (group?.start ?? index),
        end = entry.scope === 'table' ? model.getState().rows.length - 1 : (group?.end ?? index);
      const context = {
        rows: model.getState().rows.slice(start, end + 1),
        row: model.getState().rows[index],
        rowKey: row.rowKey,
        start,
        end,
        table: table(),
        context: model.getConfig().context,
      };
      if (
        (entry.fields && !entry.fields.includes(renderer.view().columns[cell.col]!.field)) ||
        entry.visible?.(context) === false
      )
        continue;
      const btn = el(
        'button',
        `et-menu-item${entry.danger ? ' et-danger' : ''}`,
        `${entry.icon ?? ''} ${entry.label}`,
      );
      btn.type = 'button';
      btn.disabled = readonly || entry.enabled?.(context) === false;
      btn.addEventListener('click', () => {
        menu?.remove();
        void (async (): Promise<void> => {
          try {
            if (entry.enabled?.(context) === false) return;
            const token = model.epoch.current();
            if (entry.execute) {
              await entry.execute(context);
              return;
            }
            const created = entry.create ? await entry.create(context) : undefined;
            if (created === false || !model.epoch.valid(token)) return;
            const command =
              entry.kind === 'remove'
                ? 'deleteRows'
                : entry.kind === 'duplicate'
                  ? 'duplicateRows'
                  : entry.kind === 'lock'
                    ? 'lockRows'
                    : entry.kind === 'pin'
                      ? 'pinRow'
                      : entry.position === 'before'
                        ? 'insertRowAbove'
                        : 'insertRowBelow';
            const outcome = await table().executeCommand(command, {
              rowKeys: model
                .getState()
                .entries.slice(start, end + 1)
                .map((item) => item.key),
              rows: created,
              rowDefaults: {
                ...Object.fromEntries(
                  (entry.inheritFields ?? []).map((field) => [
                    field,
                    context.row ? read(context.row, field) : undefined,
                  ]),
                ),
                ...entry.rowDefaults,
              },
              minRemaining: entry.minRemaining,
              message: entry.message,
              position: entry.position,
            });
            if (!outcome.ok) renderer.showState(outcome.message ?? '操作未完成', undefined, true);
          } catch (error) {
            renderer.showState(errorOf(error).message, undefined, true);
          }
        })();
      });
      menu.append(btn);
    }
    renderer.popup.append(menu);
  }
  renderer.body.addEventListener('contextmenu', showMenu, { signal: abort.signal });
  renderer.body.addEventListener(
    'pointerdown',
    (event) => {
      if (event.button !== 0) return;
      const cell = renderer.hit(event.clientX, event.clientY);
      if (!cell) return;
      event.preventDefault();
      const previousSelection = selection;
      void (async (): Promise<void> => {
        try {
          if (!(await editors.save()) || selection !== previousSelection || model.destroyed())
            return;
          renderer.body.focus({ preventScroll: true });
          dragBase = event.ctrlKey || event.metaKey ? selection.ranges : [];
          rowDragging = cell.col < 0;
          if (rowDragging)
            selectRows(
              event.shiftKey && rowAnchor !== null ? rowAnchor : cell.row,
              cell.row,
              dragBase,
            );
          else choose(cell, event.shiftKey, event.ctrlKey || event.metaKey);
          dragging = true;
          pointer = { x: event.clientX, y: event.clientY };
          autoScroll = setInterval(() => {
            if (!dragging) return;
            const rect = renderer.body.getBoundingClientRect();
            let dx = 0,
              dy = 0;
            if (!rowDragging && pointer.x < rect.left + 28) dx = -18;
            else if (!rowDragging && pointer.x > rect.right - 28) dx = 18;
            if (pointer.y < rect.top + 28) dy = -18;
            else if (pointer.y > rect.bottom - 28) dy = 18;
            if (dx || dy) {
              renderer.scrollBy(dx, dy);
              dragTo();
            }
          }, 40);
        } catch (error) {
          renderer.showState(errorOf(error).message, undefined, true);
        }
      })();
    },
    { signal: abort.signal },
  );
  function dragTo(): void {
    const rect = renderer.body.getBoundingClientRect(),
      cell = renderer.hit(
        rowDragging
          ? rect.left + 1
          : Math.max(rect.left + renderer.numberWidth() + 2, Math.min(rect.right - 5, pointer.x)),
        Math.max(rect.top + 1, Math.min(rect.bottom - 5, pointer.y)),
      );
    if (cell && rowDragging) selectRows(rowAnchor ?? cell.row, cell.row, dragBase);
    else if (cell && cell.col >= 0) choose(cell, true, false, dragBase);
  }
  document.addEventListener(
    'pointermove',
    (event) => {
      if (dragging) {
        pointer = { x: event.clientX, y: event.clientY };
        dragTo();
      }
    },
    { signal: abort.signal },
  );
  function stopDragging(): void {
    dragging = false;
    rowDragging = false;
    dragBase = [];
    if (autoScroll) clearInterval(autoScroll);
    autoScroll = undefined;
  }
  document.addEventListener('pointerup', stopDragging, { signal: abort.signal });
  renderer.body.addEventListener(
    'dblclick',
    (event) => {
      const cell = renderer.hit(event.clientX, event.clientY);
      if (cell && cell.col >= 0) editors.start(cell);
    },
    { signal: abort.signal },
  );
  renderer.onHeader((col) => {
    const view = renderer.view();
    if (col < 0) {
      void execute('selectAll');
      return;
    }
    if (view.columns[col]?.columnSelectable === false) return;
    const ranges: CellRange[] = [];
    let start = -1;
    for (let index = 0; index <= view.rows.length; index++) {
      if (
        index < view.rows.length &&
        renderer.behavior({ row: index, col }, 'columnSelectable') &&
        renderer.behavior({ row: index, col }, 'selectable')
      ) {
        if (start < 0) start = index;
      } else if (start >= 0) {
        ranges.push({ anchor: { row: start, col }, focus: { row: index - 1, col } });
        start = -1;
      }
    }
    columnMode = true;
    rowMode = false;
    rowAnchor = null;
    anchor = ranges[0]?.anchor ?? null;
    hideTooltip();
    publish(ranges, anchor);
    renderer.body.focus({ preventScroll: true });
  });
  function keydown(event: KeyboardEvent): void {
    if (model.destroyed()) return;
    if (event.altKey && event.key === 'F10') {
      event.preventDefault();
      renderer.toolbar.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
      return;
    }
    if (
      event.target instanceof HTMLElement &&
      event.target.closest(
        '.et-toolbar, .et-toolbar-menu, .et-context-menu, .et-merge-preview, .et-pinned-manager, .et-pin-controls, .et-horizontal-scroll',
      )
    ) {
      if (event.key === 'Escape') {
        event.preventDefault();
        menu?.remove();
        renderer.popup.querySelector('.et-toolbar-menu')?.remove();
        renderer.body.focus({ preventScroll: true });
      }
      return;
    }
    if (event.key === 'Process' || event.isComposing) {
      if (!editors.active() && selection.active) editors.start(selection.active, '');
      return;
    }
    const command = event.ctrlKey || event.metaKey;
    if (editors.active()) {
      if (event.key === 'F2') {
        event.preventDefault();
        editors.enterEdit();
        return;
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault();
        const direction = event.shiftKey ? -1 : 1,
          previousSelection = selection;
        void editors.save().then((saved) => {
          if (saved && selection === previousSelection && !model.destroyed())
            move(event.key === 'Enter' ? direction : 0, event.key === 'Tab' ? direction : 0);
        });
      } else if (
        editors.arrowNavigation() &&
        !command &&
        !event.altKey &&
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)
      ) {
        event.preventDefault();
        const dr = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0,
          dc = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0,
          previousSelection = selection;
        void editors.save().then((saved) => {
          if (saved && selection === previousSelection && !model.destroyed()) move(dr, dc);
        });
      }
      return;
    }
    if (command && ['c', 'v', 'x'].includes(event.key.toLowerCase())) return;
    if (command && event.key.toLowerCase() === 'a') {
      event.preventDefault();
      void execute('selectAll');
      return;
    }
    if (command && ['z', 'y'].includes(event.key.toLowerCase())) {
      event.preventDefault();
      void table().executeCommand(
        event.key.toLowerCase() === 'y' || event.shiftKey ? 'redo' : 'undo',
      );
      return;
    }
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
      event.preventDefault();
      const dr = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0,
        dc = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
      if (command) {
        const view = renderer.view(),
          current = selection.active ?? { row: 0, col: 0 };
        const inside = (cell: CellRef): boolean =>
          cell.row >= 0 &&
          cell.row < view.rows.length &&
          cell.col >= 0 &&
          cell.col < view.columns.length;
        const next = (cell: CellRef): CellRef => ({ row: cell.row + dr, col: cell.col + dc });
        const filled = (cell: CellRef): boolean => {
          const value = renderer.value(view.anchorOf(cell.row, cell.col));
          return value !== null && value !== undefined && value !== '';
        };
        let destination = next(current);
        if (!inside(destination)) destination = current;
        else if (filled(current) && filled(destination)) {
          while (inside(next(destination)) && filled(next(destination)))
            destination = next(destination);
        } else {
          while (!filled(destination) && inside(next(destination))) destination = next(destination);
        }
        while (
          destination.row >= 0 &&
          destination.row < view.rows.length &&
          inside(destination) &&
          (!renderer.behavior(destination, 'navigable') ||
            !renderer.behavior(destination, 'selectable'))
        ) {
          const candidate = { row: destination.row - dr, col: destination.col - dc };
          if (
            !inside(candidate) ||
            (candidate.row === current.row && candidate.col === current.col)
          ) {
            destination = current;
            break;
          }
          destination = candidate;
        }
        choose(destination, event.shiftKey);
        const target = selection.active ? renderer.target(selection.active) : null;
        if (target) table().scrollToCell(target);
      } else move(dr, dc, event.shiftKey);
      return;
    }
    if (['Home', 'End', 'PageUp', 'PageDown'].includes(event.key)) {
      event.preventDefault();
      const view = renderer.view(),
        active = selection.active ?? { row: 0, col: 0 };
      if (event.key.startsWith('Page'))
        move(
          (event.key === 'PageDown' ? 1 : -1) *
            Math.max(1, Math.floor(renderer.body.clientHeight / view.metrics.estimate)),
          0,
          event.shiftKey,
        );
      else {
        const destination = {
          row: command ? (event.key === 'End' ? view.rows.length - 1 : 0) : active.row,
          col: event.key === 'End' ? view.columns.length - 1 : 0,
        };
        const direction = event.key === 'End' ? -1 : 1;
        while (
          destination.row >= 0 &&
          destination.row < view.rows.length &&
          destination.col >= 0 &&
          destination.col < view.columns.length &&
          (!renderer.behavior(destination, 'navigable') ||
            !renderer.behavior(destination, 'selectable'))
        ) {
          destination.col += direction;
          if (command && (destination.col < 0 || destination.col >= view.columns.length)) {
            destination.row += direction;
            destination.col = direction > 0 ? 0 : view.columns.length - 1;
          }
        }
        if (
          destination.row >= 0 &&
          destination.row < view.rows.length &&
          destination.col >= 0 &&
          destination.col < view.columns.length
        )
          choose(destination, event.shiftKey);
      }
      const target = selection.active ? renderer.target(selection.active) : null;
      if (target) table().scrollToCell(target);
      return;
    }
    if (event.key === 'F2') {
      event.preventDefault();
      if (selection.active) editors.start(selection.active);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      move(event.shiftKey ? -1 : 1, 0);
      return;
    }
    if (event.key === 'Tab') {
      event.preventDefault();
      move(0, event.shiftKey ? -1 : 1);
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      menu?.remove();
      hideTooltip();
      return;
    }
    if (event.key === 'Backspace') {
      event.preventDefault();
      if (selection.active && selection.mode !== 'row') editors.start(selection.active, '');
      else void execute('clear');
      return;
    }
    if (event.key === 'Delete') {
      event.preventDefault();
      void execute('clear');
      return;
    }
    if (!command && !event.altKey && event.key.length === 1 && selection.active) {
      event.preventDefault();
      editors.start(selection.active, event.key);
    }
  }
  root.addEventListener('keydown', keydown, { signal: abort.signal });
  if (!root.contains(renderer.popup))
    renderer.popup.addEventListener('keydown', keydown, { signal: abort.signal });
  root.addEventListener(
    'compositionstart',
    () => {
      if (!editors.active() && selection.active) editors.start(selection.active, '');
    },
    { signal: abort.signal },
  );
  root.addEventListener(
    'copy',
    (event) => {
      if (editors.active() || !selection.ranges.length) return;
      event.preventDefault();
      try {
        const data = fallbackPlan ?? clipboard();
        if (!event.clipboardData) throw new Error('浏览器没有提供剪贴板，未执行复制');
        event.clipboardData.setData('text/plain', data.text);
        event.clipboardData.setData('text/html', data.html);
        if (fallbackPlan) fallbackWritten = true;
      } catch (error) {
        renderer.showState(errorOf(error).message, undefined, true);
      }
    },
    { signal: abort.signal },
  );
  root.addEventListener(
    'cut',
    (event) => {
      if (editors.active() || !selection.ranges.length) return;
      event.preventDefault();
      try {
        const data = clipboard();
        if (!event.clipboardData) throw new Error('浏览器没有提供剪贴板，未执行剪切');
        event.clipboardData.setData('text/plain', data.text);
        event.clipboardData.setData('text/html', data.html);
        void model.write(data.writes, 'cut', data.epoch);
      } catch (error) {
        renderer.showState(errorOf(error).message, undefined, true);
      }
    },
    { signal: abort.signal },
  );
  root.addEventListener(
    'paste',
    (event) => {
      if (editors.active()) return;
      event.preventDefault();
      void table().executeCommand('paste', {
        text: event.clipboardData?.getData('text/plain') ?? '',
        html: event.clipboardData?.getData('text/html') ?? '',
      });
    },
    { signal: abort.signal },
  );
  document.addEventListener(
    'pointerdown',
    (event) => {
      const path = event.composedPath();
      if (menu && !path.includes(menu)) {
        menu.remove();
        menu = null;
      }
      // 浮层可能挂载到表格外，按本实例的事件路径判断内外边界。
      if (path.includes(root) || path.includes(renderer.popup)) return;
      stopDragging();
      hideTooltip();
      if (editors.active()) {
        const previousSelection = selection;
        setSelection([]);
        const clearedSelection = selection;
        void editors.save().then((saved) => {
          // 等待保存时保留外部点击的清选语义，仅失败且没有新选择时恢复活动格。
          if (!saved && selection === clearedSelection && editors.active() && !model.destroyed()) {
            rowMode = previousSelection.mode === 'row';
            columnMode = previousSelection.mode === 'column';
            anchor = previousSelection.ranges[0]?.anchor ?? previousSelection.active;
            publish([...previousSelection.ranges], previousSelection.active);
          }
        });
      } else if (selection.ranges.length || selection.active) setSelection([]);
    },
    { capture: true, signal: abort.signal },
  );
  document.addEventListener(
    'scroll',
    () => {
      hideTooltip();
      menu?.remove();
      menu = null;
      renderer.popup
        .querySelectorAll('.et-toolbar-menu, .et-merge-preview')
        .forEach((node) => node.remove());
    },
    { capture: true, passive: true, signal: abort.signal },
  );
  function hideTooltip(): void {
    if (tooltipTimer) clearTimeout(tooltipTimer);
    tooltip?.remove();
    tooltip = null;
    renderer.body.removeAttribute('aria-describedby');
  }
  function showCellTooltip(cell: CellRef, x: number, y: number, delay = 200): void {
    hideTooltip();
    try {
      const target = renderer.target(cell),
        row = renderer.view().rows[cell.row],
        column = renderer.view().columns[cell.col];
      if (!row || !column) return;
      const issue = target
        ? model
            .getErrors()
            .find((error) => error.target && targetKey(error.target) === targetKey(target))
        : undefined;
      const data = row.kind === 'record' ? model.getState().rows[row.sourceIndex] : undefined;
      const comment = data
        ? column.comment?.(data, {
            value: renderer.value(cell),
            row: data,
            field: column.field,
            column,
            rowIndex: row.kind === 'record' ? row.sourceIndex : -1,
          })
        : undefined;
      const content = renderer.content(cell);
      const overflow =
        column.overflowTooltip !== false &&
        content &&
        content.scrollWidth > content.clientWidth + 1;
      const text = issue?.message ?? comment ?? (overflow ? renderer.display(cell) : undefined);
      if (!text) return;
      tooltipTimer = setTimeout(() => {
        tooltip = el('div', `et-tooltip${issue ? ' et-tooltip-error' : ''}`, text);
        tooltip.id = `et-tooltip-${crypto.randomUUID()}`;
        tooltip.setAttribute('role', 'tooltip');
        renderer.placePopup(
          tooltip,
          Math.max(4, Math.min(x + 12, window.innerWidth - 330)),
          Math.max(4, Math.min(y + 16, window.innerHeight - 80)),
        );
        renderer.popup.append(tooltip);
        renderer.body.setAttribute('aria-describedby', tooltip.id);
      }, delay);
    } catch (error) {
      renderer.showState(errorOf(error).message, undefined, true);
    }
  }
  renderer.body.addEventListener(
    'focus',
    () => {
      if (selection.active && selection.mode !== 'column') {
        const rect = renderer.rect(selection.active);
        showCellTooltip(selection.active, rect.left, rect.top + rect.height, 0);
      }
    },
    { signal: abort.signal },
  );
  renderer.body.addEventListener('blur', hideTooltip, { signal: abort.signal });
  renderer.body.addEventListener(
    'pointermove',
    (event) => {
      if (dragging) return;
      const cell = renderer.hit(event.clientX, event.clientY);
      if (cell && cell.col >= 0) showCellTooltip(cell, event.clientX, event.clientY);
      else hideTooltip();
    },
    { signal: abort.signal },
  );
  renderer.body.addEventListener('pointerleave', hideTooltip, { signal: abort.signal });
  return {
    selectRows,
    getSelection: () => selection,
    setSelection,
    execute,
    move,
    destroy() {
      abort.abort();
      stopDragging();
      if (tooltipTimer) clearTimeout(tooltipTimer);
      menu?.remove();
      tooltip?.remove();
    },
  };
}
