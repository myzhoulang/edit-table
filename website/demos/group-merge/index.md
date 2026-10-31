<script setup lang="ts">
const factory = () => import('./setup').then((module) => module.default());
</script>

# 分组合并

连续两层分组与精确小计。

## 运行区

<TableDemo :factory="factory" :height="460" />

## 试一试

修改分类主格，检查整组改名；滚动观察分类穿过项目小计。

## 配置代码

<<< @/demos/group-merge/config.ts

## 关键 API

[实例](/api/instance) · [命令](/api/commands) · [事件](/api/events)

## 相关指南

[编辑](/guide/editing) · [分组合并](/guide/grouping-and-merge) · [固定对比](/guide/pinned-rows)
