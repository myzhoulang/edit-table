import { setupDemo, type DemoSetup } from '../shared';
import { validationConfig, validationRows } from './config';
export default function setup(): DemoSetup {
  return setupDemo(
    { config: validationConfig, dataSource: validationRows, rowKey: 'id' },
    (get) => [
      {
        label: '制造重复名称',
        run: () => get().updateFields([{ rowKey: 'r2', fields: { name: '记录 1' } }]),
      },
    ],
  );
}
