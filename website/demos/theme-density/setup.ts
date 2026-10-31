import { setupDemo, type DemoSetup } from '../shared';
import { createConfig, createRows } from './config';
export default function setup(): DemoSetup {
  const config = createConfig();
  config.striped = true;
  config.columns.find((column) => column.field === 'qty')!.cellStyle = ({ value }) =>
    Number(value) > 8 ? { color: '#d46b08', fontWeight: 600 } : undefined;
  return setupDemo({ config, dataSource: createRows(), rowKey: 'id' }, (get) => [
    { label: '浅色', run: () => get().setTheme('light') },
    { label: '绿色', run: () => get().setTheme('green') },
    { label: '深色', run: () => get().setTheme('dark') },
    { label: '紧凑', run: () => get().setDensity('compact') },
    { label: '标准', run: () => get().setDensity('normal') },
  ]);
}
