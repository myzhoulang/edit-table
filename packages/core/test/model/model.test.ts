import { describe, expect, it } from 'vitest';
import { createController, createModel } from '../../src/model/model';
import { config, rows, type TestRow } from '../fixture';
import { TableConfigError } from '../../src/model/config';

const offer = (
  value: unknown,
): { ruleKey: string; groupKey: string; field: string; value: unknown } => ({
  ruleKey: 'offer',
  groupKey: 'p1',
  field: 'total',
  value,
});
describe('M1 最小纵向切片与所有权', () => {
  it('初始计算、派生行隔离、冻结且不修改宿主', () => {
    const input = structuredClone(rows),
      model = createModel({ config: config(), dataSource: input, rowKey: 'id' });
    expect(model.getDataSource().map((row) => row.total)).toEqual([200, 50]);
    expect(model.getSummary().payable).toBe(250);
    expect(input[0]!.total).toBeUndefined();
    expect(Object.isFrozen(model.getDataSource()[0])).toBe(true);
    expect(model.getDataSource()).toBe(model.getDataSource());
    expect(model.getSubmission().records).toHaveLength(2);
  });
  it('180、0、清空与一次撤销', async () => {
    const model = createModel({ config: config(), dataSource: rows, rowKey: 'id' });
    expect((await model.executeCommand('setDerivedValue', offer(180))).ok).toBe(true);
    expect(model.getSummary().payable).toBe(180);
    expect(model.getDerivedValues()).toEqual([offer(180)]);
    await model.executeCommand('undo');
    expect(model.getSummary().payable).toBe(250);
    expect(model.getDerivedValues()).toEqual([]);
    await model.executeCommand('redo');
    expect(model.getSummary().payable).toBe(180);
    await model.executeCommand('setDerivedValue', offer(0));
    expect(model.getSummary().payable).toBe(0);
    await model.executeCommand('setDerivedValue', offer(null));
    expect(model.getSummary().payable).toBe(250);
    expect(model.getDerivedValues()).toEqual([]);
  });
  it('负数独立输入拒绝且不产生历史', async () => {
    const model = createModel({ config: config(), dataSource: rows, rowKey: 'id' });
    const result = await model.executeCommand('setDerivedValue', offer(-1));
    expect(result).toMatchObject({ ok: false, code: 'validation', message: '优惠价不能为负数' });
    expect(model.getSummary().payable).toBe(250);
    expect(model.getCommandState('undo').enabled).toBe(false);
  });
  it('合并编辑整组改名，独立输入跟随稳定 ID', async () => {
    const controller = createController({ config: config(), dataSource: rows, rowKey: 'id' });
    await controller.api.executeCommand('setDerivedValue', offer(180));
    await controller.write(
      [{ target: { kind: 'record', rowKey: 'r1', field: 'project' }, value: '新会场' }],
      'edit',
    );
    expect(controller.api.getDataSource().map((row) => row.project)).toEqual(['新会场', '新会场']);
    expect(controller.api.getDerivedValues()).toEqual([offer(180)]);
  });
  it('普通编辑只替换变化记录，计算输出不可直接写入', () => {
    const model = createModel({ config: config(), dataSource: rows, rowKey: 'id' });
    const before = model.getDataSource();
    expect(model.updateFields([{ rowKey: 'r1', fields: { qty: 3 } }]).ok).toBe(true);
    expect(model.getDataSource()[1]).toBe(before[1]);
    expect(model.getDataSource()[0]).not.toBe(before[0]);
    expect(model.getDataSource()[0]!.total).toBe(300);
    expect(model.updateFields([{ rowKey: 'r1', fields: { total: 1 } }]).ok).toBe(false);
  });
  it('100 次确定性随机编辑与全量重算一致', () => {
    const model = createModel({ config: config(), dataSource: rows, rowKey: 'id' });
    let seed = 19;
    for (let i = 0; i < 100; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      model.updateFields([{ rowKey: i % 2 ? 'r1' : 'r2', fields: { qty: seed % 50 } }]);
      const full = createModel({
        config: config(),
        dataSource: [...model.getDataSource()],
        rowKey: 'id',
      });
      expect(model.getDataSource()).toEqual(full.getDataSource());
      expect(model.getSummary()).toEqual(full.getSummary());
      expect(model.getDerivedRows()).toEqual(full.getDerivedRows());
    }
  });
});
describe('M2 事务与契约', () => {
  it('计算异常整体回滚，历史和事件不变', () => {
    const next = config();
    next.calculations![0]!.compute = ({ row }) => {
      if (row.qty === 99) throw new Error('计算失败');
      return { total: row.qty * row.price };
    };
    const model = createModel({ config: next, dataSource: rows, rowKey: 'id' });
    const before = model.getDataSource();
    let events = 0;
    model.on('dataChange', () => events++);
    expect(model.updateFields([{ rowKey: 'r1', fields: { qty: 99 } }])).toMatchObject({
      ok: false,
      code: 'calc-error',
    });
    expect(model.getDataSource()).toBe(before);
    expect(events).toBe(0);
    expect(model.getCommandState('undo').enabled).toBe(false);
  });
  it('联动和计算属于同一条历史', async () => {
    const next = config();
    next.fieldTransitions = [
      { id: 'price', trigger: { field: 'name' }, apply: () => ({ price: 200 }) },
    ];
    const model = createController({ config: next, dataSource: rows, rowKey: 'id' });
    await model.write(
      [{ target: { kind: 'record', rowKey: 'r1', field: 'name' }, value: '换名' }],
      'edit',
    );
    expect(model.api.getDataSource()[0]!.total).toBe(400);
    await model.api.executeCommand('undo');
    expect(model.api.getDataSource()[0]).toMatchObject({ name: '租赁', price: 100, total: 200 });
  });
  it('外部同步不通知、业务替换通知、两者清历史', () => {
    const model = createModel({ config: config(), dataSource: rows, rowKey: 'id' });
    let events = 0;
    model.on('dataChange', (event) => {
      events++;
      expect(Object.isFrozen(event)).toBe(true);
    });
    model.updateFields([{ rowKey: 'r1', fields: { qty: 3 } }]);
    model.setDataSource(rows);
    expect(events).toBe(1);
    expect(model.getCommandState('undo').enabled).toBe(false);
    model.replaceDataSource([{ ...rows[0]!, qty: 4 }]);
    expect(events).toBe(2);
  });
  it('监听异常被隔离，销毁幂等，晚到结果丢弃', async () => {
    const caught: Error[] = [];
    const controller = createController({
      config: config(),
      dataSource: rows,
      rowKey: 'id',
      onError: (error) => caught.push(error),
    });
    controller.api.on('dataChange', () => {
      throw new Error('监听失败');
    });
    controller.api.updateFields([{ rowKey: 'r1', fields: { qty: 3 } }]);
    expect(caught[0]!.message).toBe('监听失败');
    const token = controller.epoch.current();
    controller.api.setDataSource(rows);
    expect(
      (
        await controller.write(
          [{ target: { kind: 'record', rowKey: 'r1', field: 'qty' }, value: 5 }],
          'edit',
          token,
        )
      ).code,
    ).toBe('stale');
    controller.api.destroy();
    controller.api.destroy();
    expect((await controller.api.executeCommand('undo')).code).toBe('destroyed');
  });
  it('锁定阻止写入和删除；复制生成新身份', async () => {
    const model = createModel({ config: config(), dataSource: rows, rowKey: 'id' });
    await model.executeCommand('lockRows', { rowKeys: ['r1'] });
    expect(model.updateFields([{ rowKey: 'r1', fields: { qty: 9 } }]).ok).toBe(false);
    expect((await model.executeCommand('deleteRows', { rowKeys: ['r1'] })).ok).toBe(false);
    await model.executeCommand('duplicateRows', { rowKeys: ['r2'] });
    expect(model.getDataSource()).toHaveLength(3);
    expect(new Set(model.getDataSource().map((row) => row.id)).size).toBe(3);
  });
});
describe('配置与校验', () => {
  it('循环、重复、未知引用与越界样式被拒绝', () => {
    const loop = config();
    loop.calculations!.push({
      id: 'loop',
      scope: 'row',
      reads: ['total'],
      writes: ['qty'],
      compute: () => ({ qty: 1 }),
    });
    expect(() => createModel({ config: loop })).toThrow(TableConfigError);
    const bad = config();
    bad.merges!.vertical![0]!.by = 'missing';
    expect(() => createModel({ config: bad })).toThrow('未知分组');
    const style = config();
    style.columns[0]!.cellStyle = { position: 'absolute' };
    expect(() => createModel({ config: style })).toThrow('不允许修改布局属性');
  });
  it('失败配置保留上一有效状态', () => {
    const model = createModel({ config: config(), dataSource: rows, rowKey: 'id' });
    const before = model.getDataSource();
    const next = config();
    next.columns.push(next.columns[0]!);
    expect(model.updateConfig(next)).toBe(false);
    expect(model.getDataSource()).toBe(before);
  });
  it('动态规则、去重与提交校验', async () => {
    const next = config();
    next.columns[1]!.deduplication = { message: '需求重复' };
    const model = createModel<TestRow>({
      config: next,
      rowKey: 'id',
      dataSource: [rows[0]!, { ...rows[1]!, name: '租赁', qty: -1 }],
    });
    const result = await model.validate();
    expect(result.valid).toBe(false);
    expect(result.errors.map((e) => e.message)).toContain('需求重复');
    expect(result.errors.map((e) => e.message)).toContain('数量不能为负数');
    expect(Object.isFrozen(model.getSubmission())).toBe(true);
  });
});
