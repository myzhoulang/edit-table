import type { CellRef, CellTarget, EditorName, Option, Scalar, TableInstance } from '../types';
import type { ModelController } from '../model/model';
import type { Renderer } from './renderer';
import { errorOf } from '../utils/immutable';
import { el, button, textValue } from './elements';
import { normalizeValue } from '../model/validation';
import { dateFormat, formatDate, parseDate } from '../utils/date';

type Choice = { label: string; value: Scalar; disabled: boolean; children?: Option[] };
type Session = {
  cell: CellRef;
  target: CellTarget;
  kind: EditorName;
  mode: 'entry' | 'edit';
  box: HTMLDivElement;
  input: HTMLInputElement;
  error: HTMLDivElement;
  dropdown: HTMLDivElement;
  epoch: number;
  value: unknown;
  composing: boolean;
  committing: boolean;
  request: number;
  choices: Choice[];
  highlighted: number;
  multiple: boolean;
  props: Record<string, unknown>;
  calendarDate?: Date;
  path: Choice[];
  roots: Choice[];
  promise?: Promise<boolean>;
};
export interface Editors {
  start: (cell: CellRef, initial?: string) => void;
  save: () => Promise<boolean>;
  cancel: () => void;
  active: () => boolean;
  arrowNavigation: () => boolean;
  enterEdit: () => void;
  refresh: () => void;
  destroy: () => void;
}
function choices(options: Option[]): Choice[] {
  return options.map((option) =>
    option !== null && typeof option === 'object'
      ? { ...option, disabled: option.disabled ?? false }
      : { label: String(option ?? ''), value: option, disabled: false },
  );
}

