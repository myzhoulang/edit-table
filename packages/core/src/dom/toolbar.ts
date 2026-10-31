import type { CreateTableOptions, Density, TableConfig, TableInstance, Theme } from '../types';
import type { Renderer } from './renderer';
import { button, el } from './elements';
import { errorOf } from '../utils/immutable';
const paths = {
  undo: ['M9 5 4 10l5 5', 'M4 10h10a6 6 0 0 1 0 12'],
  redo: ['m15 5 5 5-5 5', 'M20 10H10a6 6 0 0 0 0 12'],
  theme: [
    'M12 3a9 9 0 1 0 9 9c0-1.5-1-2-2-2h-2a2 2 0 0 1-2-2V6c0-2-1-3-3-3Z',
    'M7 9h.01M7 15h.01M12 17h.01',
  ],
  density: ['M4 5h16M4 12h16M4 19h16', 'm9 8 3-3 3 3m-6 8 3 3 3-3'],
  columns: ['M4 4h16v16H4Z', 'M9 4v16M15 4v16'],
  fullscreen: ['M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5'],
  merge: ['M3 4h18v16H3Z', 'M3 12h5m8 0h5m-13-3 3 3-3 3m8-6-3 3 3 3'],
  pin: ['m8 3 8 0-1 6 3 4H6l3-4Z', 'M12 13v8'],
};
function iconButton(label: string, key: keyof typeof paths, action: () => void): HTMLButtonElement {
  const btn = button(label, '', action),
    svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  for (const d of paths[key]) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    svg.append(path);
  }
  btn.append(svg);
  return btn;
}
export function createToolbar<TRow extends object>(
  renderer: Renderer<TRow>,
  options: CreateTableOptions<TRow>,
  table: () => TableInstance<TRow>,
  getConfig: () => TableConfig<TRow>,
  getCount: () => number,
): { refresh: () => void; destroy: () => void } {
  let menu: HTMLElement | null = null;
  const abort = new AbortController();

  renderer.toolbar.addEventListener('pointerdown', (event) => event.preventDefault(), {
    signal: abort.signal,
  });
  const undo = iconButton('撤销 (Ctrl/Cmd+Z)', 'undo', () => {
      void table().executeCommand('undo');
    }),
    redo = iconButton('重做 (Ctrl/Cmd+Shift+Z)', 'redo', () => {
      void table().executeCommand('redo');
    });
  function showMenu(
    trigger: HTMLButtonElement,
    items: { label: string; action: () => void }[],
  ): void {
    menu?.remove();
    menu = el('div', 'et-toolbar-menu');
    menu.addEventListener('pointerdown', (event) => event.preventDefault());
    const rect = trigger.getBoundingClientRect();
    renderer.placePopup(
      menu,
      Math.max(4, Math.min(rect.left, window.innerWidth - 210)),
      rect.bottom + 5,
    );
    for (const item of items) {
      const btn = el('button', 'et-menu-item', item.label);
      btn.type = 'button';
      btn.addEventListener('click', () => {
        item.action();
        menu?.remove();
      });
      menu.append(btn);
    }
    renderer.popup.append(menu);
  }
  const themes = iconButton('设置主题', 'theme', () =>
    showMenu(
      themes,
      (['light', 'green', 'dark'] satisfies Theme[]).map((value, index) => ({
        label: `${renderer.root.dataset.theme === value ? '✓  ' : '　 '}${['浅色', '绿色', '深色'][index]}`,
        action: () => {
          table().setTheme(value);
        },
      })),
    ),
  );
  const densities = iconButton('设置密度', 'density', () =>
    showMenu(
      densities,
      (['normal', 'compact'] satisfies Density[]).map((value, index) => ({
        label: `${renderer.root.dataset.density === value ? '✓  ' : '　 '}${['标准密度', '紧凑密度'][index]}`,
        action: () => {
          table().setDensity(value);
        },
      })),
    ),
  );
  const columns = iconButton('设置显示列', 'columns', () => {
    menu?.remove();
    menu = el('div', 'et-toolbar-menu');
    menu.addEventListener('pointerdown', (event) => event.preventDefault());
    const rect = columns.getBoundingClientRect();
    renderer.placePopup(menu, Math.min(rect.left, window.innerWidth - 210), rect.bottom + 5);
    for (const column of getConfig().columns) {
      const label = el('label', 'et-menu-checkbox'),
        checkbox = el('input');
      checkbox.type = 'checkbox';
      checkbox.checked = !table().getHiddenColumns().includes(column.field);
      checkbox.addEventListener('change', () =>
        table().setColumnVisibility(column.field, checkbox.checked),
      );
      label.append(checkbox, document.createTextNode(column.title));
      menu.append(label);
    }
    renderer.popup.append(menu);
  });
  const full = iconButton('全屏展示', 'fullscreen', () => {
    void (async (): Promise<void> => {
      try {
        if (document.fullscreenElement === renderer.root) await document.exitFullscreen();
        else await renderer.root.requestFullscreen();
      } catch (error) {
        renderer.showState(`无法进入全屏：${errorOf(error).message}`, undefined, true);
      }
    })();
  });
  const divider = (): HTMLSpanElement => el('span', 'et-toolbar-divider');
  renderer.toolbar.append(undo, redo, divider(), themes, densities, columns);
  const merge = iconButton('合并单元格', 'merge', () => {
    void table().executeCommand('mergeCells');
  });
  const pin = iconButton('固定当前行为对比行', 'pin', () => {
    void table().executeCommand('pinRow');
  });
  renderer.toolbar.append(merge, pin);
  renderer.toolbar.append(el('span', 'et-toolbar-spacer'));
  for (const action of options.toolbarActions ?? [])
    renderer.toolbar.append(
      button(action.label, action.icon ?? '⋯', () => {
        void (async (): Promise<void> => {
          try {
            await action.execute(table());
          } catch (error) {
            renderer.showState(errorOf(error).message, undefined, true);
          }
        })();
      }),
    );
  const status = el('span', 'et-toolbar-status');
  renderer.toolbar.append(status, full);
  document.addEventListener(
    'pointerdown',
    (event) => {
      if (
        menu &&
        event.target instanceof Node &&
        !menu.contains(event.target) &&
        !renderer.toolbar.contains(event.target)
      ) {
        menu.remove();
        menu = null;
      }
    },
    { signal: abort.signal },
  );
  return {
    refresh() {
      merge.hidden = !getConfig().manualMerge;
      pin.hidden = !getConfig().rowPinning;
      merge.disabled = !table().getCommandState('mergeCells').enabled;
      pin.disabled = !table().getCommandState('pinRow').enabled;
      undo.disabled = !table().getCommandState('undo').enabled;
      redo.disabled = !table().getCommandState('redo').enabled;
      status.textContent = `${getCount().toLocaleString('zh-CN')} 行`;
    },
    destroy() {
      abort.abort();
      menu?.remove();
    },
  };
}
