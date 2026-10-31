import type {
  CellRef,
  CellTarget,
  CommandResult,
  CreateTableOptions,
  DataState,
  Row,
  RowTarget,
  TableInstance,
} from '../types';
import { createController } from '../model/model';
import { errorOf, freeze, own, record, same, read } from '../utils/immutable';
import { createRenderer } from './renderer';
import { createEditors } from './editors';
import { createInteractions } from './interactions';
import { createToolbar } from './toolbar';
import { clipboardRange } from '../utils/clipboard';

/** 仅在显式创建实例时接触 DOM，包入口可在 Node / SSR 中安全导入。 */
export function createTable<TRow extends object = Row>(
  container: HTMLElement,
  options: CreateTableOptions<TRow>,
): TableInstance<TRow> {
  const model = createController(options),
    renderer = createRenderer(container, options, model);
  let instance: TableInstance<TRow>;
  const editors = createEditors(renderer, model, () => instance),
    interactions = createInteractions(renderer, model, editors, () => instance);
  let queue = Promise.resolve<CommandResult>({ ok: true }),
    requestId = 0,
    request: AbortController | null = null,
    requestEpoch = -1,
    externalGeneration = 0,
    dead = false;
  let hostState = {
    loading: options.loading ?? false,
    loadError: options.loadError,
    emptyReason: options.emptyReason,
  };
  let dataState: DataState = {
    status: model.getState().entries.length ? 'ready' : 'empty',
    loading: false,
    hasData: model.getState().entries.length > 0,
    requestId: 0,
  };
  const abort = new AbortController();
  function stateChanged(next: DataState): void {
    dataState = freeze(next);
    model.bus.emit('loadStateChange', dataState);
    paintState();
  }
  function paintState(): void {
    const locale = model.getConfig().locale;
    if (dataState.loading)
      renderer.showState(
        locale?.loading ?? (dataState.hasData ? '正在刷新…' : '正在加载…'),
        undefined,
        dataState.hasData,
      );
    else if (dataState.error)
      renderer.showState(
        `加载失败：${errorOf(dataState.error).message}`,
        () => {
          void instance.retryLoad();
        },
        dataState.hasData,
      );
    else if (!dataState.hasData)
      renderer.showState(
        dataState.status === 'filtered-empty'
          ? '没有符合条件的记录'
          : (locale?.empty ?? '暂无数据'),
      );
    else renderer.showState(null);
  }
  function invalidateRequest(): void {
    if (!request) return;
    request.abort();
    request = null;
    requestId++;
    stateChanged({
      status: model.getState().entries.length ? 'ready' : 'empty',
      hasData: model.getState().entries.length > 0,
      loading: false,
      requestId,
    });
  }
  function rowIndex(target: RowTarget): number {
    return target.kind === 'record'
      ? renderer.view().viewIndexOfRow(target.rowKey)
      : renderer
          .view()
          .rows.findIndex(
            (row) =>
              row.kind === 'derived' &&
              row.ruleKey === target.ruleKey &&
              row.groupKey === target.groupKey,
          );
  }
  function targetAt(index: number): RowTarget | null {
    const row = renderer.view().rows[index];
    return !row
      ? null
      : row.kind === 'record'
        ? { kind: 'record', rowKey: row.rowKey }
        : { kind: 'derived', ruleKey: row.ruleKey, groupKey: row.groupKey };
  }
  function pin(target: RowTarget | number): boolean {
    if (dead || !model.getConfig().rowPinning) return false;
    const resolved = typeof target === 'number' ? targetAt(target) : target;
    if (!resolved || rowIndex(resolved) < 0) return false;
    const pinned = renderer.getPinned().map((row) => row.target);
    if (pinned.some((row) => same(row, resolved))) return false;
    const setting = model.getConfig().rowPinning,
      limit = typeof setting === 'object' ? (setting.maxRows ?? 1) : 1;
    pinned.push(own(resolved));
    while (pinned.length > limit) pinned.shift();
    renderer.setPinned(pinned);
    model.bus.emit('pinnedRowsChange', { rows: renderer.getPinned() });
    return true;
  }
  function unpin(target: RowTarget): boolean {
    if (dead) return false;
    const before = renderer.getPinned().map((row) => row.target),
      after = before.filter((row) => !same(row, target));
    if (before.length === after.length) return false;
    renderer.setPinned(after);
    model.bus.emit('pinnedRowsChange', { rows: renderer.getPinned() });
    return true;
  }
  function cellOf(target: CellTarget): CellRef | null {
    const row = rowIndex(target),
      col = renderer.view().columns.findIndex((column) => column.field === target.field);
    return row >= 0 && col >= 0 ? { row, col } : null;
  }
  function scrollToCell(target: CellTarget): void {
    if (dead) return;
    const cell = cellOf(target);
    if (!cell) return;
    const view = renderer.view(),
      top = view.metrics.rowTop(cell.row),
      bottom = view.metrics.rowTop(cell.row + 1);
    if (top < renderer.body.scrollTop) renderer.body.scrollTop = top;
    else if (bottom > renderer.body.scrollTop + renderer.body.clientHeight)
      renderer.body.scrollTop = bottom - renderer.body.clientHeight;
    const column = view.columns[cell.col]!;
    if (!column.fixed) {
      const left = view.lefts[cell.col]! + renderer.numberWidth(),
        width = view.widths[cell.col]!,
        fixedLeft =
          renderer.numberWidth() +
          view.columns.reduce((sum, c, i) => sum + (c.fixed === 'left' ? view.widths[i]! : 0), 0),
        fixedRight = view.columns.reduce(
          (sum, c, i) => sum + (c.fixed === 'right' ? view.widths[i]! : 0),
          0,
        );
      if (left < renderer.scrollLeft() + fixedLeft) renderer.scrollToX(left - fixedLeft);
      else if (left + width > renderer.scrollLeft() + renderer.body.clientWidth - fixedRight)
        renderer.scrollToX(left + width - renderer.body.clientWidth + fixedRight);
    }
    renderer.body.dispatchEvent(new Event('scroll'));
  }
  async function loadData(): Promise<boolean> {
    let id = 0;
    let controller: AbortController | null = null;
    try {
      if (dead) return false;
      if (!options.dataLoader) {
        options.onRetry?.();
        return false;
      }
      request?.abort();
      id = ++requestId;
      if (!(await editors.save()) || dead || id !== requestId) return false;
      controller = new AbortController();
      request = controller;
      requestEpoch = model.epoch.current();
      stateChanged({
        status: model.getState().entries.length ? 'refreshing' : 'loading',
        loading: true,
        hasData: model.getState().entries.length > 0,
        requestId: id,
      });
      const response = await options.dataLoader({ signal: controller.signal, requestId: id });
      if (dead || controller.signal.aborted || id !== requestId || !model.epoch.valid(requestEpoch))
        return false;
      request = null;
      const rows = Array.isArray(response) ? response : response.rows;
      const reason = Array.isArray(response) ? undefined : response.emptyReason;
      const beforeLoad = model.getState();
      model.api.setDataSource(rows);
      if (model.getState() === beforeLoad) {
        stateChanged({
          status: model.getState().entries.length ? 'refresh-error' : 'error',
          hasData: model.getState().entries.length > 0,
          loading: false,
          requestId: id,
          error: new Error('返回的数据无法应用，请检查行身份和计算规则'),
        });
        return false;
      }
      interactions.setSelection([]);
      externalGeneration++;
      stateChanged({
        status: rows.length ? 'ready' : reason === 'filtered' ? 'filtered-empty' : 'empty',
        hasData: rows.length > 0,
        loading: false,
        requestId: id,
      });
      return true;
    } catch (error) {
      if (
        dead ||
        id !== requestId ||
        !controller ||
        request !== controller ||
        controller.signal.aborted
      )
        return false;
      const currentRequest = request;
      if (!currentRequest || currentRequest.signal.aborted) return false;
      request = null;
      stateChanged({
        status: model.getState().entries.length ? 'refresh-error' : 'error',
        loading: false,
        hasData: model.getState().entries.length > 0,
        error: errorOf(error),
        requestId,
      });
      return false;
    }
  }
  instance = {
    ...model.api,
    setDataSource(rows) {
      if (dead) return;
      editors.cancel();
      invalidateRequest();
      externalGeneration++;
      const beforeLoad = model.getState();
      model.api.setDataSource(rows);
      if (model.getState() === beforeLoad) return;
      interactions.setSelection([]);
      stateChanged({
        status: rows.length ? 'ready' : 'empty',
        loading: false,
        hasData: rows.length > 0,
        requestId,
      });
    },
    replaceDataSource(rows) {
      if (dead) return;
      editors.cancel();
      invalidateRequest();
      externalGeneration++;
      const before = model.getState();
      model.api.replaceDataSource(rows);
      if (model.getState() === before) return;
      interactions.setSelection([]);
      stateChanged({
        status: rows.length ? 'ready' : 'empty',
        loading: false,
        hasData: rows.length > 0,
        requestId,
      });
    },
    updateConfig(next) {
      if (dead) return false;
      const updated = model.api.updateConfig(next);
      if (updated) {
        editors.cancel();
        interactions.setSelection([]);
        externalGeneration++;
        renderer.resetColumns();
        if (!next.rowPinning) instance.clearPinnedRows();
        else {
          const max = typeof next.rowPinning === 'object' ? (next.rowPinning.maxRows ?? 1) : 1;
          const pins = renderer.getPinned();
          if (pins.length > max) {
            renderer.setPinned(pins.slice(-max).map((pin) => pin.target));
            model.bus.emit('pinnedRowsChange', { rows: renderer.getPinned() });
          }
        }
      }
      return updated;
    },
    setTheme(theme) {
      if (!dead) renderer.setTheme(theme);
    },
    setDensity(density) {
      if (!dead) {
        renderer.setDensity(density);
        editors.refresh();
      }
    },
    setReadonly(value) {
      if (!dead) {
        if (value) editors.cancel();
        model.api.setReadonly(value);
      }
    },
    setHiddenColumns(fields) {
      if (dead) return;
      if (!editors.active()) {
        const known = new Set(model.getConfig().columns.map((column) => column.field));
        renderer.setHidden(fields.filter((field) => known.has(field)));
        interactions.setSelection([]);
        return;
      }
      void (async (): Promise<void> => {
        try {
          if (!(await editors.save()) || dead) return;
          const known = new Set(model.getConfig().columns.map((c) => c.field));
          renderer.setHidden(fields.filter((field) => known.has(field)));
          interactions.setSelection([]);
        } catch (error) {
          options.onError?.(errorOf(error));
        }
      })();
    },
    setColumnVisibility(field, visible) {
      const hidden = new Set(renderer.hidden());
      if (visible) hidden.delete(field);
      else hidden.add(field);
      instance.setHiddenColumns([...hidden]);
    },
    getHiddenColumns: renderer.hidden,
    setColumnWidth: renderer.setWidth,
    scrollToCell,
    scrollToRow(target, opts) {
      if (dead) return;
      const row = rowIndex(target);
      if (row < 0) return;
      renderer.body.scrollTop = renderer.view().metrics.rowTop(row);
      renderer.body.dispatchEvent(new Event('scroll'));
      if (opts?.select) interactions.selectRows(row);
    },
    getSelection: interactions.getSelection,
    setSelection(ranges) {
      if (!dead) interactions.setSelection(ranges);
    },
    pinRow: pin,
    unpinRow: unpin,
    clearPinnedRows() {
      if (dead || !renderer.getPinned().length) return;
      renderer.setPinned([]);
      model.bus.emit('pinnedRowsChange', { rows: [] });
    },
    getPinnedRows: renderer.getPinned,
    async validate() {
      try {
        if (!(await editors.save()))
          return { valid: false, errors: [{ message: '当前编辑未通过检查' }], firstError: null };
        const result = await model.api.validate();
        if (result.firstError?.target) {
          scrollToCell(result.firstError.target);
          const cell = cellOf(result.firstError.target);
          if (cell) interactions.setSelection([{ anchor: cell, focus: cell }]);
        }
        return result;
      } catch (error) {
        const issue = { message: errorOf(error).message };
        return { valid: false, errors: [issue], firstError: issue };
      }
    },
    loadData,
    retryLoad: loadData,
    getDataState: () => dataState,
    saveEdit: editors.save,
    setLoadingState(next) {
      if (dead) return;
      hostState = { ...hostState, ...next };
      const hasData = model.getState().entries.length > 0;
      stateChanged({
        status: hostState.loading
          ? hasData
            ? 'refreshing'
            : 'loading'
          : hostState.loadError
            ? hasData
              ? 'refresh-error'
              : 'error'
            : hasData
              ? 'ready'
              : hostState.emptyReason === 'filtered'
                ? 'filtered-empty'
                : 'empty',
        loading: hostState.loading,
        hasData,
        error: hostState.loadError,
        requestId,
      });
    },
    executeCommand(name, payload) {
      const generation = externalGeneration;
      queue = queue.then(async () => {
        try {
          if (dead) return { ok: false, code: 'destroyed', message: '表格已销毁' };
          if (generation !== externalGeneration)
            return { ok: false, code: 'stale', message: '命令结果已过期' };
          let result: CommandResult;
          if (name === 'pinRow') {
            const selection = interactions.getSelection();
            const value = record(payload) && 'target' in payload ? payload.target : payload;
            const candidate =
              typeof value === 'number'
                ? value
                : record(value) &&
                    ((value.kind === 'record' && typeof value.rowKey === 'string') ||
                      (value.kind === 'derived' &&
                        typeof value.ruleKey === 'string' &&
                        typeof value.groupKey === 'string'))
                  ? (value as RowTarget)
                  : selection.mode === 'column'
                    ? undefined
                    : selection.active?.row;
            result =
              candidate !== undefined && pin(candidate)
                ? { ok: true }
                : {
                    ok: false,
                    code: 'invalid-target',
                    message: '固定行不可用、目标不存在或已固定',
                  };
          } else if (name === 'unpinRow') {
            const selection = interactions.getSelection();
            const value = record(payload) && 'target' in payload ? payload.target : payload;
            const target =
              record(value) && 'kind' in value
                ? (value as RowTarget)
                : targetAt(selection.mode === 'column' ? -1 : (selection.active?.row ?? -1));
            result =
              target && unpin(target)
                ? { ok: true }
                : { ok: false, code: 'invalid-target', message: '目标行未固定' };
          } else if (name === 'clearPinnedRows') {
            instance.clearPinnedRows();
            result = { ok: true };
          } else if (name === 'validate') result = { ok: true, data: await instance.validate() };
          else {
            if (
              name !== 'copy' &&
              name !== 'selectAll' &&
              name !== 'clearSelection' &&
              !(await editors.save())
            )
              return { ok: false, code: 'rejected', message: '请先修正当前编辑' };
            result =
              (await interactions.execute(name, payload)) ??
              (await model.handleCommand(name, payload));
          }
          model.bus.emit('commandExecuted', { name, result });
          toolbar.refresh();
          return result;
        } catch (error) {
          return { ok: false, code: 'rejected', message: errorOf(error).message };
        }
      });
      return queue;
    },
    getCommandState(name) {
      if (dead) return { enabled: false, reason: 'destroyed' };
      const selection = interactions.getSelection(),
        active = selection.active,
        row = active && selection.mode !== 'column' ? renderer.view().rows[active.row] : undefined,
        pinned = renderer.getPinned();
      const enabled = (
        value: boolean,
        reason = 'invalid-target',
      ): { enabled: boolean; reason?: string } =>
        value ? { enabled: true } : { enabled: false, reason };
      if (name === 'pinRow')
        return enabled(
          Boolean(
            model.getConfig().rowPinning &&
            row &&
            !pinned.some((info) => same(info.target, targetAt(row.viewIndex))),
          ),
        );
      if (name === 'unpinRow')
        return enabled(
          Boolean(row && pinned.some((info) => same(info.target, targetAt(row.viewIndex)))),
        );
      if (name === 'clearPinnedRows') return enabled(pinned.length > 0);
      if (name === 'copy' || name === 'clearSelection') return enabled(selection.ranges.length > 0);
      if (name === 'selectAll')
        return enabled(renderer.view().rows.length > 0 && renderer.view().columns.length > 0);
      if (name === 'validate') return { enabled: true };
      if (name === 'mergeCells' || name === 'unmergeCells') {
        if (model.getConfig().readonly) return enabled(false, 'readonly');
        if (!active) return enabled(false);
        if (name === 'unmergeCells')
          return enabled(renderer.view().spanOf(active)?.kind === 'manual');
        try {
          const range = clipboardRange(selection.ranges),
            column = renderer.view().columns[active.col];
          const rule = model
            .getConfig()
            .manualMerge?.rules.find(
              (rule) => rule.column === column?.field || rule.column === column?.key,
            );
          return enabled(
            Boolean(
              range &&
              range.anchor.col === range.focus.col &&
              range.focus.row > range.anchor.row &&
              rule &&
              renderer.behavior(active, 'mergeable'),
            ),
          );
        } catch (error) {
          return enabled(false, errorOf(error).message);
        }
      }
      if (['cut', 'paste', 'clear'].includes(name))
        return enabled(
          !model.getConfig().readonly && Boolean(active),
          model.getConfig().readonly ? 'readonly' : 'invalid-target',
        );
      if (
        [
          'deleteRows',
          'duplicateRows',
          'lockRows',
          'unlockRows',
          'insertRowAbove',
          'insertRowBelow',
        ].includes(name)
      ) {
        if (model.getConfig().readonly) return enabled(false, 'readonly');
        if (!row || row.kind !== 'record') return enabled(false);
        if (name === 'deleteRows' && model.api.getLockedRows().includes(row.rowKey))
          return enabled(false, 'readonly');
      }
      return model.api.getCommandState(name);
    },
    focus() {
      if (!dead) renderer.body.focus({ preventScroll: true });
    },
    destroy() {
      if (dead) return;
      dead = true;
      externalGeneration++;
      request?.abort();
      request = null;
      abort.abort();
      unsubscribe();
      editors.destroy();
      interactions.destroy();
      toolbar.destroy();
      renderer.destroy();
      model.api.destroy();
    },
  };
  const toolbar = createToolbar(
    renderer,
    options,
    () => instance,
    model.getConfig,
    () => renderer.view().rows.length,
  );
  model.bus.on('selectionChange', () => toolbar.refresh());
  let previous = model.getState(),
    previousConfig = model.getConfig(),
    previousMerges = model.getMerges();
  const unsubscribe = model.subscribe(() => {
    if (dead) return;
    if (request && !model.epoch.valid(requestEpoch)) invalidateRequest();
    const next = model.getState(),
      nextConfig = model.getConfig(),
      nextMerges = model.getMerges();
    const rebuild =
      previous.tree !== next.tree ||
      previousConfig !== nextConfig ||
      previousMerges !== nextMerges ||
      (nextConfig.rowRules?.some((rule) =>
        [...new Set([...next.changedKeys, ...previous.changedKeys])].some((key) => {
          const before = previous.entries[previous.indices.get(key) ?? -1]?.row,
            after = next.entries[next.indices.get(key) ?? -1]?.row;
          return (
            before && after && !same(read(before, rule.match.field), read(after, rule.match.field))
          );
        }),
      ) ??
        false) ||
      previous.results.length !== next.results.length ||
      previous.results.some(
        (row, index) =>
          row.visible !== next.results[index]?.visible ||
          row.ruleKey !== next.results[index]?.ruleKey ||
          row.groupKey !== next.results[index]?.groupKey,
      );
    previous = next;
    previousConfig = nextConfig;
    previousMerges = nextMerges;
    renderer.root.dataset.striped = String(nextConfig.striped === true);
    renderer.refresh(rebuild);
    renderer.renderSelection(interactions.getSelection());
    editors.refresh();
    toolbar.refresh();
  });
  renderer.onScroll(() => editors.refresh());
  renderer.onUnpin(unpin);
  renderer.onLocate((target) => instance.scrollToRow(target, { select: true }));
  model.bus.on('editStart', invalidateRequest);
  window.addEventListener('resize', () => editors.refresh(), { signal: abort.signal });
  document.addEventListener(
    'scroll',
    (event) => {
      if (
        event.target !== renderer.body &&
        !(event.target instanceof Node && renderer.root.contains(event.target))
      )
        editors.refresh();
    },
    { capture: true, passive: true, signal: abort.signal },
  );
  renderer.root.dataset.striped = String(model.getConfig().striped === true);
  toolbar.refresh();
  instance.setLoadingState(hostState);
  if (options.dataLoader)
    queueMicrotask(() => {
      if (!dead) void loadData();
    });
  return instance;
}
