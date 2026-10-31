import { chromium, firefox, webkit } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { cpus, platform } from 'node:os';
import { measureStructure, type StructureSample } from './structure';
const samples: object[] = [];
const structures: StructureSample[] = [];
for (const [name, engine] of Object.entries({ chromium, firefox, webkit })) {
  const browser = await engine.launch();
  try {
    const page = await browser.newPage({
      viewport: { width: 1512, height: 982 },
      deviceScaleFactor: 1,
    });
    await page.goto('http://127.0.0.1:5179/');
    await page.waitForSelector('.et-body-table');
    for (const count of [10000, 100000]) {
      const init = await page.evaluate((size) => {
        const start = performance.now();
        window.createDemo(size);
        return performance.now() - start;
      }, count);
      const scrolling = await page.evaluate(async () => {
        const node = document.querySelector<HTMLElement>('.et-body-viewport');
        if (!node) throw new Error('表体不存在');
        const durations: number[] = [];
        for (let frame = 0; frame < 60; frame++) {
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
          const start = performance.now();
          node.scrollTop = frame * 3000;
          node.dispatchEvent(new Event('scroll'));
          durations.push(performance.now() - start);
        }
        return durations;
      });
      const continuous = await page.evaluate(async () => {
        const node = document.querySelector<HTMLElement>('.et-body-viewport');
        if (!node) throw new Error('表体不存在');
        const durations: number[] = [];
        for (let frame = 0; frame < 60; frame++) {
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
          const start = performance.now();
          node.scrollTop = 180000 + frame * 76;
          node.dispatchEvent(new Event('scroll'));
          durations.push(performance.now() - start);
        }
        return durations;
      });
      const edits = await page.evaluate(() => {
        const result: number[] = [];
        const visible = [
          ...document.querySelectorAll<HTMLElement>('.et-body-table tr[data-kind=record]'),
        ];
        const rowIndex = Number(visible[Math.floor(visible.length / 2)]?.dataset.viewIndex);
        const rowKey = window.table.getDataSource()[rowIndex]?.id;
        if (!rowKey) throw new Error('找不到可见编辑目标');
        for (let index = 0; index < 5; index++) {
          const start = performance.now();
          window.table.updateFields([{ rowKey, fields: { qty: index + 100 } }]);
          result.push(performance.now() - start);
        }
        const editWithSnapshotMs: number[] = [];
        for (let index = 0; index < 5; index++) {
          const start = performance.now();
          window.table.updateFields([{ rowKey, fields: { qty: index + 200 } }]);
          window.table.getDataSource();
          editWithSnapshotMs.push(performance.now() - start);
        }
        return { editMs: result, editWithSnapshotMs };
      });
      const rows = await page.locator('.et-body-table tr[data-kind=record]').count();
      samples.push({
        scenario: '精确金额案例',
        columns: 13,
        browser: name,
        version: browser.version(),
        count,
        dpr: 1,
        viewport: [1512, 982],
        initMs: init,
        scrollScriptMs: scrolling,
        continuousScrollScriptMs: continuous,
        ...edits,
        domRows: rows,
      });
    }
    const generic = await page.evaluate(async () => {
      const corePath = '/packages/core/src/index.ts',
        dataPath = '/website/demos/big-data/config.ts';
      const core: typeof import('../../packages/core/src/index') = await import(corePath);
      const data: typeof import('../../website/demos/big-data/config') = await import(dataPath);
      window.table.destroy();
      const host = document.querySelector<HTMLElement>('#table');
      if (!host) throw new Error('基准容器不存在');
      const start = performance.now();
      const table = core.createTable(host, {
        config: data.bigConfig,
        dataSource: data.createRows(100000),
        rowKey: 'id',
      });
      const initMs = performance.now() - start;
      const body = host.querySelector<HTMLElement>('.et-body-viewport');
      if (!body) throw new Error('基准表体不存在');
      const scrollScriptMs: number[] = [];
      for (let index = 0; index < 60; index++) {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        const time = performance.now();
        body.scrollTop = index * 3000;
        body.dispatchEvent(new Event('scroll'));
        scrollScriptMs.push(performance.now() - time);
      }
      const editMs: number[] = [];
      const continuousScrollScriptMs: number[] = [];
      for (let index = 0; index < 60; index++) {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        const time = performance.now();
        body.scrollTop = 180000 + index * 76;
        body.dispatchEvent(new Event('scroll'));
        continuousScrollScriptMs.push(performance.now() - time);
      }
      const visible = [
        ...host.querySelectorAll<HTMLElement>('.et-body-table tr[data-kind=record]'),
      ];
      const rowIndex = Number(visible[Math.floor(visible.length / 2)]?.dataset.viewIndex);
      const rowKey = table.getDataSource()[rowIndex]?.id;
      if (typeof rowKey !== 'string') throw new Error('找不到可见编辑目标');
      for (let index = 0; index < 5; index++) {
        const time = performance.now();
        table.updateFields([{ rowKey, fields: { col2: `修改 ${index}` } }]);
        editMs.push(performance.now() - time);
      }
      const editWithSnapshotMs: number[] = [];
      for (let index = 0; index < 5; index++) {
        const time = performance.now();
        table.updateFields([{ rowKey, fields: { col2: `完整快照修改 ${index}` } }]);
        table.getDataSource();
        editWithSnapshotMs.push(performance.now() - time);
      }
      const domRows = host.querySelectorAll('.et-body-table tr[data-kind=record]').length;
      table.destroy();
      return {
        initMs,
        scrollScriptMs,
        continuousScrollScriptMs,
        editMs,
        editWithSnapshotMs,
        domRows,
      };
    });
    samples.push({
      scenario: '原始 12 列',
      columns: 12,
      browser: name,
      version: browser.version(),
      count: 100000,
      dpr: 1,
      viewport: [1512, 982],
      ...generic,
    });
    structures.push(...(await measureStructure(page, name, browser.version())));
    await page.close();
  } finally {
    await browser.close();
  }
}
await mkdir('artifacts', { recursive: true });
await writeFile(
  'artifacts/performance-browser.json',
  JSON.stringify(
    {
      date: new Date().toISOString(),
      protocolVersion: 4,
      protocol: {
        jumpStepPx: 3000,
        continuousStepPx: 76,
        frames: 60,
        edits: 5,
        editTarget: 'visible-midpoint',
        snapshot:
          '另采样 editWithSnapshotMs，包含写入后立即读取冻结数据数组；dataChange 订阅同样需要该快照',
        structural:
          '在中部同一真实记录前插入并删除，共 5 组；获取新身份的完整快照读取位于计时区间之外',
      },
      environment: { cpu: cpus()[0]?.model, platform: platform() },
      samples,
      structures,
    },
    null,
    2,
  ),
);
console.info('浏览器性能采样已写入 artifacts/performance-browser.json');
