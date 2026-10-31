<script setup lang="ts">
const factory = () => import('./setup').then((module) => module.default());
</script>

# 主题与密度

三主题、两密度、条件样式。

## 运行区

<TableDemo :factory="factory" :height="460" />

## 试一试

切换主题和密度，检查草稿与历史保留。

## 配置代码

<<< @/demos/theme-density/config.ts

## 关键 API

[实例](/api/instance) · [命令](/api/commands) · [事件](/api/events)

## 相关指南

[编辑](/guide/editing) · [分组合并](/guide/grouping-and-merge) · [固定对比](/guide/pinned-rows)
