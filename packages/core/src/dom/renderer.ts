import type {
  CellBehaviors,
  CellRange,
  CellRef,
  CellTarget,
  ColumnDef,
  CreateTableOptions,
  Density,
  PinnedRowInfo,
  RowTarget,
  RowLayout,
  SelectionSnapshot,
  Theme,
  ValidationError,
} from '../types';
import type { ModelController } from '../model/model';
import { createView, type ViewModel, type VisualRow } from '../view/view';
import { errorOf, freeze, read, same, targetKey, rowTargetKey } from '../utils/immutable';
import { validateClass, validateStyle } from '../model/config';
import { el, textValue } from './elements';

export interface Renderer<TRow extends object> {
  root: HTMLDivElement;
  body: HTMLDivElement;
  scrollLeft: () => number;
  scrollToX: (left: number) => void;
  scrollBy: (dx: number, dy: number) => void;
  head: HTMLDivElement;
  popup: HTMLDivElement;
  placePopup: (node: HTMLElement, left: number, top: number) => { scaleX: number; scaleY: number };
  content: (cell: CellRef) => HTMLElement | null;
  visible: (cell: CellRef) => boolean;
  toolbar: HTMLDivElement;
  numberWidth: () => number;
  view: () => ViewModel<TRow>;
  refresh: (rebuild?: boolean) => void;
  renderSelection: (selection: SelectionSnapshot) => void;
  hit: (x: number, y: number) => CellRef | null;
  target: (cell: CellRef) => CellTarget | null;
  behavior: (cell: CellRef, name: keyof CellBehaviors) => boolean;
  rect: (cell: CellRef) => { left: number; top: number; width: number; height: number };
  value: (cell: CellRef) => unknown;
  display: (cell: CellRef, pinned?: boolean) => string;
  setTheme: (theme: Theme) => void;
  setDensity: (density: Density) => void;
  setWidth: (field: string, width: number) => void;
  setHidden: (fields: string[]) => void;
  hidden: () => string[];
  resetColumns: () => void;
  setPinned: (targets: RowTarget[]) => void;
  getPinned: () => PinnedRowInfo[];
  setEditing: (cell: CellRef | null) => void;
  onScroll: (fn: () => void) => void;
  onHeader: (fn: (col: number) => void) => void;
  onUnpin: (fn: (target: RowTarget) => void) => void;
  onLocate: (fn: (target: RowTarget) => void) => void;
  showState: (message: string | null, retry?: () => void, overlay?: boolean) => void;
  destroy: () => void;
}
type RenderedRow = {
  tr: HTMLTableRowElement;
  identity: string;
  cleanups: (() => void)[];
  row: object | undefined;
  stamp: string;
  layout?: RowLayout;
};
type RenderedMerge = {
  cell: CellRef;
  cleanup?: () => void;
  comment?: string;
  node: HTMLDivElement;
  content: HTMLDivElement;
  row: object | undefined;
  version: number;
};

