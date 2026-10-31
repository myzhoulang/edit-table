import { createTable, type TableInstance } from 'edit-table';
import {
  createLargeRows,
  createQuotationConfig,
  createQuotationRows,
  type QuoteRow,
} from './quotation/config';
import './page.css';
const host = document.querySelector<HTMLElement>('#table');
if (!host) throw new Error('找不到表格挂载容器');
const status = document.querySelector<HTMLElement>('#status');
let table: TableInstance<QuoteRow>;
function showStatus(message: string): void {
  if (status) {
    status.textContent = message;
    status.classList.add('visible');
    window.setTimeout(() => status.classList.remove('visible'), 3200);
  }
}
function mount(count = 24): void {
  table?.destroy();
  const config = createQuotationConfig();
  if (count !== 24) {
    config.groups = [];
    config.merges = {};
    config.derivedRows = [];
  }
  const start = performance.now();
  table = createTable(host!, {
    config,
    rowKey: 'id',
    dataSource: count === 24 ? createQuotationRows() : createLargeRows(count),
    onError: (error) => showStatus(error.message),
  });
  table.on('summaryChange', totals);
  table.on('commandExecuted', (event) => {
    if (!event.result.ok) showStatus(event.result.message ?? '操作未完成');
    else if (
      event.name === 'paste' &&
      event.result.data &&
      typeof event.result.data === 'object' &&
      'applied' in event.result.data
    )
      showStatus(`已粘贴 ${String(event.result.data.applied)} 个单元格`);
  });
  totals();
  const meta = document.querySelector('#dataset-meta');
  if (meta)
    meta.textContent = `${count.toLocaleString('zh-CN')} 条真实记录 · ${count === 24 ? '2 层连续分组' : '行虚拟化'} · ${Math.round(performance.now() - start)} ms 初始化`;
  Reflect.set(window, 'table', table);
  Reflect.set(window, 'createDemo', mount);
}
function totals(): void {
  const summary = table.getSummary();
  for (const key of ['gross', 'net', 'tax']) {
    const node = document.querySelector(`#total-${key}`);
    if (node)
      node.textContent = new Intl.NumberFormat('zh-CN', {
        style: 'currency',
        currency: 'CNY',
      }).format(Number(summary[key]));
  }
}
async function save(): Promise<void> {
  try {
    if (!(await table.saveEdit())) return;
    const result = await table.validate();
    if (!result.valid) {
      showStatus(`请修正 ${result.errors.length} 项输入错误`);
      return;
    }
    const submission = table.getSubmission();
    const panel = document.querySelector<HTMLDialogElement>('#submission');
    const code = document.querySelector('#submission-code');
    if (code) code.textContent = JSON.stringify(submission, null, 2);
    panel?.showModal();
    showStatus('校验通过，已采集提交数据');
  } catch (error) {
    showStatus(error instanceof Error ? error.message : String(error));
  }
}
document.querySelector('#save')?.addEventListener('click', () => {
  void save();
});
document.querySelector('#reset')?.addEventListener('click', () => {
  table.setDataSource(createQuotationRows());
  showStatus('已恢复示例数据');
});
document
  .querySelector('#close-submission')
  ?.addEventListener('click', () =>
    document.querySelector<HTMLDialogElement>('#submission')?.close(),
  );
document.querySelectorAll<HTMLButtonElement>('[data-count]').forEach((button) =>
  button.addEventListener('click', () => {
    document.querySelectorAll('[data-count]').forEach((node) => node.classList.remove('active'));
    button.classList.add('active');
    mount(Number(button.dataset.count));
  }),
);
document.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
    event.preventDefault();
    void save();
  }
});
window.addEventListener('beforeunload', () => table.destroy());
mount();
