# 汇总

summary.items 为 { key, label, compute }，key 唯一。compute 接收 rows / results / context，返回原始有限标量。getSummary 返回冻结值，变化触发 summaryChange；宿主决定展示方式，核心不插入额外真实记录。

## 增量汇总

`update` 是可选的纯函数回调。第一次创建、整表同步及配置变化仍执行 `compute`；普通编辑和增删行可根据最终计算后的记录差量更新。未声明 update 的项目继续完整计算。撤销重做直接恢复历史快照。

| update 上下文             | 说明                                                                                            |
| ------------------------- | ----------------------------------------------------------------------------------------------- |
| previous                  | 该项目上一次的原始汇总标量                                                                      |
| changes                   | 冻结的 `{ rowKey, before?, after? }[]`；包含联动、计算后的最终记录；新增无 before，删除无 after |
| results / previousResults | 本次与上次的派生结果；独立输入变化时 changes 可以为空                                           |
| rows                      | 按需构造的完整冻结快照；读取此字段仍有完整数组的成本                                            |
| context                   | 配置中的业务上下文                                                                              |

```ts
import type { TableConfig } from 'edit-table';
type Item = { id: string; amount: number };
const config = {
  columns: [{ field: 'amount', title: '金额', editable: true, editor: 'number' }],
  summary: {
    items: [
      {
        key: 'amount',
        label: '合计',
        compute: ({ rows }) => rows.reduce((sum, row) => sum + row.amount, 0),
        update: ({ previous, changes }) =>
          Number(previous ?? 0) +
          changes.reduce(
            (delta, change) => delta + (change.after?.amount ?? 0) - (change.before?.amount ?? 0),
            0,
          ),
      },
    ],
  },
} satisfies TableConfig<Item>;
void config;
```

update 必须与 compute 数学等价，返回有限标量；抛错或返回非法值使整个事务回滚。核心无法从任意业务函数推导差量算法，因此不自动替换 compute。精确金额案例使用 BigNumber 的加减法更新十位小数字符串，不进行浮点近似。

[公共类型](/api/types) · [快速开始](/guide/getting-started)
