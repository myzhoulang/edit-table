import {
  createTable,
  type CreateTableOptions,
  type Scalar,
  type TableInstance,
  type Theme,
} from 'edit-table';
export type DemoHandle = Pick<
  TableInstance<object>,
  'destroy' | 'setTheme' | 'executeCommand' | 'getSummary'
>;
export type DemoSetup = {
  create: (container: HTMLElement, theme: Theme) => DemoHandle;
  actions?: { label: string; run: () => unknown | Promise<unknown> }[];
};
export function setupDemo<TRow extends object>(
  options: CreateTableOptions<TRow>,
  extra?: (get: () => TableInstance<TRow>) => NonNullable<DemoSetup['actions']>,
): DemoSetup {
  let instance: TableInstance<TRow>;
  return {
    create(container, theme) {
      instance = createTable(container, { ...options, theme });
      return instance;
    },
    actions: [
      {
        label: '全表校验',
        run: async () => {
          try {
            return await instance.validate();
          } catch (error) {
            return error instanceof Error ? error.message : String(error);
          }
        },
      },
      { label: '采集提交数据', run: () => instance.getSubmission() },
      ...(extra?.(() => instance) ?? []),
    ],
  };
}
export function sum(rows: readonly object[], field: string): Scalar {
  return rows.reduce((total, row) => total + Number(Reflect.get(row, field) ?? 0), 0);
}
