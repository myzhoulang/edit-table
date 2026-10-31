import { setupDemo, type DemoSetup } from '../shared';
import { basicConfig, basicRows } from './config';
export default function setup(): DemoSetup {
  let mode = 'ready';
  return setupDemo(
    {
      config: basicConfig,
      rowKey: 'id',
      dataLoader: async ({ signal }) => {
        try {
          await new Promise<void>((resolve, reject) => {
            const timer = setTimeout(resolve, 500);
            signal.addEventListener(
              'abort',
              () => {
                clearTimeout(timer);
                reject(new Error('请求已取消'));
              },
              { once: true },
            );
          });
          if (mode === 'error') throw new Error('模拟网络失败，可点击重试');
          return mode === 'empty' ? [] : basicRows;
        } catch (error) {
          throw error instanceof Error ? error : new Error(String(error));
        }
      },
    },
    (get) =>
      ['ready', 'empty', 'error'].map((value, index) => ({
        label: ['正常加载', '空数据', '加载失败'][index]!,
        run: () => {
          mode = value;
          return get().loadData();
        },
      })),
  );
}
