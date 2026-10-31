import { setupDemo, type DemoSetup } from '../shared';
import { createConfig, createRows } from './config';
export default function setup(): DemoSetup {
  return setupDemo({ config: createConfig(), dataSource: createRows(), rowKey: 'id' });
}
