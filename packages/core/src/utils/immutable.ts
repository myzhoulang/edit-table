/** 克隆宿主数据，隔离所有权；函数保留身份，普通对象递归复制。 */
export function clone<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  if (value instanceof RegExp) return new RegExp(value.source, value.flags) as T;
  if (value instanceof Date) return new Date(value) as T;
  if (Array.isArray(value)) return value.map((item: unknown) => clone(item)) as T;
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(value)) {
    const item: unknown = Reflect.get(value, key),
      next = clone(item);
    // 普通字段直接写入，避免每个字段分配两次键值对；保留 __proto__ 为自有数据字段。
    if (key === '__proto__')
      Object.defineProperty(result, key, {
        value: next,
        enumerable: true,
        configurable: true,
        writable: true,
      });
    else result[key] = next;
  }
  return result as T;
}
const frozenObjects = new WeakSet<object>();
export function freeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !frozenObjects.has(value)) {
    frozenObjects.add(value);
    if (Array.isArray(value)) {
      for (const item of value) freeze(item);
    } else {
      for (const item of Object.values(value)) freeze(item);
    }
    Object.freeze(value);
  }
  return value;
}
export function own<T>(value: T): T {
  return freeze(clone(value));
}
export function read(row: object, field: string): unknown {
  return Reflect.get(row, field);
}
export function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
export function scalar(value: unknown): value is import('../types').Scalar {
  return (
    value == null ||
    ['string', 'boolean'].includes(typeof value) ||
    (typeof value === 'number' && Number.isFinite(value))
  );
}
export function errorOf(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
export function same(a: unknown, b: unknown): boolean {
  if (Object.is(a, b) || a === b) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
  return JSON.stringify(a) === JSON.stringify(b);
}
export function targetKey(target: import('../types').CellTarget): string {
  return JSON.stringify(
    target.kind === 'record'
      ? ['r', target.rowKey, target.field]
      : ['d', target.ruleKey, target.groupKey, target.field],
  );
}
export function rowTargetKey(target: import('../types').RowTarget): string {
  return JSON.stringify(
    target.kind === 'record' ? ['r', target.rowKey] : ['d', target.ruleKey, target.groupKey],
  );
}
export function mergeTargets(
  merge: import('../types').ManualMerge,
): readonly import('../types').RowTarget[] {
  return merge.targets ?? merge.rowKeys.map((rowKey) => ({ kind: 'record', rowKey }));
}
export function derivedKey(
  value: Pick<import('../types').DerivedValue, 'ruleKey' | 'groupKey' | 'field'>,
): string {
  return JSON.stringify([value.ruleKey, value.groupKey, value.field]);
}

/** 子项已由模型拥有并冻结时，仅冻结新容器，避免重复遍历整表。 */
export function freezeContainer<T extends object>(value: T): T {
  if (frozenObjects.has(value)) return value;
  frozenObjects.add(value);
  return Object.freeze(value);
}
