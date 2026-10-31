<script setup lang="ts">
const factory = () => import('./setup').then((module) => module.default());
</script>

# 综合报价

截图结构：分类 → 项目、字段联动与精确小计。

## 运行区

<TableDemo :factory="factory" :height="460" />

## 试一试

修改数量、发票、日期；右键锁定、复制与固定对比。

## 配置代码

<<< ../../../examples/quotation/config.ts

## 关键 API

[实例](/api/instance) · [命令](/api/commands) · [事件](/api/events)

## 相关指南

[编辑](/guide/editing) · [分组合并](/guide/grouping-and-merge) · [固定对比](/guide/pinned-rows)

[案例 A：分层优惠与精确财务金额](/demos/quotation/finance)
