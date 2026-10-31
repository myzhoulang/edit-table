import { setupDemo, type DemoSetup } from '../shared';
import {
  createFinanceConfig,
  createFinanceRows,
  columnPresets,
} from '../../../examples/quotation/finance';
export default function setup(): DemoSetup {
  return setupDemo(
    { config: createFinanceConfig(0.05), dataSource: createFinanceRows(), rowKey: 'id' },
    (get) =>
      Object.entries(columnPresets).map(([name, fields]) => ({
        label: `${name} 列预设`,
        run: () =>
          get().setHiddenColumns(
            createFinanceConfig()
              .columns.filter((column) => !new Set<string>(fields).has(column.field))
              .map((column) => column.field),
          ),
      })),
  );
}
