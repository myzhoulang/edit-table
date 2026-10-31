import { createController } from '../../packages/core/src/model/model';
import { createView } from '../../packages/core/src/view/view';
import type { TableConfig } from '../../packages/core/src/types';
import { cpus, platform, release } from 'node:os';
import { mkdir, writeFile } from 'node:fs/promises';
interface BenchRow {
  id: string;
  input: number;
  result?: number;
}
const config: TableConfig<BenchRow> = {
  columns: [
    { field: 'input', title: '输入', editable: true },
    { field: 'result', title: '输出' },
  ],
  calculations: [
    {
      id: 'double',
      scope: 'row',
      reads: ['input'],
      writes: ['result'],
      compute: ({ row }) => ({ result: row.input * 2 }),
    },
  ],
};
const samples: object[] = [];
for (const count of [1000, 10000, 100000]) {
  const rows = Array.from({ length: count }, (_, index) => ({ id: `r${index}`, input: index }));
  for (let sample = 0; sample < 5; sample++) {
    const start = performance.now(),
      controller = createController({ config, dataSource: rows, rowKey: 'id' });
    const modelMs = performance.now() - start;
    const flattenStart = performance.now();
    createView(controller.getState(), controller.getConfig(), new Set(), new Map(), 36, []);
    const flattenMs = performance.now() - flattenStart;
    const editStart = performance.now();
    const result = controller.api.updateFields([
      { rowKey: `r${Math.floor(count / 2)}`, fields: { input: sample + 7 } },
    ]);
    const editMs = performance.now() - editStart;
    samples.push({ count, sample, modelMs, flattenMs, editMs, ok: result.ok });
    controller.api.destroy();
  }
}
const report = {
  date: new Date().toISOString(),
  environment: {
    runtime: process.versions.bun ? `Bun ${process.versions.bun}` : process.version,
    nodeCompatibility: process.version,
    platform: platform(),
    release: release(),
    cpu: cpus()[0]?.model,
  },
  samples,
};
await mkdir('artifacts', { recursive: true });
await writeFile('artifacts/performance-model.json', JSON.stringify(report, null, 2));
console.info(JSON.stringify(report, null, 2));
