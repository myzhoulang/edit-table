/** 日期只支持日历日期；年月日顺序与分隔符由 YYYY、MM、DD 三个标记决定。 */
export function dateFormat(props?: Record<string, unknown>): string {
  const format = typeof props?.format === 'string' ? props.format : 'YYYY-MM-DD';
  if (['YYYY', 'MM', 'DD'].some((token) => format.split(token).length !== 2))
    throw new Error('日期 format 必须各包含一次 YYYY、MM、DD');
  return format;
}
export function formatDate(date: Date, format = 'YYYY-MM-DD'): string {
  const parts: Record<string, string> = {
    YYYY: String(date.getFullYear()).padStart(4, '0'),
    MM: String(date.getMonth() + 1).padStart(2, '0'),
    DD: String(date.getDate()).padStart(2, '0'),
  };
  return format.replace(/YYYY|MM|DD/g, (token) => parts[token]!);
}
export function parseDate(value: string, format = 'YYYY-MM-DD'): Date | null {
  const tokens = format.match(/YYYY|MM|DD/g) ?? [];
  const expression = format
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/YYYY|MM|DD/g, (token) => (token === 'YYYY' ? '(\\d{4})' : '(\\d{2})'));
  const match = new RegExp(`^${expression}$`).exec(value);
  if (!match || tokens.length !== 3) return null;
  const parts = Object.fromEntries(tokens.map((token, index) => [token, Number(match[index + 1])]));
  const date = new Date(0);
  date.setHours(0, 0, 0, 0);
  date.setFullYear(parts.YYYY!, parts.MM! - 1, parts.DD!);
  return date.getFullYear() === parts.YYYY &&
    date.getMonth() + 1 === parts.MM &&
    date.getDate() === parts.DD
    ? date
    : null;
}
