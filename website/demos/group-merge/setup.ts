import { setupDemo, type DemoSetup } from '../shared';
import { createConfig } from './config';
import { createQuotationRows } from '../../../examples/quotation/config';
export default function setup(): DemoSetup {
  return setupDemo({ config: createConfig(), dataSource: createQuotationRows(), rowKey: 'id' });
}
