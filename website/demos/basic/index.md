<script setup lang="ts">
const factory = () => import('./setup').then((module) => module.default());
</script>

# 基础编辑

20 行，五种编辑器、键盘和剪贴板。

## 运行区

<TableDemo :factory="factory" :height="460" />

## 试一试

双击名称；使用 Enter 和 Tab；搜索候选，选择级联叶子。

## 配置代码

<<< @/demos/basic/config.ts

## 关键 API

[实例](/api/instance) · [命令](/api/commands) · [事件](/api/events)

## 相关指南

[编辑](/guide/editing) · [分组合并](/guide/grouping-and-merge) · [固定对比](/guide/pinned-rows)
