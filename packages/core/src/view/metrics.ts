type HeightBlock = { count: number; total: number; values?: Float64Array; prefix?: Float64Array };
const blockSize = 256;

/** 块级 Fenwick 索引。拼接只重建边界块和块索引，已测量的其余行高继续复用。 */
export class RowMetrics {
  private blocks: HeightBlock[] = [];
  private counts = new Float64Array(0);
  private totals = new Float64Array(0);
  private rowCount = 0;
  get count(): number {
    return this.rowCount;
  }
  private totalHeight = 0;
  private bit = 1;
  constructor(
    count: number,
    public readonly estimate: number,
  ) {
    if (!Number.isInteger(count) || count < 0 || !Number.isFinite(estimate) || estimate <= 0)
      throw new RangeError('行数必须是非负整数，估算高度必须是正数');
    this.initialize(
      Array.from({ length: Math.ceil(count / blockSize) }, (_, index) => {
        const size = Math.min(blockSize, count - index * blockSize);
        return { count: size, total: size * estimate };
      }),
    );
  }
  private initialize(blocks: readonly HeightBlock[]): void {
    this.blocks = [...blocks];
    this.rowCount = blocks.reduce((count, block) => count + block.count, 0);
    this.totalHeight = 0;
    this.bit = 1;
    this.counts = new Float64Array(this.blocks.length + 1);
    this.totals = new Float64Array(this.blocks.length + 1);
    for (const [index, block] of this.blocks.entries()) {
      this.counts[index + 1]! += block.count;
      this.totals[index + 1]! += block.total;
      this.totalHeight += block.total;
      const parent = index + 1 + ((index + 1) & -(index + 1));
      if (parent < this.counts.length) {
        this.counts[parent]! += this.counts[index + 1]!;
        this.totals[parent]! += this.totals[index + 1]!;
      }
    }
    while (this.bit * 2 <= this.blocks.length) this.bit *= 2;
  }
  private locate(index: number): { block: number; offset: number; top: number } {
    let block = 0,
      passed = 0,
      top = 0;
    for (let step = this.bit; step; step = Math.floor(step / 2)) {
      const next = block + step;
      if (next <= this.blocks.length && passed + this.counts[next]! <= index) {
        passed += this.counts[next]!;
        top += this.totals[next]!;
        block = next;
      }
    }
    return { block, offset: index - passed, top };
  }
  private makeBlock(values: readonly number[]): HeightBlock {
    if (values.every((value) => value === this.estimate))
      return { count: values.length, total: values.length * this.estimate };
    const prefix = new Float64Array(values.length + 1);
    for (const [index, value] of values.entries()) prefix[index + 1] = prefix[index]! + value;
    return {
      count: values.length,
      total: prefix[values.length]!,
      values: new Float64Array(values),
      prefix,
    };
  }
  rowTop(index: number): number {
    if (index <= 0) return 0;
    if (index >= this.count) return this.totalHeight;
    const at = this.locate(index),
      block = this.blocks[at.block]!;
    return at.top + (block.prefix?.[at.offset] ?? at.offset * this.estimate);
  }
  height(index: number): number {
    if (index < 0 || index >= this.count) return this.estimate;
    const at = this.locate(index);
    return this.blocks[at.block]!.values?.[at.offset] ?? this.estimate;
  }
  setHeight(index: number, height: number): void {
    if (index < 0 || index >= this.count || !Number.isFinite(height) || height < 20) return;
    const at = this.locate(index),
      old = this.blocks[at.block]!;
    const values = old.values ? [...old.values] : Array<number>(old.count).fill(this.estimate);
    if (values[at.offset] === height) return;
    values[at.offset] = height;
    const block = this.makeBlock(values),
      delta = block.total - old.total;
    // 写时复制边界块，旧度量实例和历史视图不会被新测量污染。
    this.blocks[at.block] = block;
    this.totalHeight += delta;
    for (
      let position = at.block + 1;
      position < this.totals.length;
      position += position & -position
    )
      this.totals[position]! += delta;
  }
  splice(start: number, deleteCount: number, insertCount: number): RowMetrics {
    if (
      ![start, deleteCount, insertCount].every(Number.isInteger) ||
      start < 0 ||
      start > this.count ||
      deleteCount < 0 ||
      deleteCount > this.count - start ||
      insertCount < 0
    )
      throw new RangeError('行高度拼接范围无效');
    const first = this.locate(start),
      last = this.locate(start + deleteCount);
    const left = this.blocks.slice(0, first.block),
      right = this.blocks.slice(last.block + 1);
    const heights = (block: HeightBlock, from: number, end: number): number[] =>
      Array.from(
        { length: end - from },
        (_, offset) => block.values?.[from + offset] ?? this.estimate,
      );
    const before =
      first.block < this.blocks.length ? heights(this.blocks[first.block]!, 0, first.offset) : [];
    const after =
      last.block < this.blocks.length
        ? heights(this.blocks[last.block]!, last.offset, this.blocks[last.block]!.count)
        : [];
    if (left.length && left[left.length - 1]!.count < blockSize) {
      const block = left.pop()!;
      before.unshift(...heights(block, 0, block.count));
    }
    if (right.length && right[0]!.count < blockSize) {
      const block = right.shift()!;
      after.push(...heights(block, 0, block.count));
    }
    const middle: HeightBlock[] = [];
    let buffer: number[] = [];
    const append = (value: number): void => {
      buffer.push(value);
      if (buffer.length === blockSize) {
        middle.push(this.makeBlock(buffer));
        buffer = [];
      }
    };
    for (const value of before) append(value);
    for (let remaining = insertCount; remaining > 0;) {
      if (!buffer.length && remaining >= blockSize) {
        middle.push({ count: blockSize, total: blockSize * this.estimate });
        remaining -= blockSize;
      } else {
        append(this.estimate);
        remaining--;
      }
    }
    for (const value of after) append(value);
    if (buffer.length) middle.push(this.makeBlock(buffer));
    const next = new RowMetrics(0, this.estimate);
    next.initialize([...left, ...middle, ...right]);
    return next;
  }
  total(): number {
    return this.totalHeight;
  }
  rowAtOffset(offset: number): number {
    if (!this.count) return -1;
    if (offset >= this.totalHeight) return this.count - 1;
    let block = 0,
      top = 0,
      passed = 0;
    for (let step = this.bit; step; step = Math.floor(step / 2)) {
      const next = block + step;
      if (next <= this.blocks.length && top + this.totals[next]! <= Math.max(0, offset)) {
        top += this.totals[next]!;
        passed += this.counts[next]!;
        block = next;
      }
    }
    const current = this.blocks[block]!;
    if (!current.prefix)
      return (
        passed +
        Math.min(current.count - 1, Math.floor((Math.max(0, offset) - top) / this.estimate))
      );
    let low = 0,
      high = current.count;
    while (low < high) {
      const mid = (low + high) >>> 1;
      if (current.prefix[mid + 1]! <= Math.max(0, offset) - top) low = mid + 1;
      else high = mid;
    }
    return passed + Math.min(current.count - 1, low);
  }
}