export function createRenderer<TRow extends object>(
  container: HTMLElement,
  options: CreateTableOptions<TRow>,
  model: ModelController<TRow>,
): Renderer<TRow> {
  const root = el('div', 'edit-table'),
    toolbar = el('div', 'et-toolbar'),
    head = el('div', 'et-head-viewport'),
    headTable = el('table', 'et-head-table'),
    headCols = el('colgroup'),
    thead = el('thead'),
    pinned = el('tbody', 'et-pinned'),
    pinManager = el('div', 'et-pinned-manager'),
    pinnedSelection = el('div', 'et-pinned-select-layer'),
    headSelection = el('div', 'et-head-selection');
  const bodyShell = el('div', 'et-body-shell'),
    body = el('div', 'et-body-viewport'),
    horizontal = el('div', 'et-horizontal-scroll'),
    horizontalContent = el('div', 'et-horizontal-content'),
    canvas = el('div', 'et-body-canvas'),
    bodyTable = el('table', 'et-body-table'),
    bodyCols = el('colgroup'),
    tbody = el('tbody'),
    mergeLayer = el('div', 'et-merge-layer'),
    selectLayer = el('div', 'et-select-layer'),
    popup = el('div', 'et-popup-layer'),
    stateLayer = el('div', 'et-data-state');
  // grid 只包含数据区；工具栏和编辑浮层保持独立语义，避免 Safari 将其从辅助功能树中隐藏。
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', '可编辑表格组件');
  body.tabIndex = 0;
  body.setAttribute('role', 'grid');
  body.setAttribute('aria-label', '可编辑表格');
  horizontal.tabIndex = 0;
  horizontal.setAttribute('aria-label', '横向滚动表格');
  horizontal.hidden = true;
  horizontal.append(horizontalContent);
  root.dataset.theme = options.theme ?? 'light';
  popup.dataset.theme = root.dataset.theme;
  root.dataset.density = options.density ?? 'normal';
  headTable.append(headCols, thead, pinned);
  pinManager.hidden = true;
  pinManager.setAttribute('aria-label', '固定行管理');
  pinnedSelection.setAttribute('aria-hidden', 'true');
  headSelection.setAttribute('aria-hidden', 'true');
  head.append(headTable, pinManager, pinnedSelection, headSelection);
  bodyTable.append(bodyCols, tbody);
  canvas.append(bodyTable, mergeLayer, selectLayer);
  body.append(canvas);
  bodyShell.append(body, horizontal);
  root.append(toolbar, head, bodyShell, stateLayer);
  (options.getPopupContainer?.() ?? root).append(popup);
  container.append(root);
  // 用固定定位探针测出实际包含块，兼容 transform/filter 宿主和缩放。
  const popupOrigin = el('div');
  Object.assign(popupOrigin.style, {
    position: 'fixed',
    left: '0px',
    top: '0px',
    width: '100px',
    height: '100px',
    visibility: 'hidden',
    pointerEvents: 'none',
  });
  popupOrigin.setAttribute('aria-hidden', 'true');
  popup.append(popupOrigin);
  function placePopup(
    node: HTMLElement,
    left: number,
    top: number,
  ): { scaleX: number; scaleY: number } {
    const origin = popupOrigin.getBoundingClientRect();
    const scaleX = origin.width / 100 || 1,
      scaleY = origin.height / 100 || 1;
    node.style.left = `${(left - origin.left) / scaleX}px`;
    node.style.top = `${(top - origin.top) / scaleY}px`;
    return { scaleX, scaleY };
  }
  if (options.height !== undefined) {
    bodyShell.style.height =
      typeof options.height === 'number' ? `${options.height}px` : options.height;
    bodyShell.style.flex = 'none';
    root.style.height = 'auto';
  }
  toolbar.hidden = options.toolbar === false;
  stateLayer.hidden = true;
  let theme: Theme = options.theme ?? 'light',
    density: Density = options.density ?? 'normal';
  let hidden = new Set(
      model
        .getConfig()
        .columns.filter((c) => c.hidden)
        .map((c) => c.field),
    ),
    widths = new Map<string, number>();
  const numberSize = (): number =>
    model.getConfig().rowNumbers
      ? Math.max(
          54,
          String(
            model.getState().entries.length +
              model.getState().results.filter((row) => row.visible).length,
          ).length *
            8 +
            26,
        )
      : 0;
  let numberWidth = numberSize();
  let view = createView(
    model.getState(),
    model.getConfig(),
    hidden,
    widths,
    rowHeight(),
    model.getMerges(),
    undefined,
    Math.max(0, body.clientWidth - numberWidth),
  );
  let selection: SelectionSnapshot = { ranges: [], active: null },
    pins: RowTarget[] = [],
    editing: CellRef | null = null;
  let pinnedIds = new Set<string>();
  const selectedPins = new Set<string>();
  let scrollHook = (): void => {},
    headerHook = (_col: number): void => {},
    unpinHook = (_target: RowTarget): void => {},
    locateHook = (_target: RowTarget): void => {};
  let derivedPositions = new Map(
    view.extras.map((extra) => [
      JSON.stringify([extra.row.ruleKey, extra.row.groupKey]),
      extra.viewIndex,
    ]),
  );
  let lastStart = -1,
    lastEnd = -1,
    configVersion = 0,
    destroyed = false;
  const activeRows = new Map<number, RenderedRow>(),
    pool: RenderedRow[] = [];
  const mergedCells = new Map<string, RenderedMerge>(),
    mergeSegments = new Map<string, HTMLDivElement>();
  const spacerPool: HTMLTableRowElement[] = [];
  const formatCache = new Map<
    string,
    {
      value: unknown;
      fn: ColumnDef<TRow>['formatter'];
      format: string | undefined;
      empty: string | undefined;
      text: string;
    }
  >();
  const dispose = new AbortController();
  let headerAbort = new AbortController();
  const amountFormatter = new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: options.currency ?? 'CNY',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  let viewportWidth = body.clientWidth,
    viewportHeight = body.clientHeight,
    scrollY = body.scrollTop;
  let horizontalState: readonly [number, number, number] | null = null;
  function rowHeight(): number {
    const value = model.getConfig().rowHeight;
    return typeof value === 'number' ? value : density === 'compact' ? 28 : 38;
  }
  const numbers = (): number => numberWidth;
  const totalWidth = (): number => view.width + numbers();
  function report(error: unknown): void {
    if (options.onError) {
      try {
        options.onError(errorOf(error));
      } catch (nested) {
        console.error('EditTable onError 处理失败', nested);
      }
    } else console.error('EditTable', error);
  }
  function rawValue(cell: CellRef): unknown {
    const row = view.rows[cell.row],
      column = view.columns[cell.col];
    if (!row || !column) return undefined;
    const span = view.spanOf(cell);
    if (row.kind === 'derived')
      return column.field === row.labelColumn || span?.field === row.labelColumn
        ? row.label
        : row.values[column.field];
    const data = model.getState().entries[row.sourceIndex]?.row;
    if (!data) return undefined;
    if (span?.layout?.content)
      return span.layout.content.parts
        .map((part) => (typeof part === 'string' ? part : textValue(read(data, part.field))))
        .join('');
    if (row.layout && !span) return '';
    return read(data, span?.field ?? column.field);
  }
  function display(cell: CellRef, forPinned = false): string {
    const row = view.rows[cell.row],
      column = view.columns[cell.col];
    if (!row || !column) return '';
    const value = rawValue(cell);
    const source =
      row.kind === 'record' ? model.getState().entries[row.sourceIndex]?.row : undefined;
    if (forPinned && source && column.pinnedText) {
      try {
        return column.pinnedText(value, source);
      } catch (error) {
        report(error);
        return textValue(value);
      }
    }
    if (value === null || value === undefined || value === '') return column.emptyValue ?? '';
    const key = `${row.kind === 'record' ? row.rowKey : JSON.stringify([row.ruleKey, row.groupKey])}:${column.field}`;
    const cache = formatCache.get(key);
    if (
      cache &&
      same(cache.value, value) &&
      cache.fn === column.formatter &&
      cache.format === column.format &&
      cache.empty === column.emptyValue
    )
      return cache.text;
    let text: string;
    try {
      if (column.formatter) {
        const result = column.formatter(value, { currency: options.currency ?? 'CNY' });
        if (typeof result !== 'string' && typeof result !== 'number')
          throw new Error('formatter 只能返回文本或数字');
        text = String(result);
      } else if (column.format === 'amount' && Number.isFinite(Number(value)))
        text = amountFormatter.format(Number(value));
      else text = textValue(value);
    } catch (error) {
      report(error);
      text = textValue(value);
    }
    formatCache.set(key, {
      value,
      fn: column.formatter,
      format: column.format,
      empty: column.emptyValue,
      text,
    });
    return text;
  }
  function target(cell: CellRef): CellTarget | null {
    const anchor = view.anchorOf(cell.row, cell.col),
      row = view.rows[anchor.row],
      column = view.columns[anchor.col];
    if (!row || !column) return null;
    const span = view.spanOf(anchor);
    if (
      row.kind === 'record' &&
      row.layout &&
      (!span?.layout ||
        (!span.layout.field && (span.layout.content || span.layout.render || span.layout.range)))
    )
      return null;
    if (row.kind === 'record')
      return { kind: 'record', rowKey: row.rowKey, field: span?.field ?? column.field };
    const definition = model.getConfig().derivedRows?.find((rule) => rule.id === row.ruleKey)
      ?.cells[column.field];
    return {
      kind: 'derived',
      ruleKey: row.ruleKey,
      groupKey: row.groupKey,
      field: definition?.type === 'input' ? definition.field : column.field,
    };
  }
  function behavior(cell: CellRef, name: keyof CellBehaviors): boolean {
    const row = view.rows[cell.row],
      column = view.columns[cell.col],
      span = view.spanOf(cell);
    if (!row || !column) return false;
    if (name === 'editable') {
      const cellTarget = target(cell);
      return cellTarget !== null && model.canWrite(cellTarget);
    }
    const override = span?.layout?.behaviors?.[name];
    if (override !== undefined) return override;
    if (row.kind === 'record' && row.layout && !span?.layout) return false;
    if (row.kind === 'derived' && ['pasteable', 'columnSelectable', 'menuable'].includes(name))
      return false;
    return column[name] !== false;
  }
  function fixed(node: HTMLElement, column?: ColumnDef<TRow>): void {
    if (column?.fixed) node.dataset.fixed = column.fixed;
  }
  function fillCols(group: HTMLTableColElement): void {
    group.replaceChildren();
    for (const width of [...(numbers() ? [numbers()] : []), ...view.widths]) {
      const col = el('col');
      col.style.width = `${width}px`;
      group.append(col);
    }
  }
  function buildHeader(): void {
    headerAbort.abort();
    headerAbort = new AbortController();
    fillCols(headCols);
    fillCols(bodyCols);
    const tr = el('tr');
    if (numbers()) {
      const th = el('th', 'et-row-number', '#');
      th.dataset.fixed = 'left';
      th.setAttribute('aria-label', '全选');
      th.addEventListener('click', () => headerHook(-1), { signal: headerAbort.signal });
      tr.append(th);
    }
    for (const [index, column] of view.columns.entries()) {
      const th = el('th', 'et-header-cell');
      const title = el('span', 'et-header-title', column.title);
      th.append(title);
      th.scope = 'col';
      th.dataset.field = column.field;
      fixed(th, column);
      th.style.textAlign = column.align ?? 'left';
      th.addEventListener('click', () => headerHook(index), { signal: headerAbort.signal });
      if (column.resizable !== false) {
        const handle = el('span', 'et-resize-handle');
        handle.setAttribute('role', 'separator');
        handle.setAttribute('aria-label', `调整${column.title}列宽`);
        handle.addEventListener('click', (event) => event.stopPropagation(), {
          signal: headerAbort.signal,
        });
        handle.addEventListener('pointerdown', (event) => resize(event, column), {
          signal: headerAbort.signal,
        });
        th.append(handle);
      }
      tr.append(th);
    }
    thead.replaceChildren(tr);
    headTable.style.width = `${totalWidth()}px`;
    bodyTable.style.width = `${totalWidth()}px`;
    canvas.style.width = '100%';
    root.style.setProperty('--edit-table-row-height', `${rowHeight()}px`);
    body.setAttribute('aria-colcount', String(view.columns.length));
    body.setAttribute('aria-rowcount', String(view.rows.length));
  }
  function resize(event: PointerEvent, column: ColumnDef<TRow>): void {
    event.preventDefault();
    event.stopPropagation();
    const start = event.clientX,
      original = view.widths[view.columns.findIndex((item) => item.field === column.field)] ?? 140,
      guide = el('div', 'et-resize-guide');
    root.append(guide);
    const bounds = root.getBoundingClientRect();
    const move = (ev: PointerEvent): void => {
      guide.style.left = `${ev.clientX - bounds.left}px`;
    };
    move(event);
    const release = (ev: PointerEvent): void => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', release);
      guide.remove();
      if (!destroyed) setWidth(column.field, original + ev.clientX - start);
    };
    document.addEventListener('pointermove', move, { signal: dispose.signal });
    document.addEventListener('pointerup', release, { once: true, signal: dispose.signal });
  }
  function setWidth(field: string, width: number): void {
    const column = model.getConfig().columns.find((col) => col.field === field);
    if (!column || !Number.isFinite(width) || destroyed) return;
    const value = Math.round(
      Math.max(column.minWidth ?? 40, Math.min(column.maxWidth ?? 2000, width)),
    );
    widths.set(field, value);
    refresh(true);
    model.bus.emit('columnResize', { field, width: value });
  }
  const appearanceCache = new Map<
    string,
    {
      row: Readonly<TRow>;
      version: number;
      style: import('../types').CellStyle | undefined;
      className: string | undefined;
    }
  >();
  function applyAppearance(node: HTMLElement, cell: CellRef): void {
    const row = view.rows[cell.row],
      column = view.columns[cell.col];
    if (!row || !column) return;
    node.style.textAlign = column.align ?? 'left';
    if (row.kind !== 'record') return;
    const layoutStyle = view.spanOf(cell)?.layout;
    if (
      !column.cellStyle &&
      !column.cellClassName &&
      !layoutStyle?.cellStyle &&
      !layoutStyle?.cellClassName
    )
      return;
    const data = model.getState().entries[row.sourceIndex]?.row;
    if (!data) return;
    const key = JSON.stringify([row.rowKey, column.field]),
      layout = view.spanOf(cell)?.layout;
    let cached = appearanceCache.get(key);
    if (!cached || cached.row !== data || cached.version !== configVersion) {
      const context = {
        value: rawValue(cell),
        row: data,
        field: column.field,
        column,
        rowIndex: row.sourceIndex,
      };
      const style =
        layout?.cellStyle ??
        (typeof column.cellStyle === 'function' ? column.cellStyle(context) : column.cellStyle);
      const className =
        layout?.cellClassName ??
        (typeof column.cellClassName === 'function'
          ? column.cellClassName(context)
          : column.cellClassName);
      validateStyle(style, `cellStyle.${column.field}`);
      validateClass(className, `cellClassName.${column.field}`);
      cached = { row: data, version: configVersion, style, className };
      appearanceCache.set(key, cached);
    }
    for (const [key, value] of Object.entries(cached.style ?? {})) {
      if (key.startsWith('--')) node.style.setProperty(key, String(value));
      else
        Reflect.set(
          node.style,
          key,
          typeof value === 'number' && ['fontSize', 'lineHeight', 'padding'].includes(key)
            ? `${value}px`
            : String(value),
        );
    }
    if (cached.className) node.classList.add(...cached.className.split(/\s+/).filter(Boolean));
  }
  function rowIdentity(row: VisualRow): string {
    return row.kind === 'record' ? row.rowKey : JSON.stringify([row.ruleKey, row.groupKey]);
  }
  let errorSnapshot: readonly ValidationError[] | undefined;
  const errorsByCell = new Map<string, ValidationError>();
  const errorStamps = new Map<string, string>();
  let pendingSnapshot: ReadonlySet<string> = new Set();
  const pendingStamps = new Map<string, string>();
  function syncStatus(): void {
    const nextErrors = model.getErrors();
    if (nextErrors !== errorSnapshot) {
      errorSnapshot = nextErrors;
      errorsByCell.clear();
      errorStamps.clear();
      for (const error of nextErrors)
        if (error.target) {
          const key = targetKey(error.target),
            row = rowTargetKey(error.target);
          errorsByCell.set(key, error);
          errorStamps.set(row, (errorStamps.get(row) ?? '') + JSON.stringify([key, error.message]));
        }
    }
    const nextPending = model.getPending();
    if (nextPending !== pendingSnapshot) {
      pendingSnapshot = nextPending;
      pendingStamps.clear();
      for (const key of nextPending)
        if (key !== '*') {
          const parts: unknown = JSON.parse(key);
          if (Array.isArray(parts)) {
            const row = JSON.stringify(parts.slice(0, -1));
            pendingStamps.set(row, (pendingStamps.get(row) ?? '') + key);
          }
        }
    }
  }
  function renderRow(row: VisualRow, reuse?: RenderedRow): RenderedRow {
    const data = row.kind === 'record' ? model.getState().entries[row.sourceIndex]?.row : row;
    const rowKey = rowTargetKey(row);
    const stamp = `${configVersion}:${errorStamps.get(rowKey) ?? ''}:${pendingSnapshot.has('*')}:${pendingStamps.get(rowKey) ?? ''}:${row.kind === 'record' && model.getLocked().has(row.rowKey)}:${pinnedIds.has(rowKey)}`;
    if (reuse && reuse.identity === rowIdentity(row) && reuse.row === data && reuse.stamp === stamp)
      return reuse;
    const current = reuse ?? {
      tr: el('tr'),
      identity: '',
      cleanups: [],
      row: undefined,
      stamp: '',
    };
    const previousCells = Array.from(current.tr.cells);
    const numberOffset = numbers() ? 1 : 0;
    // 普通记录保留单元格和文本容器；布局变化或派生行仍按完整结构重新生成。
    const reuseCells =
      row.kind === 'record' &&
      !row.layout &&
      !current.layout &&
      current.tr.dataset.kind === 'record' &&
      current.stamp.startsWith(`${configVersion}:`) &&
      previousCells.length === view.columns.length + numberOffset &&
      previousCells
        .slice(numberOffset)
        .every(
          (cell, index) => cell.colSpan === 1 && cell.dataset.field === view.columns[index]?.field,
        );
    for (const cleanup of current.cleanups) {
      try {
        cleanup();
      } catch (error) {
        report(error);
      }
    }
    current.cleanups = [];
    if (!reuseCells) current.tr.replaceChildren();
    current.identity = rowIdentity(row);
    current.row = data;
    current.layout = row.kind === 'record' ? row.layout : undefined;
    current.stamp = stamp;
    const tr = current.tr;
    tr.dataset.viewIndex = String(row.viewIndex);
    tr.dataset.kind = row.kind;
    tr.dataset.pinned = String(pinnedIds.has(rowTargetKey(row)));
    tr.className =
      row.kind === 'derived'
        ? 'et-derived-row'
        : model.getLocked().has(row.rowKey)
          ? 'et-locked-row'
          : '';
    tr.style.height = `${model.getConfig().rowHeight === 'auto' ? rowHeight() : view.metrics.height(row.viewIndex)}px`;
    tr.setAttribute('aria-rowindex', String(row.viewIndex + 1));
    if (numbers()) {
      const td = reuseCells ? previousCells[0]! : el('td', 'et-row-number');
      const text = String(row.viewIndex + 1),
        pinnedRow = pinnedIds.has(rowTargetKey(row));
      td.setAttribute('role', 'rowheader');
      td.setAttribute('aria-label', `选择第 ${text} 行${pinnedRow ? '，已固定' : ''}`);
      td.title = `第 ${text} 行${pinnedRow ? ' · 已固定' : ''}`;
      if (pinnedRow) {
        const mark = el('span', 'et-row-pin-marker', '⌖');
        mark.setAttribute('aria-hidden', 'true');
        td.replaceChildren(mark, el('span', 'et-row-index', text));
      } else if (td.textContent !== text || td.querySelector('.et-row-pin-marker'))
        td.textContent = text;
      td.dataset.fixed = 'left';
      if (!reuseCells) tr.append(td);
    }
    for (let col = 0; col < view.columns.length; col++) {
      const column = view.columns[col]!,
        cell = { row: row.viewIndex, col },
        span = view.spanOf(cell);
      if (span?.kind === 'layout' && col > span.col) continue;
      const td = reuseCells ? previousCells[col + numberOffset]! : el('td', 'et-cell');
      td.className = 'et-cell';
      td.removeAttribute('aria-invalid');
      td.removeAttribute('aria-busy');
      td.removeAttribute('title');
      delete td.dataset.tooltip;
      if (column.cellStyle) td.removeAttribute('style');
      if (!reuseCells) {
        td.dataset.field = column.field;
        td.setAttribute('role', 'gridcell');
        fixed(td, column);
      }
      const align = column.align ?? 'left';
      if (td.style.textAlign !== align) td.style.textAlign = align;
      td.classList.toggle('et-merge-placeholder', Boolean(span && span.end > span.start));
      if (span?.kind === 'layout') td.colSpan = span.colSpan;
      if (span && span.end > span.start) {
        if (td.childNodes.length) td.replaceChildren();
        if (!reuseCells) tr.append(td);
        continue;
      }
      const cellTarget = target(cell),
        editable = cellTarget && model.canWrite(cellTarget);
      td.classList.toggle('et-readonly', !editable);
      const error = cellTarget ? errorsByCell.get(targetKey(cellTarget)) : undefined;
      td.classList.toggle('et-invalid', Boolean(error));
      const pending = Boolean(
        cellTarget &&
        (model.getPending().has('*') || model.getPending().has(targetKey(cellTarget))),
      );
      td.classList.toggle('et-validating', pending);
      td.setAttribute('aria-busy', String(pending));
      if (error) {
        td.setAttribute('aria-invalid', 'true');
        td.title = error.message;
      } else {
        td.removeAttribute('aria-invalid');
        td.removeAttribute('title');
      }
      const existingContent = td.firstElementChild;
      const content =
        existingContent instanceof HTMLDivElement && existingContent.className === 'et-cell-content'
          ? existingContent
          : el('div', 'et-cell-content');
      const value = rawValue(cell);
      try {
        if (row.kind === 'record' && data) {
          const context = {
            value,
            row: data as Readonly<TRow>,
            field: column.field,
            column,
            rowIndex: row.sourceIndex,
          };
          applyAppearance(td, cell);
          const comment = column.comment?.(data as Readonly<TRow>, context);
          td.classList.toggle('et-comment', Boolean(comment));
          if (comment) {
            td.dataset.tooltip = comment;
            td.title = error?.message ?? comment;
          } else delete td.dataset.tooltip;
          const render = span?.layout?.render;
          if (render || column.render) content.replaceChildren();
          const cleanup = render
            ? render(content, data)
            : span?.layout?.content
              ? undefined
              : column.render?.(value, data as Readonly<TRow>, model.getState().rows, content);
          if (cleanup) current.cleanups.push(cleanup);
          if (span?.layout?.content || (!render && !column.render)) {
            const text = display(cell);
            if (content.textContent !== text) content.textContent = text;
          }
        } else content.textContent = display(cell);
      } catch (error) {
        report(error);
        content.textContent = textValue(value);
      }
      if (!td.title && column.overflowTooltip !== false) td.title = display(cell);
      if (editable && row.kind === 'derived') td.classList.add('et-derived-input');
      if (content.parentNode !== td) td.replaceChildren(content);
      if (!reuseCells) tr.append(td);
    }
    return current;
  }
  function spacer(height: number): HTMLTableRowElement {
    const tr = el('tr', 'et-spacer');
    tr.setAttribute('aria-hidden', 'true');
    const td = el('td');
    td.colSpan = view.columns.length + (numbers() ? 1 : 0);
    td.style.height = `${Math.max(0, height)}px`;
    tr.append(td);
    return tr;
  }
  function renderWindow(force = false): void {
    syncStatus();
    const config = model.getConfig(),
      setting = config.virtualization,
      threshold = typeof setting === 'object' ? (setting.threshold ?? 200) : 200,
      overscan = typeof setting === 'object' ? (setting.overscan ?? 8) : 8;
    const virtual = setting !== false && view.rows.length >= threshold;
    const start = virtual ? Math.max(0, view.metrics.rowAtOffset(scrollY) - overscan) : 0,
      end = virtual
        ? Math.min(
            view.rows.length,
            view.metrics.rowAtOffset(scrollY + viewportHeight) + overscan + 1,
          )
        : view.rows.length;
    if (!force && start === lastStart && end === lastEnd) {
      renderOverlays();
      return;
    }
    lastStart = start;
    lastEnd = end;
    const indices = Array.from({ length: Math.max(0, end - start) }, (_, index) => start + index);
    if (editing && (editing.row < start || editing.row >= end) && view.rows[editing.row])
      indices.push(editing.row);
    indices.sort((a, b) => a - b);
    const keep = new Set(indices);
    for (const [index, row] of activeRows)
      if (!keep.has(index)) {
        activeRows.delete(index);
        row.tr.remove();
        pool.push(row);
      }
    const desired: HTMLTableRowElement[] = [];
    let last = 0,
      spacerIndex = 0;
    const appendSpacer = (height: number): void => {
      const row = spacerPool[spacerIndex] ?? spacer(0);
      spacerPool[spacerIndex++] = row;
      const cell = row.cells[0]!;
      const colspan = Math.max(1, view.columns.length + (numbers() ? 1 : 0));
      if (cell.colSpan !== colspan) cell.colSpan = colspan;
      const value = `${Math.max(0, height)}px`;
      if (cell.style.height !== value) cell.style.height = value;
      desired.push(row);
    };
    appendSpacer(view.metrics.rowTop(indices[0] ?? 0));
    last = indices[0] ?? 0;
    for (const index of indices) {
      if (index > last) appendSpacer(view.metrics.rowTop(index) - view.metrics.rowTop(last));
      const row = renderRow(view.rows[index]!, activeRows.get(index) ?? pool.pop());
      activeRows.set(index, row);
      desired.push(row.tr);
      last = index + 1;
    }
    appendSpacer(view.metrics.total() - view.metrics.rowTop(last));
    // 先移除离窗节点，再只插入新进入窗口的行，交集内的行不脱离 DOM。
    const wanted = new Set(desired);
    for (const child of Array.from(tbody.children))
      if (child instanceof HTMLTableRowElement && !wanted.has(child)) child.remove();
    let cursor = tbody.firstChild;
    for (const row of desired) {
      if (cursor === row) cursor = cursor.nextSibling;
      else tbody.insertBefore(row, cursor);
    }
    canvas.style.height = `${view.metrics.total()}px`;
    if (config.rowHeight === 'auto') {
      const anchorIndex = view.metrics.rowAtOffset(scrollY),
        anchorOffset = scrollY - view.metrics.rowTop(anchorIndex);
      let changed = false;
      for (const [index, row] of activeRows) {
        const measured = Math.max(rowHeight(), Math.ceil(row.tr.getBoundingClientRect().height));
        if (Math.abs(measured - view.metrics.height(index)) > 1) {
          view.metrics.setHeight(index, measured);
          changed = true;
        }
      }
      if (changed) {
        scrollY = view.metrics.rowTop(anchorIndex) + anchorOffset;
        body.scrollTop = scrollY;
        queueMicrotask(() => {
          if (!destroyed) {
            lastStart = -1;
            renderWindow();
          }
        });
      }
    }
    if (
      appearanceCache.size >
      (activeRows.size + pins.length + 1) * Math.max(1, view.columns.length) * 2
    ) {
      const visible = new Set([...activeRows.values()].map((row) => row.identity));
      for (const target of pins) if (target.kind === 'record') visible.add(target.rowKey);
      for (const [key] of appearanceCache) {
        const identity: unknown = JSON.parse(key);
        if (Array.isArray(identity) && !visible.has(String(identity[0])))
          appearanceCache.delete(key);
      }
    }
    renderOverlays();
  }
  function columnX(col: number): number {
    const column = view.columns[col]!,
      x = numbers() + view.lefts[col]!;
    return column.fixed === 'left'
      ? x
      : column.fixed === 'right'
        ? x + viewportWidth - totalWidth()
        : x - horizontal.scrollLeft;
  }
  /** 返回固定列与滚动列的视口交界，供表头和覆盖层共用裁剪边界。 */
  function columnBounds(): { left: number; right: number } {
    return {
      left:
        numbers() +
        view.columns.reduce((sum, col, i) => sum + (col.fixed === 'left' ? view.widths[i]! : 0), 0),
      right:
        viewportWidth -
        view.columns.reduce(
          (sum, col, i) => sum + (col.fixed === 'right' ? view.widths[i]! : 0),
          0,
        ),
    };
  }
  function segments(
    layer: HTMLElement,
    retained?: Map<string, HTMLDivElement>,
  ): Map<string, HTMLDivElement> {
    if (!retained) layer.replaceChildren();
    // 内容区本身不原生横滚，固定覆盖层直接使用视口坐标，无需追赶滚动补偿。
    layer.style.left = '0px';
    // 合并层使用正文坐标，垂直滚动交给浏览器；选区层仍按视口绘制。
    const followsBody = layer === mergeLayer;
    layer.style.top = followsBody ? '0px' : `${scrollY}px`;
    layer.style.width = `${viewportWidth}px`;
    layer.style.height = `${followsBody ? view.metrics.total() : viewportHeight}px`;
    const { left, right } = columnBounds();
    const result = retained ?? new Map<string, HTMLDivElement>();
    for (const [name, x, width] of [
      ['center', left, Math.max(0, right - left)],
      ['left', 0, left],
      ['right', right, viewportWidth - right],
    ] satisfies [string, number, number][]) {
      let part = result.get(name);
      if (!part) {
        part = el('div', 'et-layer-segment');
        part.dataset.segment = name;
        layer.append(part);
        result.set(name, part);
      }
      part.style.left = `${x}px`;
      part.style.width = `${width}px`;
    }
    return result;
  }
  function cleanupMerge(merged: RenderedMerge): void {
    try {
      merged.cleanup?.();
    } catch (error) {
      report(error);
    }
    merged.cleanup = undefined;
  }
  function renderOverlays(): void {
    // 与正文窗口共用预渲染范围，避免新合并块刚进入视口时才创建。
    const start = Math.max(0, lastStart),
      end = Math.max(start, lastEnd - 1);
    const spans = view.intersecting(start, end);
    if (!spans.length) {
      if (mergeLayer.childNodes.length) mergeLayer.replaceChildren();
      for (const merged of mergedCells.values()) cleanupMerge(merged);
      mergedCells.clear();
      mergeSegments.clear();
      renderSelection(selection);
      return;
    }
    const parts = segments(mergeLayer, mergeSegments),
      visible = new Set<string>();
    for (const span of spans) {
      const column = view.columns[span.col]!,
        row = view.rows[span.start]!,
        part = parts.get(column.fixed ?? 'center')!,
        key = JSON.stringify([rowTargetKey(row), column.field]),
        data = row.kind === 'record' ? model.getState().entries[row.sourceIndex]?.row : row;
      visible.add(key);
      // 保留可见合并格及其文字，内容固定居中于完整合并块，随正文自然滚动。
      let merged = mergedCells.get(key);
      if (!merged) {
        const node = el('div', 'et-merged-cell'),
          content = el('div', 'et-merged-content');
        node.dataset.field = column.field;
        node.setAttribute('role', 'gridcell');
        node.append(content);
        merged = {
          node,
          content,
          cell: { row: span.start, col: span.col },
          row: undefined,
          version: -1,
        };
        mergedCells.set(key, merged);
      }
      const { node, content } = merged;
      merged.cell = { row: span.start, col: span.col };
      if (merged.row !== data || merged.version !== configVersion) {
        cleanupMerge(merged);
        node.className = 'et-merged-cell';
        node.removeAttribute('style');
        try {
          applyAppearance(node, merged.cell);
          content.replaceChildren();
          if (row.kind === 'record' && data) {
            const recordRow = data as Readonly<TRow>;
            merged.comment = column.comment?.(recordRow, {
              value: rawValue(merged.cell),
              row: recordRow,
              field: column.field,
              column,
              rowIndex: row.sourceIndex,
            });
            merged.cleanup =
              column.render?.(rawValue(merged.cell), recordRow, model.getState().rows, content) ||
              undefined;
          }
          if (row.kind !== 'record' || !column.render) content.textContent = display(merged.cell);
        } catch (error) {
          report(error);
          content.textContent = display(merged.cell);
        }
        merged.row = data;
        merged.version = configVersion;
      }
      node.setAttribute('aria-rowspan', String(span.end - span.start + 1));
      node.setAttribute('aria-rowindex', String(span.start + 1));
      node.setAttribute('aria-colindex', String(span.col + 1));
      const mergedTarget = target({ row: span.start, col: span.col });
      const issue = mergedTarget ? errorsByCell.get(targetKey(mergedTarget)) : undefined;
      node.classList.toggle('et-invalid', Boolean(issue));
      node.classList.toggle('et-comment', Boolean(merged.comment));
      node.classList.toggle(
        'et-validating',
        Boolean(
          mergedTarget &&
          (pendingSnapshot.has('*') || pendingSnapshot.has(targetKey(mergedTarget))),
        ),
      );
      if (merged.comment) node.dataset.tooltip = merged.comment;
      else delete node.dataset.tooltip;
      if (issue) {
        node.setAttribute('aria-invalid', 'true');
        node.title = issue.message;
      } else {
        node.removeAttribute('aria-invalid');
        if (merged.comment) node.title = merged.comment;
        else node.removeAttribute('title');
      }
      node.setAttribute(
        'aria-busy',
        String(
          Boolean(
            mergedTarget &&
            (model.getPending().has('*') || model.getPending().has(targetKey(mergedTarget))),
          ),
        ),
      );
      const top = view.metrics.rowTop(span.start),
        bottom = view.metrics.rowTop(span.end + 1);
      node.style.left = `${columnX(span.col) - Number.parseFloat(part.style.left)}px`;
      node.style.top = `${top}px`;
      node.style.width = `${view.widths[span.col]}px`;
      node.style.height = `${bottom - top}px`;
      if (node.parentNode !== part) part.append(node);
    }
    for (const [key, merged] of mergedCells)
      if (!visible.has(key)) {
        cleanupMerge(merged);
        merged.node.remove();
        mergedCells.delete(key);
      }
    renderSelection(selection);
  }
  function renderSelection(next: SelectionSnapshot): void {
    const hadSelection = selection.active !== null || selection.ranges.length > 0;
    selection = next;
    const pinnedIndex = pins.length ? indexOfTarget(pins[0]!) : -1;
    for (const merged of mergedCells.values()) {
      const activeSpan = next.active ? view.spanOf(next.active) : undefined;
      const activeRow = activeSpan?.start ?? next.active?.row;
      merged.node.classList.toggle(
        'et-diff',
        Boolean(
          model.getConfig().pinnedDiff &&
          next.mode !== 'column' &&
          activeRow === merged.cell.row &&
          pinnedIndex >= 0 &&
          display(merged.cell) !== display({ row: pinnedIndex, col: merged.cell.col }),
        ),
      );
    }
    headSelection.replaceChildren();
    pinnedSelection.replaceChildren();
    // 顶边落在视口起点时，由表头底部补画，避免被正文的滚动裁剪区截掉。
    root.dataset.rowSelectionTop = String(
      next.mode === 'row' &&
        next.ranges.some(
          (range) =>
            Math.abs(view.metrics.rowTop(Math.min(range.anchor.row, range.focus.row)) - scrollY) <
            0.01,
        ),
    );
    for (const [index, th] of thead.querySelectorAll('.et-header-cell').entries()) {
      const selected = next.mode === 'column' && next.active?.col === index;
      th.classList.toggle('et-column-selected', selected);
      th.setAttribute('aria-selected', String(selected));
      if (selected && th instanceof HTMLElement) {
        const column = view.columns[index]!,
          bounds = columnBounds(),
          start =
            column.fixed === 'left' ? 0 : column.fixed === 'right' ? bounds.right : bounds.left,
          end =
            column.fixed === 'left'
              ? bounds.left
              : column.fixed === 'right'
                ? viewportWidth
                : bounds.right,
          x = columnX(index);
        // 高亮可覆盖本列左、上网格线，但不得越过固定行号或固定列的分区。
        th.style.clipPath = `inset(-1px ${Math.max(0, x + view.widths[index]! - end)}px 0px ${Math.max(-1, start - 1 - x)}px)`;
        if (pins.length) {
          // 固定副本只延续整列的视觉边框，不增加逻辑选区或 aria-selected 状态。
          // 管理栏保持原底色和交互，仅让两侧边线衔接正文选框。
          const frame = el('div', 'et-selection et-column-selection et-pinned-column-selection'),
            top = headTable.offsetTop + thead.offsetHeight,
            height = pinned.offsetHeight;
          frame.style.left = `${x - 1}px`;
          frame.style.top = `${top}px`;
          frame.style.width = `${view.widths[index]! + 1}px`;
          frame.style.height = `${head.clientHeight - top}px`;
          frame.style.background = `linear-gradient(to bottom, var(--edit-table-selected-bg) ${height}px, transparent ${height}px)`;
          frame.style.clipPath = `inset(0px ${Math.max(0, x + view.widths[index]! - end)}px 0px ${Math.max(0, start - x)}px)`;
          pinnedSelection.append(frame);
        }
      } else if (th instanceof HTMLElement) th.style.removeProperty('clip-path');
    }
    if (!next.active && !next.ranges.length) {
      if (selectLayer.childNodes.length) selectLayer.replaceChildren();
      if (hadSelection) {
        for (const row of activeRows.values()) {
          row.tr.classList.remove('et-active-row', 'et-row-selected');
          row.tr.removeAttribute('aria-selected');
          for (const cell of row.tr.querySelectorAll('.et-diff')) cell.classList.remove('et-diff');
        }
      }
      return;
    }
    const parts = segments(selectLayer);
    for (const part of parts.values()) {
      const left = Number.parseFloat(part.style.left);
      if (left > 0) {
        // 所有选框均覆盖前一格的右边框，分区裁剪需保留这一个网格像素。
        part.style.left = `${left - 1}px`;
        part.style.width = `${Number.parseFloat(part.style.width) + 1}px`;
      }
    }
    if (next.mode === 'row') {
      // 行号与左中右分区使用一个视口选框，避免固定列边界出现额外竖边。
      selectLayer.replaceChildren();
      for (const range of next.ranges) {
        const top = Math.min(range.anchor.row, range.focus.row),
          bottom = Math.max(range.anchor.row, range.focus.row);
        const node = el('div', 'et-selection et-row-selection');
        node.style.background = `linear-gradient(to right, transparent ${numbers()}px, var(--edit-table-selected-bg) ${numbers()}px)`;
        node.style.left = '0px';
        // 上边网格线属于上一行的底边框，向上覆盖该像素并保持底边不变。
        node.style.top = `${view.metrics.rowTop(top) - scrollY - 1}px`;
        node.style.width = `${viewportWidth}px`;
        node.style.height = `${view.metrics.rowTop(bottom + 1) - view.metrics.rowTop(top) + 1}px`;
        selectLayer.append(node);
      }
    }
    const draw = (range: CellRange, active: boolean): void => {
      const top = Math.min(range.anchor.row, range.focus.row),
        bottom = Math.max(range.anchor.row, range.focus.row),
        from = Math.min(range.anchor.col, range.focus.col),
        to = Math.max(range.anchor.col, range.focus.col);
      let col = from;
      while (col <= to) {
        const column = view.columns[col];
        if (!column) break;
        let end = col;
        while (end + 1 <= to && view.columns[end + 1]?.fixed === column.fixed) end++;
        const part = parts.get(column.fixed ?? 'center')!,
          node = el(
            'div',
            active
              ? 'et-active-cell'
              : next.mode === 'column'
                ? 'et-selection et-column-selection'
                : 'et-selection',
          );
        // 左、上网格线属于相邻格的边框；向左上覆盖，右、下边界保持不变。
        // 整列顶部由已高亮的表头衔接，正文无需另画上边。
        const topOffset = next.mode === 'column' ? 0 : 1;
        node.style.left = `${columnX(col) - Number.parseFloat(part.style.left) - 1}px`;
        node.style.top = `${view.metrics.rowTop(top) - scrollY - topOffset}px`;
        node.style.width = `${view.lefts[end]! + view.widths[end]! - view.lefts[col]! + 1}px`;
        node.style.height = `${view.metrics.rowTop(bottom + 1) - view.metrics.rowTop(top) + topOffset}px`;
        part.append(node);
        if (!next.mode && Math.abs(view.metrics.rowTop(top) - scrollY) < 0.01) {
          // 第一条可见网格线位于表头底部，不能交给正文裁剪区绘制。
          const left = Math.max(0, columnX(col) - 1, Number.parseFloat(part.style.left)),
            right = Math.min(
              columnX(end) + view.widths[end]!,
              Number.parseFloat(part.style.left) + Number.parseFloat(part.style.width),
            );
          if (right > left) {
            const edge = el('div', 'et-head-selection-edge');
            edge.style.left = `${left}px`;
            edge.style.width = `${right - left}px`;
            headSelection.append(edge);
          }
        }
        col = end + 1;
      }
    };
    if (next.mode === 'column' && next.active && view.rows.length) {
      // 整列的视觉选框贯穿小计行，实际可操作范围仍由分段 ranges 控制。
      draw(
        {
          anchor: { row: 0, col: next.active.col },
          focus: { row: view.rows.length - 1, col: next.active.col },
        },
        false,
      );
    } else if (next.mode !== 'row') for (const range of next.ranges) draw(range, false);
    if (next.active && !next.mode) {
      const span = view.spanOf(next.active);
      draw(
        {
          anchor: next.active,
          focus: {
            row: span?.end ?? next.active.row,
            col: next.active.col + (span?.colSpan ?? 1) - 1,
          },
        },
        true,
      );
    }
    for (const [index, row] of activeRows) {
      if (
        next.mode === 'column' ||
        index !== next.active?.row ||
        !pins.length ||
        !model.getConfig().pinnedDiff
      )
        for (const cell of row.tr.querySelectorAll('.et-diff')) cell.classList.remove('et-diff');
    }
    for (const [index, row] of activeRows) {
      row.tr.classList.toggle(
        'et-active-row',
        next.mode !== 'column' && index === next.active?.row,
      );
      const selected =
        next.mode === 'row' &&
        next.ranges.some(
          (range) =>
            index >= Math.min(range.anchor.row, range.focus.row) &&
            index <= Math.max(range.anchor.row, range.focus.row),
        );
      row.tr.classList.toggle('et-row-selected', selected);
      if (next.mode === 'row') row.tr.setAttribute('aria-selected', String(selected));
      else row.tr.removeAttribute('aria-selected');
    }
    if (next.mode !== 'column' && model.getConfig().pinnedDiff && next.active && pins.length) {
      const pinnedIndex = indexOfTarget(pins[0]!);
      const row = activeRows.get(next.active.row);
      if (row && pinnedIndex >= 0)
        for (const td of row.tr.querySelectorAll<HTMLTableCellElement>('td[data-field]')) {
          const col = view.columns.findIndex((c) => c.field === td.dataset.field);
          td.classList.toggle(
            'et-diff',
            col >= 0 &&
              display({ row: next.active.row, col }) !== display({ row: pinnedIndex, col }),
          );
        }
    }
  }
  function wheel(event: WheelEvent): void {
    if (event.ctrlKey || event.metaKey) return;
    // 滚动条上的不可取消事件由原生控件处理；正文已禁止原生横滚，可安全转发惯性增量。
    if (!event.cancelable && event.currentTarget === horizontal) return;
    const shifted = event.shiftKey && event.deltaX === 0,
      dx = shifted ? event.deltaY : event.deltaX,
      dy = shifted ? 0 : event.deltaY,
      maxX = horizontal.scrollWidth - horizontal.clientWidth;
    if (!dx || maxX <= 0) return;
    const line = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? rowHeight() : 1,
      xUnit = event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? viewportWidth : line,
      yUnit = event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? viewportHeight : line;
    // 横向原生滚动只作用于空滚动条，内容在同一轮更新中定位，固定列从不被先移走。
    // 混合方向手势同时应用纵向增量，纯纵向与缩放手势仍交给浏览器处理。
    if (event.cancelable) event.preventDefault();
    horizontal.scrollLeft = Math.max(0, Math.min(maxX, horizontal.scrollLeft + dx * xUnit));
    if (dy && event.defaultPrevented) body.scrollTop += dy * yUnit;
    sync();
  }
  function indexOfTarget(target: RowTarget): number {
    return view.targetView(target);
  }
  function getPinned(): PinnedRowInfo[] {
    return pins.map((target) => {
      const index = indexOfTarget(target);
      return {
        target,
        viewIndex: index,
        texts: Object.fromEntries(
          view.columns.map((col, i) => [col.field, display({ row: index, col: i }, true)]),
        ),
      };
    });
  }
  function renderPinned(): void {
    const actionHosts = new Map<string, HTMLElement>();
    const valid = pins.filter((target) => indexOfTarget(target) >= 0);
    if (valid.length !== pins.length) {
      pins = valid;
      model.bus.emit('pinnedRowsChange', { rows: getPinned() });
    }
    pinnedIds = new Set(pins.map(rowTargetKey));
    for (const key of selectedPins) if (!pinnedIds.has(key)) selectedPins.delete(key);
    pinManager.hidden = !pins.length;
    pinManager.replaceChildren();
    if (pins.length) {
      pinManager.append(el('span', 'et-pinned-count', `已固定 ${pins.length} 行`));
      const removeSelected = el('button', '', '取消选中固定');
      removeSelected.type = 'button';
      removeSelected.disabled = !selectedPins.size;
      const remove = (targets: readonly RowTarget[]): void => {
        for (const target of targets) unpinHook(target);
        body.focus({ preventScroll: true });
      };
      for (const target of pins) {
        const key = rowTargetKey(target),
          label = el('label', 'et-pinned-choice'),
          input = el('input');
        input.type = 'checkbox';
        input.checked = selectedPins.has(key);
        input.setAttribute('aria-label', `选择固定的第 ${indexOfTarget(target) + 1} 行`);
        input.addEventListener('change', () => {
          if (input.checked) selectedPins.add(key);
          else selectedPins.delete(key);
          removeSelected.disabled = !selectedPins.size;
        });
        label.append(input, document.createTextNode(`第 ${indexOfTarget(target) + 1} 行`));
        if (numbers()) pinManager.append(label);
        else {
          const entry = el('div', 'et-pinned-entry');
          entry.append(label);
          actionHosts.set(key, entry);
          pinManager.append(entry);
        }
      }
      removeSelected.addEventListener('click', () =>
        remove(pins.filter((target) => selectedPins.has(rowTargetKey(target)))),
      );
      const removeAll = el('button', '', '取消全部固定');
      removeAll.type = 'button';
      removeAll.addEventListener('click', () => remove([...pins]));
      pinManager.append(removeSelected, removeAll);
    }
    pinned.replaceChildren();
    for (const info of getPinned()) {
      const tr = el('tr');
      const controls = el('span', 'et-pin-controls');
      const locate = el('button', '', numbers() ? String(info.viewIndex + 1) : '↗');
      locate.type = 'button';
      locate.title = `定位到第 ${info.viewIndex + 1} 行`;
      locate.setAttribute('aria-label', locate.title);
      locate.addEventListener('click', () => locateHook(info.target));
      const cancel = el('button', '', '×');
      cancel.type = 'button';
      cancel.title = `取消固定第 ${info.viewIndex + 1} 行`;
      cancel.setAttribute('aria-label', cancel.title);
      cancel.addEventListener('click', () => {
        unpinHook(info.target);
        body.focus({ preventScroll: true });
      });
      controls.append(locate, cancel);
      if (!numbers()) actionHosts.get(rowTargetKey(info.target))?.append(controls);
      if (numbers()) {
        const td = el('td', 'et-row-number');
        td.dataset.fixed = 'left';
        td.append(controls);
        tr.append(td);
      }
      for (const [index, column] of view.columns.entries()) {
        const td = el('td', 'et-pinned-cell');
        fixed(td, column);
        try {
          applyAppearance(td, { row: info.viewIndex, col: index });
        } catch (error) {
          report(error);
        }
        const content = el('div', 'et-cell-content', info.texts[column.field]);
        td.title = info.texts[column.field] ?? '';
        td.append(content);
        tr.append(td);
      }
      pinned.append(tr);
    }
  }
  function sync(): void {
    if (destroyed) return;
    scrollY = body.scrollTop;
    const width = totalWidth();
    horizontal.style.width = `${viewportWidth}px`;
    horizontalContent.style.width = `${width}px`;
    horizontal.hidden = width <= viewportWidth;
    const x = horizontal.scrollLeft;
    if (
      !horizontalState ||
      horizontalState[0] !== x ||
      horizontalState[1] !== viewportWidth ||
      horizontalState[2] !== width
    ) {
      // 头表和主体表一起移动，固定单元格在同一次样式提交中抵消该位移。
      // 不再与浏览器异步合成的原生横滚叠加，拖动滑块也不会产生回调前错帧。
      headTable.style.transform = `translateX(${-x}px)`;
      bodyTable.style.transform = `translateX(${-x}px)`;
      root.style.setProperty('--edit-table-fix-left', `${x}px`);
      root.style.setProperty('--edit-table-fix-right', `${x + viewportWidth - width}px`);
      head.style.width = `${viewportWidth}px`;
      root.dataset.scrollLeft = x > 0 ? 'true' : 'false';
      root.dataset.scrollRight = x + viewportWidth < width - 1 ? 'true' : 'false';
      horizontalState = [x, viewportWidth, width];
    }
    renderWindow();
    scrollHook();
  }
  function refresh(rebuild = true): void {
    if (destroyed) return;
    root.dataset.autoHeight = String(model.getConfig().rowHeight === 'auto');
    if (rebuild) {
      const previous = view;
      numberWidth = numberSize();
      const anchorIndex = previous.metrics.rowAtOffset(scrollY),
        anchorRow = previous.rows[anchorIndex],
        anchorOffset = scrollY - previous.metrics.rowTop(anchorIndex);
      if (configVersion > 0)
        view = createView(
          model.getState(),
          model.getConfig(),
          hidden,
          widths,
          rowHeight(),
          model.getMerges(),
          previous,
          Math.max(0, viewportWidth - numbers()),
        );
      if (
        !view.splice &&
        view.metrics.count === previous.metrics.count &&
        view.metrics.estimate === previous.metrics.estimate
      ) {
        for (const index of activeRows.keys())
          if (
            view.rows[index] &&
            previous.rows[index] &&
            rowIdentity(view.rows[index]!) === rowIdentity(previous.rows[index]!)
          )
            view.metrics.setHeight(index, previous.metrics.height(index));
      }
      if (view.metrics.total() > 16_000_000)
        report(new Error('表格总高度超过安全上限，请减小数据规模或采用分批加载'));
      if (configVersion > 0 && anchorRow && view.rows.length) {
        const index = view.targetView(anchorRow);
        if (index >= 0) {
          canvas.style.height = `${view.metrics.total()}px`;
          scrollY =
            view.metrics.rowTop(index) + Math.min(anchorOffset, view.metrics.height(index) - 1);
          body.scrollTop = scrollY;
        }
      }
      derivedPositions = new Map(
        view.extras.map((extra) => [
          JSON.stringify([extra.row.ruleKey, extra.row.groupKey]),
          extra.viewIndex,
        ]),
      );
      body.setAttribute('aria-rowcount', String(view.rows.length));
      body.setAttribute('aria-colcount', String(view.columns.length));
      configVersion++;
      if (!view.splice) buildHeader();
    } else {
      view.projection = model.getState();
      for (const row of model.getState().results) {
        const index = derivedPositions.get(JSON.stringify([row.ruleKey, row.groupKey]));
        if (index !== undefined) view.rows[index] = { ...row, viewIndex: index };
      }
    }
    renderPinned();
    renderWindow(true);
    sync();
  }
  function hit(x: number, y: number): CellRef | null {
    const rect = body.getBoundingClientRect(),
      scaleX = body.offsetWidth ? rect.width / body.offsetWidth : 1,
      scaleY = body.offsetHeight ? rect.height / body.offsetHeight : 1,
      localX = (x - rect.left) / (scaleX || 1),
      localY = (y - rect.top) / (scaleY || 1);
    if (
      localY < 0 ||
      localY >= viewportHeight ||
      localX < 0 ||
      localX >= viewportWidth ||
      !view.rows.length ||
      !view.columns.length
    )
      return null;
    let dataX = localX + horizontal.scrollLeft - numbers();
    const leftWidth =
        numbers() +
        view.columns.reduce((sum, col, i) => sum + (col.fixed === 'left' ? view.widths[i]! : 0), 0),
      rightWidth = view.columns.reduce(
        (sum, col, i) => sum + (col.fixed === 'right' ? view.widths[i]! : 0),
        0,
      );
    if (localX < leftWidth) dataX = localX - numbers();
    else if (localX >= viewportWidth - rightWidth) dataX = view.width - (viewportWidth - localX);
    const row = view.metrics.rowAtOffset(localY + scrollY),
      col = view.colAtOffset(dataX);
    return localX < numbers() ? { row, col: -1 } : view.anchorOf(row, col);
  }
  function rect(cell: CellRef): { left: number; top: number; width: number; height: number } {
    const anchor = view.anchorOf(cell.row, cell.col),
      span = view.spanOf(anchor),
      bounds = body.getBoundingClientRect(),
      scaleX = (body.offsetWidth ? bounds.width / body.offsetWidth : 1) || 1,
      scaleY = (body.offsetHeight ? bounds.height / body.offsetHeight : 1) || 1,
      top = view.metrics.rowTop(anchor.row),
      bottom = view.metrics.rowTop((span?.end ?? anchor.row) + 1),
      visibleTop = Math.max(top, scrollY);
    return {
      // 编辑框与活动单元格共用网格线边界，避免编辑时再次向右下偏移。
      left: bounds.left + (columnX(anchor.col) - 1) * scaleX,
      top: bounds.top + (visibleTop - scrollY - 1) * scaleY,
      width:
        (view.widths
          .slice(anchor.col, anchor.col + (span?.colSpan ?? 1))
          .reduce((sum, v) => sum + v, 0) +
          1) *
        scaleX,
      height:
        (Math.max(rowHeight(), Math.min(bottom, scrollY + viewportHeight) - visibleTop) + 1) *
        scaleY,
    };
  }
  body.addEventListener('scroll', sync, { passive: true, signal: dispose.signal });
  body.addEventListener('wheel', wheel, { passive: false, signal: dispose.signal });
  horizontal.addEventListener('scroll', sync, { passive: true, signal: dispose.signal });
  horizontal.addEventListener('wheel', wheel, { passive: false, signal: dispose.signal });
  const observer = new ResizeObserver(() => {
    const widthChanged = viewportWidth !== body.clientWidth;
    viewportWidth = body.clientWidth;
    viewportHeight = body.clientHeight;
    if (widthChanged) refresh();
    else sync();
  });
  observer.observe(body);
  refresh();
  return {
    root,
    body,
    scrollLeft: () => horizontal.scrollLeft,
    scrollToX(left) {
      horizontal.scrollLeft = left;
      sync();
    },
    scrollBy(dx, dy) {
      horizontal.scrollLeft += dx;
      body.scrollTop += dy;
      sync();
    },
    head,
    popup,
    placePopup,
    content(cell) {
      const anchor = view.anchorOf(cell.row, cell.col),
        row = view.rows[anchor.row],
        column = view.columns[anchor.col];
      if (!row || !column) return null;
      const merged = mergedCells.get(JSON.stringify([rowTargetKey(row), column.field]));
      return (
        merged?.content ??
        body.querySelector<HTMLElement>(
          `tr[data-view-index="${anchor.row}"] [data-field="${CSS.escape(column.field)}"] .et-cell-content`,
        )
      );
    },
    visible(cell) {
      const anchor = view.anchorOf(cell.row, cell.col),
        span = view.spanOf(anchor),
        column = view.columns[anchor.col];
      if (!column || !view.rows[anchor.row]) return false;
      const bounds = columnBounds(),
        x = columnX(anchor.col);
      const width = view.widths
        .slice(anchor.col, anchor.col + (span?.colSpan ?? 1))
        .reduce((total, value) => total + value, 0);
      return (
        view.metrics.rowTop((span?.end ?? anchor.row) + 1) > body.scrollTop &&
        view.metrics.rowTop(anchor.row) < body.scrollTop + viewportHeight &&
        x + width > (column.fixed === 'left' ? 0 : bounds.left) &&
        x < (column.fixed === 'right' ? viewportWidth : bounds.right)
      );
    },
    toolbar,
    numberWidth: numbers,
    view: () => view,
    refresh,
    renderSelection,
    hit,
    target,
    behavior,
    rect,
    value: rawValue,
    display,
    setTheme(value) {
      if (destroyed) return;
      theme = value;
      root.dataset.theme = theme;
      popup.dataset.theme = theme;
    },
    setDensity(value) {
      if (destroyed) return;
      density = value;
      root.dataset.density = density;
      refresh();
    },
    setWidth,
    setHidden(fields) {
      if (destroyed) return;
      hidden = new Set(fields);
      formatCache.clear();
      refresh();
    },
    hidden: () => [...hidden],
    resetColumns() {
      if (destroyed) return;
      widths = new Map();
      hidden = new Set(
        model
          .getConfig()
          .columns.filter((column) => column.hidden)
          .map((column) => column.field),
      );
      formatCache.clear();
      refresh();
    },
    setPinned(targets) {
      if (destroyed) return;
      pins = targets;
      renderPinned();
      renderWindow(true);
      sync();
    },
    getPinned: () => freeze(getPinned()),
    setEditing(cell) {
      editing = cell;
      lastStart = -1;
      renderWindow();
    },
    onScroll(fn) {
      scrollHook = fn;
    },
    onHeader(fn) {
      headerHook = fn;
    },
    onUnpin(fn) {
      unpinHook = fn;
    },
    onLocate(fn) {
      locateHook = fn;
    },
    showState(message, retry, overlay = false) {
      stateLayer.hidden = !message;
      stateLayer.classList.toggle('et-state-banner', overlay);
      stateLayer.replaceChildren();
      if (message) {
        stateLayer.append(el('span', '', message));
        if (retry) {
          const btn = el('button', '', '重试');
          btn.addEventListener('click', retry);
          stateLayer.append(btn);
        }
      }
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      dispose.abort();
      headerAbort.abort();
      observer.disconnect();
      for (const row of [...activeRows.values(), ...pool])
        for (const cleanup of row.cleanups) {
          try {
            cleanup();
          } catch (error) {
            report(error);
          }
        }
      activeRows.clear();
      for (const merged of mergedCells.values()) cleanupMerge(merged);
      mergedCells.clear();
      mergeSegments.clear();
      pool.length = 0;
      spacerPool.length = 0;
      formatCache.clear();
      popup.remove();
      root.remove();
    },
  };
}
