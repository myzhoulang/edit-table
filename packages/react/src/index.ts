import {
  createElement,
  forwardRef,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ForwardedRef,
  type ReactElement,
  type ReactNode,
  type RefAttributes,
} from 'react';
import { createPortal } from 'react-dom';
import {
  createTable,
  type CreateTableOptions,
  type Row,
  type TableConfig,
  type TableInstance,
} from 'edit-table';

export interface EditTableProps<TRow extends object = Row> {
  config: TableConfig<TRow>;
  dataSource?: TRow[];
  /** 仅此标识变化时同步 dataSource，普通父组件重渲染不会清除表格历史。 */
  dataVersion?: string | number;
  options?: Omit<CreateTableOptions<TRow>, 'config' | 'dataSource'>;
  renderers?: Record<
    string,
    (value: unknown, row: Readonly<TRow>, rows: readonly TRow[]) => ReactNode
  >;
  onReady?: (instance: TableInstance<TRow>) => void;
  onDataChange?: (rows: readonly TRow[]) => void;
  onConfigError?: (error: Error) => void;
  className?: string;
  style?: CSSProperties;
}
function assignRef<TRow extends object>(
  ref: ForwardedRef<TableInstance<TRow>>,
  value: TableInstance<TRow> | null,
): void {
  if (typeof ref === 'function') ref(value);
  else if (ref) ref.current = value;
}

function EditTableImpl<TRow extends object>(
  props: EditTableProps<TRow>,
  ref: ForwardedRef<TableInstance<TRow>>,
): ReactElement {
  const host = useRef<HTMLDivElement>(null),
    instance = useRef<TableInstance<TRow> | null>(null),
    latest = useRef(props);
  latest.current = props;
  const portals = useRef(new Map<HTMLElement, { key: number; content: ReactNode }>()),
    serial = useRef(0),
    mounted = useRef(false),
    scheduled = useRef(false);
  const [, redraw] = useState(0);
  function schedule(): void {
    if (scheduled.current) return;
    scheduled.current = true;
    queueMicrotask(() => {
      scheduled.current = false;
      if (mounted.current) redraw((value) => value + 1);
    });
  }
  const config = useMemo<TableConfig<TRow>>(
    () => ({
      ...props.config,
      columns: props.config.columns.map((column) => {
        const render = props.renderers?.[column.field];
        if (!render) return column;
        return {
          ...column,
          render(value, row, rows, container): () => void {
            // 独立挂载容器即使被核心移出文档，portal 仍可安全卸载内部节点。
            const mount = document.createElement('span');
            container.replaceChildren(mount);
            portals.current.set(mount, {
              key: ++serial.current,
              content: render(value, row, rows),
            });
            schedule();
            return () => {
              portals.current.delete(mount);
              schedule();
            };
          },
        };
      }),
    }),
    [props.config, props.renderers],
  );
  const appliedConfig = useRef(config),
    dataVersion = useRef(props.dataVersion);
  useEffect(() => {
    if (!host.current) return;
    mounted.current = true;
    const table = createTable(host.current, {
      ...latest.current.options,
      config,
      dataSource: latest.current.dataSource,
    });
    instance.current = table;
    appliedConfig.current = config;
    dataVersion.current = latest.current.dataVersion;
    const offData = table.on('dataChange', (event) =>
      latest.current.onDataChange?.(event.dataSource),
    );
    const offConfig = table.on('configError', (error) => latest.current.onConfigError?.(error));
    assignRef(ref, table);
    latest.current.onReady?.(table);
    return () => {
      mounted.current = false;
      offData();
      offConfig();
      table.destroy();
      portals.current.clear();
      instance.current = null;
      assignRef(ref, null);
    };
    // 实例只随组件挂载创建；动态配置与外部数据各走下方独立同步通道。
  }, []);
  useEffect(() => {
    if (instance.current && appliedConfig.current !== config) {
      if (instance.current.updateConfig(config)) appliedConfig.current = config;
    }
  }, [config]);
  useEffect(() => {
    if (instance.current && !Object.is(dataVersion.current, props.dataVersion)) {
      instance.current.setDataSource(latest.current.dataSource ?? []);
      dataVersion.current = props.dataVersion;
    }
  }, [props.dataVersion]);
  useEffect(() => {
    assignRef(ref, instance.current);
    return () => assignRef(ref, null);
  }, [ref]);
  return createElement(
    'div',
    { className: props.className, style: props.style },
    createElement('div', { ref: host }),
    [...portals.current].map(([container, portal]) =>
      createPortal(portal.content, container, String(portal.key)),
    ),
  );
}
/** forwardRef 会擦除组件的行泛型，断言仅恢复公开调用签名，不绕过内部类型检查。 */
export const EditTable = forwardRef(EditTableImpl) as <TRow extends object = Row>(
  props: EditTableProps<TRow> & RefAttributes<TableInstance<TRow>>,
) => ReactElement;
