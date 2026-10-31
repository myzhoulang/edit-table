import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
async function scan(path: string): Promise<string[]> {
  try {
    const files: string[] = [];
    for (const entry of await readdir(path, { withFileTypes: true })) {
      const absolute = join(path, entry.name);
      if (entry.isDirectory()) files.push(...(await scan(absolute)));
      else if (
        /\.(css|js|ts)$/.test(entry.name) &&
        /position\s*:\s*sticky/i.test(await readFile(absolute, 'utf8'))
      )
        files.push(absolute);
    }
    return files;
  } catch (error) {
    throw new Error(`无法扫描 ${path}: ${String(error)}`);
  }
}
const violations = [...(await scan('packages/core/src')), ...(await scan('packages/core/dist'))];
if (violations.length) throw new Error(`发现禁止的定位样式：${violations.join(', ')}`);
console.info('源码与构建产物扫描通过：未使用禁止的定位样式。');
