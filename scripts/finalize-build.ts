import { readFile, writeFile } from 'node:fs/promises';
// Vite 已将样式提取为独立文件；声明入口不保留指向源码样式的副作用导入。
const path = 'packages/core/dist/index.d.ts';
const source = await readFile(path, 'utf8');
await writeFile(path, source.replace(/^import ['"].*\.css['"];?\s*$/gm, ''));
