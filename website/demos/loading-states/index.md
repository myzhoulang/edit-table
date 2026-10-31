<script setup lang="ts">
const factory = () => import('./setup').then((module) => module.default());
</script>

# 加载状态

首次加载、刷新、空态、失败重试。

## 运行区

<TableDemo :factory="factory" :height="460" />

## 试一试

快速切换请求模式，观察旧响应被丢弃。

## 配置代码

<<< @/demos/loading-states/config.ts

## 关键 API

[实例](/api/instance) · [命令](/api/commands) · [事件](/api/events)

## 相关指南

[编辑](/guide/editing) · [分组合并](/guide/grouping-and-merge) · [固定对比](/guide/pinned-rows)
