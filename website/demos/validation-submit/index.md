<script setup lang="ts">
const factory = () => import('./setup').then((module) => module.default());
</script>

# 校验与提交

30 行，动态规则、去重和首错定位。

## 运行区

<TableDemo :factory="factory" :height="460" />

## 试一试

制造重复后全表校验，修正后采集提交数据。

## 配置代码

<<< @/demos/validation-submit/config.ts

## 关键 API

[实例](/api/instance) · [命令](/api/commands) · [事件](/api/events)

## 相关指南

[编辑](/guide/editing) · [分组合并](/guide/grouping-and-merge) · [固定对比](/guide/pinned-rows)
