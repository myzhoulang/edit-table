<script setup lang="ts">
const factory = () => import('./setup').then((module) => module.default());
</script>

# 小计与优惠

真实记录、独立输入、最终汇总。

## 运行区

<TableDemo :factory="factory" :height="460" />

## 试一试

输入 180、0、清空，查看应付；输入负数检查拒绝；撤销一次恢复。

## 配置代码

<<< @/demos/subtotal-offer/config.ts

## 关键 API

[实例](/api/instance) · [命令](/api/commands) · [事件](/api/events)

## 相关指南

[编辑](/guide/editing) · [分组合并](/guide/grouping-and-merge) · [固定对比](/guide/pinned-rows)
