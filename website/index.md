---
layout: home
hero:
  name: EditTable
  text: 为业务录入构建的可编辑表格
  tagline: 原生 TypeScript · 两表布局 · 分组计算 · 固定对比行
  actions:
    - theme: brand
      text: 快速开始
      link: /guide/getting-started
    - theme: alt
      text: 综合报价演示
      link: /demos/quotation/
features:
  - title: 数据与展示分离
    details: 真实记录、独立输入、派生行与汇总分别管理。
  - title: 事务级编辑
    details: 联动、计算、粘贴和历史遵循同一原子契约。
  - title: 大数据交互
    details: 行虚拟化、合并叠加层、固定对比与图标工具栏。
---

<script setup lang="ts">
const factory = () => import('./demos/quotation/setup').then((module) => module.default());
</script>

<div style="max-width:1200px;margin:32px auto;padding:0 24px"><TableDemo :factory="factory" :height="460" /></div>
