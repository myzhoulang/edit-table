import { readdir, readFile, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const execute = promisify(execFile);
async function files(path: string): Promise<string[]> {
  const result: string[] = [];
  for (const entry of await readdir(path, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'generated') continue;
    const absolute = join(path, entry.name);
    if (entry.isDirectory()) result.push(...(await files(absolute)));
    else if (entry.name.endsWith('.md')) result.push(absolute);
  }
  return result;
}
await mkdir('website/.snippets', { recursive: true });
let count = 0;
try {
  for (const path of await files('website')) {
    const text = await readFile(path, 'utf8');
    for (const match of text.matchAll(/```(?:ts|typescript)\s*\n([\s\S]*?)```/g)) {
      await writeFile(`website/.snippets/example-${count++}.ts`, `${match[1]}\nexport {};\n`);
    }
  }
  if (count) await execute('bun', ['x', 'tsc', '-p', 'tsconfig.snippets.json', '--noEmit']);
  console.info(`文档内 ${count} 个 TypeScript 代码块检查通过；引入的配置文件由项目类型检查覆盖。`);
} catch (error) {
  if (error !== null && typeof error === 'object' && 'stdout' in error)
    console.error(String(error.stdout));
  throw error;
} finally {
  await rm('website/.snippets', { recursive: true, force: true });
}
