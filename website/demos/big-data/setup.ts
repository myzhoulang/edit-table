import { setupDemo, type DemoSetup } from '../shared';
import { bigConfig, createRows } from './config';
export default function setup(): DemoSetup {
  return setupDemo({ config: bigConfig, dataSource: createRows(10000), rowKey: 'id' }, (get) =>
    [10000, 100000, 500000].map((count) => ({
      label: `${count / 10000} 万行`,
      run: () => {
        const start = performance.now();
        get().setDataSource(createRows(count));
        return `初始化 ${Math.round(performance.now() - start)} ms；超过安全总高度时会报告错误，请使用 1 万 / 10 万行。`;
      },
    })),
  );
}
