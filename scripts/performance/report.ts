import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { format, resolveConfig } from 'prettier';
import { record } from '../../packages/core/src/utils/immutable';
import type { StructureSample } from './structure';

type BrowserSample = {
  scenario: string;
  browser: string;
  version: string;
  count: number;
  columns: number;
  initMs: number;
  scrollScriptMs: number[];
  continuousScrollScriptMs: number[];
  editMs: number[];
  editWithSnapshotMs: number[];
  domRows: number;
};
type BrowserReport = {
  date: string;
  protocolVersion: number;
  environment: { cpu: string; platform: string };
  samples: BrowserSample[];
  structures?: StructureSample[];
};
function numericArray(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item: unknown) => typeof item === 'number' && Number.isFinite(item))
  );
}
function isSample(value: unknown): value is BrowserSample {
  return (
    record(value) &&
    ['scenario', 'browser', 'version'].every((field) => typeof value[field] === 'string') &&
    ['count', 'columns', 'initMs', 'domRows'].every(
      (field) => typeof value[field] === 'number' && Number.isFinite(value[field]),
    ) &&
    numericArray(value.scrollScriptMs) &&
    numericArray(value.continuousScrollScriptMs) &&
    numericArray(value.editMs) &&
    numericArray(value.editWithSnapshotMs)
  );
}
function isStructure(value: unknown): value is StructureSample {
  return (
    record(value) &&
    ['scenario', 'browser', 'version'].every((field) => typeof value[field] === 'string') &&
    ['count', 'initMs', 'domRows'].every(
      (field) => typeof value[field] === 'number' && Number.isFinite(value[field]),
    ) &&
    numericArray(value.insertMs) &&
    numericArray(value.deleteMs) &&
    typeof value.summaryStable === 'boolean' &&
    typeof value.headerReused === 'boolean'
  );
}
function assertReport(value: unknown, version: 3 | 4 = 4): asserts value is BrowserReport {
  if (
    !record(value) ||
    value.protocolVersion !== version ||
    typeof value.date !== 'string' ||
    !record(value.environment) ||
    typeof value.environment.cpu !== 'string' ||
    typeof value.environment.platform !== 'string' ||
    !Array.isArray(value.samples) ||
    !value.samples.length ||
    !value.samples.every(isSample) ||
    (version === 4 &&
      (!Array.isArray(value.structures) ||
        value.structures.length !== 6 ||
        !value.structures.every(isStructure)))
  ) {
    throw new Error(
      `浏览器基准格式无效，需要第 ${version} 版采样；当前数据请用 bun run benchmark:browser 生成。`,
    );
  }
}
function percentile(values: readonly number[], fraction: number): string {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))]!.toFixed(1);
}
async function main(): Promise<void> {
  try {
    const report: unknown = JSON.parse(
      await readFile('artifacts/performance-browser.json', 'utf8'),
    );
    assertReport(report);
    const before: unknown = JSON.parse(
      await readFile('artifacts/performance-browser-before-incremental.json', 'utf8'),
    );
    assertReport(before, 3);
    if (report.structures?.some((sample) => !sample.summaryStable || !sample.headerReused))
      throw new Error('结构采样中的汇总或表头复用检查未通过');
    const date = new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Shanghai',
      dateStyle: 'long',
    }).format(new Date(report.date));
    let page = `# 性能与验证\n\n测试日期：${date}。机器：${report.environment.cpu}，${report.environment.platform}；视口 1512 × 982，DPR 1。\n\n## 浏览器实测\n\n| 浏览器 | 场景 | 行数 | 初始化 ms | 连续滚动中位 / P95 ms | 大跨度滚动中位 ms | 可见单格更新中位 ms | 更新并读取完整快照 ms | DOM 数据行 |\n| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |\n`;
    for (const sample of report.samples)
      page += `| ${sample.browser} ${sample.version} | ${sample.scenario} | ${sample.count} | ${sample.initMs.toFixed(1)} | ${percentile(sample.continuousScrollScriptMs, 0.5)} / ${percentile(sample.continuousScrollScriptMs, 0.95)} | ${percentile(sample.scrollScriptMs, 0.5)} | ${percentile(sample.editMs, 0.5)} | ${percentile(sample.editWithSnapshotMs, 0.5)} | ${sample.domRows} |\n`;
    page += `\n原始 12 列为普通可编辑字段；精确金额案例为 13 列、BigNumber 计算与增量全表汇总。初始化包含数据工厂、模型和首屏。连续滚动每步 76 px，大跨度每步 3,000 px，各采样 60 次；在当前窗口中部记录上执行 5 次不同值更新，包含同步计算、投影、事件和 DOM 刷新。写入后读取完整冻结数组单独计时；业务计算不读取全表且没有 dataChange 订阅时，完整快照延迟到 getDataSource / getSubmission 或监听消费时构造。滚动数字是同步脚本耗时，不代表 GPU 或完整帧耗时。\n\n## 增量优化前后\n\n| 浏览器 | 十万行场景 | 原单格更新中位 ms | 当前单格更新中位 ms | 原更新并读取快照 ms | 当前更新并读取快照 ms |\n| --- | --- | ---: | ---: | ---: | ---: |\n`;
    for (const sample of report.samples.filter((item) => item.count === 100000)) {
      const old = before.samples.find(
        (item) =>
          item.count === sample.count &&
          item.scenario === sample.scenario &&
          item.browser === sample.browser,
      );
      if (old)
        page += `| ${sample.browser} | ${sample.scenario} | ${percentile(old.editMs, 0.5)} | ${percentile(sample.editMs, 0.5)} | ${percentile(old.editWithSnapshotMs, 0.5)} | ${percentile(sample.editWithSnapshotMs, 0.5)} |\n`;
    }
    page += `\n保留第 3 版基线；第 4 版沿用相同的可见目标与快照采样，新增结构变更场景。不同运行存在调度与计时精度误差，0.0 ms 表示低于显示精度。\n\n## 十万行结构变更\n\n| 浏览器 | 场景 | 初始化 ms | 中部插入中位 / P95 ms | 删除中位 / P95 ms | DOM 数据行 | 汇总稳定 / 表头复用 |\n| --- | --- | ---: | ---: | ---: | ---: | --- |\n`;
    for (const sample of report.structures ?? [])
      page += `| ${sample.browser} | ${sample.scenario} | ${sample.initMs.toFixed(1)} | ${percentile(sample.insertMs, 0.5)} / ${percentile(sample.insertMs, 0.95)} | ${percentile(sample.deleteMs, 0.5)} / ${percentile(sample.deleteMs, 0.95)} | ${sample.domRows} | ${sample.summaryStable ? '通过' : '失败'} / ${sample.headerReused ? '通过' : '失败'} |\n`;
    page += `\n每个场景在中部同一真实记录前插入、删除 5 组。新增身份通过完整快照查询，该读取位于结构写入计时区间之外；上表不代表包含完整快照读取的总耗时。无分组与 1000 个连续分组 / 小计分别采样。\n\n## 本次优化与边界\n\nsummary.update 接收最终计算后的记录变化，精确金额按差量增减；未提供 update 时继续完整 compute。冻结记录共享未变字段，完整数组与规则输入按需构造。普通记录复用 tr、td 和文本容器；连续滚动保留窗口交集节点。\n\n增删行按源变化和派生行边界拼接逻辑行段，复用无关分组、布局跨度和表头；块级 Fenwick 索引保留未变行高，视口按稳定记录身份保持位置。任意业务函数影响派生行可见性或布局兼容性时安全回退。\n\n拼接不意味着整个事务为常数时间：记录数组、身份索引、跨行计算和完整快照仍可能随行数增长。不同浏览器和业务配置的开销不同，不能统一保证所有场景达到初始化 1 秒、滚动 8 ms、单格更新 16 ms。\n\n## 原始采样与复现\n\n[浏览器 JSON](/performance-browser.json) · [纯模型 JSON](/performance-model.json) · [增量优化前浏览器 JSON](/performance-browser-before-incremental.json) · [早期节点池优化前 JSON](/performance-browser-before-pooling.json)\n\n运行 \`bun run benchmark\`，或启动演示服务后运行 \`bun run benchmark:browser\`，再用 \`bun run benchmark:report\` 同步本页和下载文件。采样期间保持代码静止并避免并行重负载。模型基准为 2 列、1 条计算，不与浏览器案例混比；早期节点池基线的目标与协议不同，也不作严格更新耗时对比。\n\n## 自动化与人工边界\n\n三种引擎、DPR 1/2、CSS zoom 80/100/125/150/200%，30 个组合通过。模型随机对照覆盖增删、历史、完整投影一致性与高度索引；浏览器覆盖编辑、合成 composition、粘贴、固定管理、逐行选择、连续编号、宽度填充、动态配置、自动行高和文档切页。十万行自动高度往返抽样检查 DOM 上限、无空白与锚点漂移不超过 1 px。\n\n已在本机正式 Safari 检查十万行展示、滚动、文本编辑、撤销和重做，并修复 grid 语义对工具栏与编辑浮层可访问性的影响。CSS zoom 不等同浏览器菜单缩放，WebKit 自动化不等同 Safari；真实中文输入法、物理触控板惯性及长时间手动验收仍需目标设备操作。\n`;
    const formatting = await resolveConfig('website/performance.md');
    await writeFile(
      'website/performance.md',
      await format(page, { ...formatting, parser: 'markdown' }),
    );
    await mkdir('website/public', { recursive: true });
    for (const name of [
      'performance-browser.json',
      'performance-model.json',
      'performance-browser-before-pooling.json',
      'performance-browser-before-incremental.json',
      'performance-model-before-incremental.json',
    ])
      await writeFile(
        `website/public/${name}`,
        await format(await readFile(`artifacts/${name}`, 'utf8'), {
          ...formatting,
          parser: 'json',
        }),
      );
    console.info('性能页与五个原始采样文件已同步。');
  } catch (error) {
    console.error('生成性能报告失败：', error);
    process.exitCode = 1;
  }
}
await main();
