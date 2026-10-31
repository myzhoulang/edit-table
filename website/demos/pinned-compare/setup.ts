import { setupDemo, type DemoSetup } from '../shared';
import { createConfig, createRows } from './config';
export default function setup(): DemoSetup {
  return setupDemo({ config: createConfig(), dataSource: createRows(), rowKey: 'id' }, (get) => [
    { label: '固定首行', run: () => get().pinRow(0) },
    { label: '固定第 20 行', run: () => get().pinRow(19) },
    { label: '清除对比行', run: () => get().clearPinnedRows() },
  ]);
}
