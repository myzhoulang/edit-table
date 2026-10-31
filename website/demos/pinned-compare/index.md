<script setup lang="ts">
const factory = () => import('./setup').then((module) => module.default());
</script>

# 固定对比

60 行，容量三行，源行同步。

## 运行区

<TableDemo :factory="factory" :height="460" />

## 试一试

固定多行后滚动；修改源行；悬停固定首列定位或取消。

## 配置代码

<<< @/demos/pinned-compare/config.ts

## 关键 API

[实例](/api/instance) · [命令](/api/commands) · [事件](/api/events)

## 相关指南

[编辑](/guide/editing) · [分组合并](/guide/grouping-and-merge) · [固定对比](/guide/pinned-rows)
