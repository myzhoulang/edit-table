import type { GroupNode, GroupRule } from '../types';
import { freeze, read, same } from '../utils/immutable';
import type { SourceSplice } from './splice';
export type GroupTree = {
  roots: GroupNode[];
  nodes: GroupNode[];
  paths: string[][];
  unchanged?: ReadonlyMap<GroupNode, GroupNode>;
};
/** 连续分组保留源顺序；完整祖先路径和出现次数区分不连续的同值组。 */
export function groupRows<TRow extends object>(
  rows: readonly TRow[],
  rules: readonly GroupRule[],
  previous?: GroupTree,
  dirty: readonly number[] = [],
  splice?: SourceSplice,
): GroupTree {
  let roots: GroupNode[] = [];
  const nodes: GroupNode[] = [],
    paths: string[][] = previous
      ? splice
        ? [
            ...previous.paths.slice(0, splice.start),
            ...Array.from({ length: splice.insertCount }, () => []),
            ...previous.paths.slice(splice.start + splice.deleteCount),
          ]
        : previous.paths.slice()
      : Array.from({ length: rows.length }, () => []);
  const occurrences = new Map<string, number>(),
    unchanged = new Map<GroupNode, GroupNode>();
  const usedIds = new Set<string>();
  let identityChanged = false;
  const reservedIds = new Set<string>();
  for (const rule of rules)
    if (rule.idField)
      for (const row of rows) {
        const value = read(row, rule.idField);
        if (value !== undefined && value !== null && value !== '' && value !== 0)
          reservedIds.add(JSON.stringify([rule.key, String(value)]));
      }
  const nextSuffix = new Map<string, number>();
  function allocateId(key: string, base: string): string {
    const allocation = JSON.stringify([key, base]);
    let suffix = nextSuffix.get(allocation) ?? 0;
    let id = suffix ? `${base}~${suffix}` : base;
    while (
      usedIds.has(JSON.stringify([key, id])) ||
      (suffix > 0 && reservedIds.has(JSON.stringify([key, id])))
    )
      id = `${base}~${++suffix}`;
    usedIds.add(JSON.stringify([key, id]));
    nextSuffix.set(allocation, suffix + 1);
    return id;
  }
  const oldAt = new Map<string, { group: GroupNode; offset: number }>();
  const translated = new WeakMap<GroupNode, GroupNode>();
  function shift(group: GroupNode, offset: number): GroupNode {
    const cached = translated.get(group);
    if (cached) return cached;
    const next = offset
      ? {
          ...group,
          start: group.start + offset,
          end: group.end + offset,
          children: group.children.map((child) => shift(child, offset)),
        }
      : group;
    translated.set(group, next);
    unchanged.set(next, group);
    return next;
  }
  for (const group of previous?.nodes ?? []) {
    if (splice && group.start < splice.start + splice.deleteCount && group.end >= splice.start)
      continue;
    if (splice && splice.insertCount && group.start < splice.start && group.end >= splice.start)
      continue;
    const offset =
      splice && group.start >= splice.start + splice.deleteCount
        ? splice.insertCount - splice.deleteCount
        : 0;
    oldAt.set(JSON.stringify([group.depth, group.start + offset]), { group, offset });
  }
  const changed = [...dirty].sort((a, b) => a - b);
  function isDirty(start: number, end: number): boolean {
    let low = 0,
      high = changed.length;
    while (low < high) {
      const mid = (low + high) >>> 1;
      if (changed[mid]! < start) low = mid + 1;
      else high = mid;
    }
    return low < changed.length && changed[low]! <= end;
  }
  // 未受影响的整棵子树直接复用；仍累计出现次数，保证不连续同名组的身份稳定。
  function appendReused(group: GroupNode, counted = false): void {
    nodes.push(group);
    usedIds.add(JSON.stringify([group.key, group.id]));
    if (!counted) {
      const signature = JSON.stringify([group.key, group.parentId ?? undefined, group.values]);
      occurrences.set(signature, (occurrences.get(signature) ?? 0) + 1);
      const rule = rules[group.depth]!;
      const explicit = rule.idField ? read(rows[group.start]!, rule.idField) : undefined;
      const base =
        explicit !== undefined && explicit !== null && explicit !== '' && explicit !== 0
          ? String(explicit)
          : signature;
      // 复用后代也必须消耗 ID 分配序列，删除前组后不能保留过期后缀。
      usedIds.delete(JSON.stringify([group.key, group.id]));
      if (allocateId(group.key, base) !== group.id) identityChanged = true;
      usedIds.add(JSON.stringify([group.key, group.id]));
    }
    for (const child of group.children) appendReused(child);
  }
  function build(start: number, end: number, depth: number, parent: GroupNode | null): GroupNode[] {
    const rule = rules[depth];
    if (!rule) return [];
    const result: GroupNode[] = [];
    for (let first = start; first <= end;) {
      const row = rows[first]!;
      const candidate = oldAt.get(JSON.stringify([depth, first]));
      const old = candidate?.group,
        offset = candidate?.offset ?? 0;
      const reusable =
        old &&
        old.end + offset <= end &&
        !isDirty(first, old.end + offset) &&
        rule.fields.every((field) => same(read(row, field), old.values[field]));
      let last = reusable ? old.end + offset : first;
      while (
        last + 1 <= end &&
        rule.fields.every((field) => same(read(row, field), read(rows[last + 1]!, field)))
      )
        last++;
      const values = {
        ...parent?.values,
        ...Object.fromEntries(rule.fields.map((field) => [field, read(row, field)])),
      };
      const signature = JSON.stringify([rule.key, parent?.id, values]);
      const occurrence = occurrences.get(signature) ?? 0;
      occurrences.set(signature, occurrence + 1);
      const explicit = rule.idField ? read(row, rule.idField) : undefined;
      const base =
        explicit !== undefined && explicit !== null && explicit !== '' && explicit !== 0
          ? String(explicit)
          : signature;
      const id = allocateId(rule.key, base);
      if (
        reusable &&
        last === old.end + offset &&
        id === old.id &&
        (parent?.id ?? null) === old.parentId &&
        same(values, old.values)
      ) {
        const reused = shift(old, offset);
        result.push(reused);
        appendReused(reused, true);
        first = last + 1;
        continue;
      }
      const group: GroupNode = {
        id,
        key: rule.key,
        scope: rule.key,
        values: freeze(values),
        parentId: parent?.id ?? null,
        depth,
        occurrence,
        start: first,
        end: last,
        children: [],
      };
      nodes.push(group);
      result.push(group);
      for (let i = first; i <= last; i++) {
        const path = paths[i] ?? [];
        if (path[depth] !== id) paths[i] = [...path.slice(0, depth), id];
      }
      group.children = build(first, last, depth + 1, group);
      first = last + 1;
    }
    return result;
  }
  if (rows.length) roots = build(0, rows.length - 1, 0, null);
  // 插入同名显式 ID 可能使复用子树的旧 ID 冲突，此时完整重建以重新分配身份。
  if (
    previous &&
    (identityChanged ||
      new Set(nodes.map((group) => JSON.stringify([group.key, group.id]))).size !== nodes.length)
  )
    return groupRows(rows, rules);
  const tree: GroupTree = { roots, nodes, paths };
  Object.defineProperty(tree, 'unchanged', { value: unchanged });
  return tree;
}
