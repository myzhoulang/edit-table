import { setupDemo, type DemoSetup } from '../shared';
import { createConfig, rows } from './config';
export default function setup(): DemoSetup {
  return setupDemo({ config: createConfig(), dataSource: rows, rowKey: 'id' }, (get) => [
    {
      label: '输入优惠 180',
      run: () =>
        get().executeCommand('setDerivedValue', {
          ruleKey: 'offer',
          groupKey: 'p1',
          field: 'total',
          value: 180,
        }),
    },
    {
      label: '有效零优惠',
      run: () =>
        get().executeCommand('setDerivedValue', {
          ruleKey: 'offer',
          groupKey: 'p1',
          field: 'total',
          value: 0,
        }),
    },
    { label: '查看应付金额', run: () => get().getSummary() },
  ]);
}