export function createEditors<TRow extends object>(
  renderer: Renderer<TRow>,
  model: ModelController<TRow>,
  table: () => TableInstance<TRow>,
): Editors {
  let current: Session | null = null,
    dead = false;
  function position(session: Session): void {
    const rect = renderer.rect(session.cell),
      height = Math.min(40, rect.height),
      width = session.kind === 'number' ? rect.width : Math.max(80, rect.width);
    const left = Math.max(4, Math.min(window.innerWidth - width - 4, rect.left));
    const { scaleX, scaleY } = renderer.placePopup(
      session.box,
      left,
      Math.max(4, Math.min(window.innerHeight - height - 4, rect.top + (rect.height - height) / 2)),
    );
    session.box.style.width = `${width / scaleX}px`;
    // 所有编辑器的高度均包含上下边框，错误提示独立浮动，不撑高外框。
    session.box.style.height = `${height / scaleY}px`;
    session.input.style.height = `${Math.max(0, height / scaleY - 4)}px`;
    const remaining = window.innerHeight - rect.top - height - 12;
    session.dropdown.style.maxHeight = `${Math.max(150, Math.min(330, remaining > 170 ? remaining : rect.top - 12))}px`;
    session.dropdown.style.left = `${Math.min(-2, (window.innerWidth - 284 - left) / scaleX)}px`;
    const above = remaining < 170 && rect.top > 200;
    session.dropdown.classList.toggle('et-dropdown-above', above);
    session.dropdown.style.marginTop =
      !above && !session.error.hidden ? `${session.error.offsetHeight + 5}px` : '';
  }
  function cancel(committed = false): void {
    const session = current;
    if (!session) return;
    current = null;
    session.request++;
    session.box.remove();
    renderer.setEditing(null);
    model.bus.emit('editEnd', { target: session.target, committed });
    renderer.body.focus({ preventScroll: true });
  }
  async function save(): Promise<boolean> {
    const session = current;
    if (!session || dead) return true;
    if (session.composing) return false;
    if (session.promise) return await session.promise;
    const task = async (): Promise<boolean> => {
      try {
        session.committing = true;
        session.box.classList.add('et-committing');
        const column =
          model.getConfig().columns.find((c) => c.field === session.target.field) ??
          model
            .getConfig()
            .columns.find((c) => c.field === renderer.view().columns[session.cell.col]?.field);
        const value = normalizeValue(
          session.kind === 'select' || session.kind === 'cascader'
            ? session.value
            : session.input.value,
          { valueType: column?.valueType, editor: session.kind, editorProps: session.props },
        );
        if (session.target.kind === 'record' && column?.updateValueBefore) {
          const recordKey = session.target.rowKey;
          const row = model.getState().entries.find((e) => e.key === recordKey)?.row;
          if (!row) throw new Error('目标行已删除');
          const allowed = await column.updateValueBefore(value, row, table());
          if (allowed === false) throw new Error('此次修改未通过写入检查');
        }
        if (current !== session || !model.epoch.valid(session.epoch) || dead) {
          if (current === session) cancel();
          return false;
        }
        const result = await model.write(
          [{ target: session.target, value }],
          'edit',
          session.epoch,
        );
        if (!result.ok) {
          if (result.code === 'stale' || result.code === 'destroyed') {
            if (current === session) cancel();
            return false;
          }
          throw new Error(result.message ?? '无法保存修改');
        }
        if (current === session) cancel(true);
        return true;
      } catch (error) {
        if (current === session && !dead) {
          session.error.textContent = errorOf(error).message;
          session.error.hidden = false;
          session.input.setAttribute('aria-invalid', 'true');
          table().scrollToCell(session.target);
          position(session);
          session.input.focus();
        }
        return false;
      } finally {
        session.committing = false;
        session.promise = undefined;
        session.box.classList.remove('et-committing');
      }
    };
    session.promise = task();
    try {
      return await session.promise;
    } finally {
      session.promise = undefined;
    }
  }
  function selectOption(session: Session, option: Choice): void {
    if (option.disabled || current !== session) return;
    if (session.multiple) {
      const selected: unknown[] = Array.isArray(session.value) ? [...session.value] : [];
      const found = selected.findIndex((v) => Object.is(v, option.value));
      if (found >= 0) selected.splice(found, 1);
      else selected.push(option.value);
      session.value = selected;
      renderChoices(session, session.choices);
    } else {
      session.value = option.value;
      session.input.value = option.label;
      void save();
    }
  }
  function renderChoices(session: Session, items: Choice[]): void {
    session.dropdown.replaceChildren();
    if (!items.length)
      session.dropdown.append(
        el('div', 'et-option-empty', model.getConfig().locale?.noOptions ?? '暂无选项'),
      );
    items.forEach((option, index) => {
      const selected = Array.isArray(session.value)
        ? session.value.includes(option.value)
        : Object.is(session.value, option.value);
      const item = el(
        'button',
        `et-option${selected ? ' et-option-selected' : ''}${index === session.highlighted ? ' et-option-active' : ''}`,
      );
      item.type = 'button';
      item.disabled = option.disabled;
      item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', String(selected));
      item.append(el('span', '', option.label), el('span', 'et-option-check', selected ? '✓' : ''));
      item.addEventListener('pointerdown', (event) => event.preventDefault());
      item.addEventListener('click', () => selectOption(session, option));
      session.dropdown.append(item);
    });
    if (session.multiple) {
      const done = el('button', 'et-editor-done', '确定');
      done.type = 'button';
      done.addEventListener('click', () => {
        void save();
      });
      session.dropdown.append(done);
    }
  }
  async function loadOptions(session: Session, search: string): Promise<void> {
    const request = ++session.request;
    try {
      const column = renderer.view().columns[session.cell.col];
      if (!column) return;
      session.dropdown.replaceChildren(el('div', 'et-option-empty', '加载中…'));
      const currentTarget = session.target;
      const row =
        currentTarget.kind === 'record'
          ? model.getState().entries.find((e) => e.key === currentTarget.rowKey)?.row
          : undefined;
      const options =
        typeof column.options === 'function' && row
          ? await column.options(row, search)
          : Array.isArray(column.options)
            ? column.options
            : [];
      if (
        current !== session ||
        request !== session.request ||
        !model.epoch.valid(session.epoch) ||
        dead
      )
        return;
      const all = choices(options),
        filter = session.props.filterOption;
      const filtered = all.filter(
        (option) =>
          !search ||
          (typeof filter === 'function'
            ? Boolean(filter(search, option))
            : option.label.toLocaleLowerCase().includes(search.toLocaleLowerCase())),
      );
      session.choices = filtered;
      session.highlighted = filtered.findIndex((option) => Object.is(option.value, session.value));
      if (session.kind === 'cascader') {
        session.roots = all;
        renderCascader(session, all, []);
      } else renderChoices(session, filtered);
    } catch (error) {
      if (
        current !== session ||
        dead ||
        request !== session.request ||
        !model.epoch.valid(session.epoch)
      )
        return;
      session.dropdown.replaceChildren(
        el('div', 'et-option-empty', `选项加载失败：${errorOf(error).message}`),
      );
      const retry = el('button', 'et-editor-done', '重试');
      retry.type = 'button';
      retry.addEventListener('click', () => {
        void loadOptions(session, search);
      });
      session.dropdown.append(retry);
    }
  }
  function renderCascader(session: Session, items: Choice[], path: Choice[]): void {
    session.choices = items;
    session.path = path;
    session.highlighted = items.findIndex((item) => !item.disabled);
    session.dropdown.replaceChildren();
    if (path.length) {
      const back = el('button', 'et-cascader-back', `‹ ${path.map((p) => p.label).join(' / ')}`);
      back.type = 'button';
      back.addEventListener('click', () => {
        const parent = path.slice(0, -1);
        renderCascader(
          session,
          parent.length ? choices(parent[parent.length - 1]!.children ?? []) : session.roots,
          parent,
        );
      });
      session.dropdown.append(back);
    }
    if (!items.length) session.dropdown.append(el('div', 'et-option-empty', '暂无选项'));
    for (const [index, item] of items.entries()) {
      const node = el('button', 'et-option', `${item.label}${item.children?.length ? ' ›' : ''}`);
      node.type = 'button';
      node.disabled = item.disabled;
      node.setAttribute('role', 'option');
      node.setAttribute('aria-selected', 'false');
      node.classList.toggle('et-option-active', index === session.highlighted);
      node.addEventListener('click', () => {
        if (item.children?.length) renderCascader(session, choices(item.children), [...path, item]);
        else {
          session.value = [...path, item].map((p) => p.value);
          session.input.value = [...path, item].map((p) => p.label).join(' / ');
          void save();
        }
      });
      session.dropdown.append(node);
    }
  }
  function calendar(session: Session, displayed: Date): void {
    session.calendarDate = displayed;
    session.dropdown.replaceChildren();
    const navigation = el('div', 'et-calendar-nav'),
      title = el('strong', '', `${displayed.getFullYear()}年${displayed.getMonth() + 1}月`);
    navigation.append(
      button('上个月', '‹', () =>
        calendar(session, new Date(displayed.getFullYear(), displayed.getMonth() - 1, 1)),
      ),
      title,
      button('下个月', '›', () =>
        calendar(session, new Date(displayed.getFullYear(), displayed.getMonth() + 1, 1)),
      ),
    );
    session.dropdown.append(navigation);
    const grid = el('div', 'et-calendar-grid');
    for (const day of ['日', '一', '二', '三', '四', '五', '六'])
      grid.append(el('span', 'et-calendar-weekday', day));
    const start = new Date(displayed.getFullYear(), displayed.getMonth(), 1).getDay(),
      count = new Date(displayed.getFullYear(), displayed.getMonth() + 1, 0).getDate(),
      now = new Date();
    for (let index = 0; index < start; index++) grid.append(el('span'));
    for (let day = 1; day <= count; day++) {
      const date = new Date(displayed.getFullYear(), displayed.getMonth(), day),
        value = formatDate(date, dateFormat(session.props));
      const btn = el('button', 'et-calendar-day', String(day));
      btn.type = 'button';
      btn.setAttribute('aria-label', value);
      btn.tabIndex = day === displayed.getDate() ? 0 : -1;
      btn.classList.toggle('et-option-active', day === displayed.getDate());
      btn.classList.toggle('et-date-selected', session.input.value === value);
      btn.classList.toggle(
        'et-date-today',
        now.getFullYear() === displayed.getFullYear() &&
          now.getMonth() === displayed.getMonth() &&
          now.getDate() === day,
      );
      btn.addEventListener('click', () => {
        session.input.value = value;
        void save();
      });
      grid.append(btn);
    }
    session.dropdown.append(grid);
  }
  function start(cell: CellRef, initial?: string): void {
    if (dead) return;
    const target = renderer.target(cell);
    if (!target || !model.canWrite(target)) return;
    if (current) {
      if (current.cell.row === cell.row && current.cell.col === cell.col) {
        current.input.focus({ preventScroll: true });
        return;
      }
      void save().then((saved) => {
        if (saved && !current && !dead) start(cell, initial);
      });
      return;
    }
    const column = renderer.view().columns[cell.col];
    if (!column) return;
    const row =
      target.kind === 'record'
        ? model.getState().entries.find((e) => e.key === target.rowKey)?.row
        : undefined;
    const derived =
      target.kind === 'derived'
        ? Object.values(
            model.getConfig().derivedRows?.find((r) => r.id === target.ruleKey)?.cells ?? {},
          ).find((item) => item.type === 'input' && item.field === target.field)
        : undefined;
    const kind =
      derived?.type === 'input'
        ? (derived.editor ?? 'text')
        : typeof column.editor === 'function' && row
          ? column.editor(row, column.field)
          : typeof column.editor === 'string'
            ? column.editor
            : 'text';
    const box = el('div', 'et-editor'),
      input = el('input', 'et-editor-input'),
      dropdown = el('div', 'et-editor-dropdown'),
      error = el('div', 'et-editor-error');
    error.hidden = true;
    input.setAttribute('aria-label', `编辑${column.title}`);
    input.autocomplete = 'off';
    dropdown.addEventListener('pointerdown', (event) => event.preventDefault());
    const props = { ...model.getConfig().editorOptions?.[kind], ...column.editorProps };
    if (typeof props.maxLength === 'number') input.maxLength = props.maxLength;
    input.placeholder =
      typeof props.placeholder === 'string'
        ? props.placeholder
        : kind === 'select'
          ? '搜索选项…'
          : kind === 'date'
            ? dateFormat(props)
            : '';
    const value = renderer.value(cell),
      session: Session = {
        cell,
        target,
        kind,
        mode: initial === undefined ? 'edit' : 'entry',
        box,
        input,
        error,
        dropdown,
        epoch: model.invalidate(),
        value,
        composing: false,
        committing: false,
        request: 0,
        choices: [],
        highlighted: -1,
        multiple: props.multiple === true,
        props,
        path: [],
        roots: [],
      };
    current = session;
    input.value = initial ?? textValue(value);
    box.append(input, error);
    if (['select', 'date', 'cascader'].includes(kind)) box.append(dropdown);
    renderer.popup.append(box);
    renderer.setEditing(cell);
    position(session);
    input.addEventListener('compositionstart', () => {
      session.composing = true;
    });
    input.addEventListener('compositionend', () => {
      session.composing = false;
    });
    input.addEventListener('pointerdown', () => {
      session.mode = 'edit';
    });
    input.addEventListener('input', () => {
      const hadError = !session.error.hidden;
      session.error.hidden = true;
      input.removeAttribute('aria-invalid');
      if (hadError) position(session);
      if (kind === 'select' || kind === 'cascader') void loadOptions(session, input.value);
    });
    if (kind === 'number') {
      input.inputMode = 'decimal';
      box.classList.add('et-number-editor');
      const control = el('div', 'et-number-control');
      control.append(input);
      box.prepend(control);
      for (const [label, sign, direction] of [
        ['减少', '−', -1],
        ['增加', '+', 1],
      ] satisfies [string, string, number][]) {
        const step = button(label, sign, () => {
          // 用十进制位数消除步进尾差，并在写回输入框前限制边界。
          const currentValue = Number(input.value.replace(/[,，\s]/g, '') || 0);
          if (!Number.isFinite(currentValue)) {
            session.error.textContent = '请输入有效数字后再调整数值';
            session.error.hidden = false;
            input.setAttribute('aria-invalid', 'true');
            return;
          }
          const stepValue =
            typeof props.step === 'number' && Number.isFinite(props.step) ? props.step : 1;
          const digits = (value: number): number => {
            const [coefficient = '', exponent = '0'] = String(value).toLowerCase().split('e');
            return Math.max(0, (coefficient.split('.')[1]?.length ?? 0) - Number(exponent));
          };
          const precision =
            typeof props.precision === 'number'
              ? props.precision
              : Math.max(digits(currentValue), digits(stepValue));
          let value = Number(
            (currentValue + direction * stepValue).toFixed(Math.max(0, Math.min(15, precision))),
          );
          if (typeof props.min === 'number') value = Math.max(props.min, value);
          if (typeof props.max === 'number') value = Math.min(props.max, value);
          if (!Number.isFinite(value)) return;
          input.value = String(value);
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.focus({ preventScroll: true });
        });
        step.addEventListener('pointerdown', (event) => event.preventDefault());
        if (direction < 0) control.prepend(step);
        else control.append(step);
      }
    }
    box.addEventListener('keydown', (event) => {
      if (event.isComposing || session.composing) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        cancel();
        return;
      }
      // 弹层支持原生 Tab 聚焦；输入框仍沿用表格 Tab 提交语义。
      if (event.key === 'Tab' && (event.target !== input || event.altKey)) {
        event.stopPropagation();
        return;
      }
      if (
        kind === 'date' &&
        [
          'ArrowDown',
          'ArrowUp',
          'ArrowLeft',
          'ArrowRight',
          'PageDown',
          'PageUp',
          'Home',
          'End',
        ].includes(event.key)
      ) {
        event.preventDefault();
        event.stopPropagation();
        const date = new Date(session.calendarDate ?? new Date());
        const offset =
          event.key === 'ArrowDown'
            ? 7
            : event.key === 'ArrowUp'
              ? -7
              : event.key === 'ArrowLeft'
                ? -1
                : event.key === 'ArrowRight'
                  ? 1
                  : event.key === 'Home'
                    ? -date.getDay()
                    : event.key === 'End'
                      ? 6 - date.getDay()
                      : 0;
        if (event.key.startsWith('Page')) {
          const day = date.getDate();
          date.setDate(1);
          date.setMonth(date.getMonth() + (event.key === 'PageDown' ? 1 : -1));
          date.setDate(
            Math.min(day, new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()),
          );
        } else date.setDate(date.getDate() + offset);
        calendar(session, date);
        session.dropdown.querySelector<HTMLElement>('.et-calendar-day[tabindex="0"]')?.focus();
        return;
      }
      if (kind === 'date' && event.key === 'Enter' && event.target !== input) {
        event.preventDefault();
        if (event.target instanceof HTMLButtonElement) event.target.click();
        return;
      }
      if (
        kind === 'cascader' &&
        ['ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft', 'Enter'].includes(event.key)
      ) {
        event.preventDefault();
        const option = session.choices[session.highlighted];
        if (event.key !== 'Enter' || !option || option.disabled || option.children?.length)
          event.stopPropagation();
        if (event.key === 'ArrowLeft') {
          const parent = session.path.slice(0, -1);
          renderCascader(
            session,
            parent.length ? choices(parent[parent.length - 1]!.children ?? []) : session.roots,
            parent,
          );
        } else if (event.key === 'Enter' || event.key === 'ArrowRight') {
          session.dropdown
            .querySelectorAll<HTMLButtonElement>('.et-option')
            [session.highlighted]?.click();
        } else {
          const direction = event.key === 'ArrowDown' ? 1 : -1;
          for (let count = 0; count < session.choices.length; count++) {
            session.highlighted =
              (session.highlighted + direction + session.choices.length) % session.choices.length;
            if (!session.choices[session.highlighted]?.disabled) break;
          }
          for (const [index, node] of session.dropdown.querySelectorAll('.et-option').entries())
            node.classList.toggle('et-option-active', index === session.highlighted);
        }
        session.dropdown
          .querySelector<HTMLElement>('.et-option-active')
          ?.scrollIntoView({ block: 'nearest' });
        return;
      }
      if (kind === 'select' && ['ArrowDown', 'ArrowUp'].includes(event.key)) {
        event.preventDefault();
        event.stopPropagation();
        const direction = event.key === 'ArrowDown' ? 1 : -1;
        for (let count = 0; count < session.choices.length; count++) {
          session.highlighted =
            (session.highlighted + direction + session.choices.length) % session.choices.length;
          if (!session.choices[session.highlighted]?.disabled) break;
        }
        renderChoices(session, session.choices);
      }
      if (
        event.key === 'Enter' &&
        kind === 'select' &&
        session.highlighted >= 0 &&
        !event.ctrlKey &&
        !event.metaKey
      ) {
        event.preventDefault();
        if (session.multiple) event.stopPropagation();
        selectOption(session, session.choices[session.highlighted]!);
      }
    });
    box.addEventListener('focusout', () =>
      queueMicrotask(() => {
        if (
          current === session &&
          !session.box.contains(document.activeElement) &&
          !session.committing &&
          !session.composing
        )
          void save();
      }),
    );
    if (kind === 'select' || kind === 'cascader') {
      input.value = initial ?? '';
      input.readOnly = props.searchable === false;
      dropdown.setAttribute('role', 'listbox');
      void loadOptions(session, input.value);
    }
    if (kind === 'date') {
      calendar(session, parseDate(input.value, dateFormat(props)) ?? new Date());
    }
    input.focus({ preventScroll: true });
    if (initial === undefined && !['select', 'cascader'].includes(kind))
      input.setSelectionRange(input.value.length, input.value.length);
    model.bus.emit('editStart', { target, committed: false });
  }
  return {
    start,
    save,
    cancel: () => cancel(),
    active: () => current !== null,
    arrowNavigation: () =>
      current?.mode === 'entry' && (current.kind === 'text' || current.kind === 'number'),
    enterEdit() {
      if (!current) return;
      current.mode = 'edit';
      current.input.focus({ preventScroll: true });
      current.input.setSelectionRange(current.input.value.length, current.input.value.length);
    },
    refresh() {
      const session = current;
      if (!session || session.committing) return;
      if (!model.epoch.valid(session.epoch) || !model.canWrite(session.target)) {
        cancel();
        return;
      }
      if (!renderer.visible(session.cell)) {
        void save();
        return;
      }
      position(session);
    },
    destroy() {
      dead = true;
      cancel();
    },
  };
}
