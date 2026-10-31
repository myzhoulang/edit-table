<script setup lang="ts">
const factory = () => import('./setup').then((module) => module.default());
</script>

# 大数据

切换 1 万 / 10 万 / 50 万行。

## 运行区

<TableDemo :factory="factory" :height="460" />

## 试一试

滚动并固定首行。50 万行超过安全高度会报告错误，不能视为支持规模。

## 配置代码

<<< @/demos/big-data/config.ts

## 关键 API

[实例](/api/instance) · [命令](/api/commands) · [事件](/api/events)

## 相关指南

[编辑](/guide/editing) · [分组合并](/guide/grouping-and-merge) · [固定对比](/guide/pinned-rows)
