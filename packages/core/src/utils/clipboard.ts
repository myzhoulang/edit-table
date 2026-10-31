import type { CellRange } from '../types';

/** 合并相邻或重叠选区；非矩形不能无损表示为 TSV，必须在写剪贴板前拒绝。 */
export function clipboardRange(ranges: readonly CellRange[]): CellRange | null {
  if (!ranges.length) return null;
  const top = Math.min(...ranges.map((r) => Math.min(r.anchor.row, r.focus.row))),
    bottom = Math.max(...ranges.map((r) => Math.max(r.anchor.row, r.focus.row))),
    left = Math.min(...ranges.map((r) => Math.min(r.anchor.col, r.focus.col))),
    right = Math.max(...ranges.map((r) => Math.max(r.anchor.col, r.focus.col)));
  for (let row = top; row <= bottom; row++) {
    const intervals = ranges
      .filter(
        (r) =>
          row >= Math.min(r.anchor.row, r.focus.row) && row <= Math.max(r.anchor.row, r.focus.row),
      )
      .map(
        (r) => [Math.min(r.anchor.col, r.focus.col), Math.max(r.anchor.col, r.focus.col)] as const,
      )
      .sort((a, b) => a[0] - b[0]);
    let end = left - 1;
    for (const [start, until] of intervals) {
      if (start > end + 1) break;
      end = Math.max(end, until);
    }
    if (end !== right) throw new Error('选区不能拼成矩形，请调整选区后再复制或剪切');
  }
  return { anchor: { row: top, col: left }, focus: { row: bottom, col: right } };
}

/** 支持带引号的 TSV：单元格中的换行、制表符、双引号可以无损往返。 */
export function parseTSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [],
    value = '',
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') {
        value += '"';
        i++;
      } else if (quoted || value === '') quoted = !quoted;
      else value += char;
    } else if (!quoted && (char === '\t' || char === '\n' || char === '\r')) {
      row.push(value);
      value = '';
      if (char !== '\t') {
        rows.push(row);
        row = [];
        if (char === '\r' && text[i + 1] === '\n') i++;
      }
    } else value += char;
  }
  row.push(value);
  if (row.length > 1 || value !== '' || !rows.length) rows.push(row);
  return rows;
}
export function stringifyTSV(rows: unknown[][]): string {
  return rows
    .map((row) =>
      row
        .map((value) => {
          const text = clipboardText(value);
          return /[\t\n\r"]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
        })
        .join('\t'),
    )
    .join('\n');
}
function clipboardText(value: unknown): string {
  return Array.isArray(value) ? JSON.stringify(value) : value == null ? '' : String(value);
}
export function escapeHTML(value: unknown): string {
  return clipboardText(value).replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!,
  );
}
export function stringifyHTML(rows: unknown[][]): string {
  return `<table>${rows.map((row) => `<tr>${row.map((value) => `<td>${escapeHTML(value)}</td>`).join('')}</tr>`).join('')}</table>`;
}
