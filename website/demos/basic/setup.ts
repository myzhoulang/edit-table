import { setupDemo, type DemoSetup } from '../shared';
import { basicConfig, basicRows } from './config';
export default function setup(): DemoSetup {
  return setupDemo({ config: basicConfig, dataSource: basicRows, rowKey: 'id' });
}
