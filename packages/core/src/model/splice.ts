import type { Entry } from './pipeline';
export type SourceSplice = { start: number; deleteCount: number; insertCount: number };
/** 前后连续未变段只比较记录身份和引用；用于历史恢复时推导反向拼接范围。 */
export function findSplice<TRow extends object>(
  before: readonly Entry<TRow>[],
  after: readonly Entry<TRow>[],
): SourceSplice {
  let start = 0,
    oldEnd = before.length,
    newEnd = after.length;
  while (start < oldEnd && start < newEnd && before[start] === after[start]) start++;
  while (oldEnd > start && newEnd > start && before[oldEnd - 1] === after[newEnd - 1]) {
    oldEnd--;
    newEnd--;
  }
  return { start, deleteCount: oldEnd - start, insertCount: newEnd - start };
}
