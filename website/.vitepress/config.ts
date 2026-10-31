import { defineConfig, postcssIsolateStyles } from 'vitepress';
import { fileURLToPath } from 'node:url';
const groups = [
  {
    text: '开始',
    items: [
      ['介绍', 'introduction'],
      ['快速开始', 'getting-started'],
      ['核心概念', 'concepts'],
    ].map(([text, path]) => ({ text, link: `/guide/${path}` })),
  },
  {
    text: '使用指南',
    items: [
      ['两表布局', 'two-table-layout'],
      ['分组与合并', 'grouping-and-merge'],
      ['计算与联动', 'calculations'],
      ['派生行与独立输入', 'derived-rows'],
      ['编辑器', 'editing'],
      ['选区与键盘', 'selection-keyboard'],
      ['复制与粘贴', 'clipboard'],
      ['校验与提交', 'validation'],
      ['历史', 'history'],
      ['加载', 'loading'],
      ['固定对比行', 'pinned-rows'],
      ['虚拟滚动', 'virtualization'],
      ['主题与工具栏', 'theming'],
      ['框架集成', 'framework-integration'],
      ['常见问题', 'troubleshooting'],
    ].map(([text, path]) => ({ text, link: `/guide/${path}` })),
  },
  {
    text: '配置参考',
    collapsed: true,
    items: [
      ['表格配置', 'table-config'],
      ['列', 'columns'],
      ['编辑器', 'editors'],
      ['分组与合并', 'groups-merges'],
      ['计算', 'calculations'],
      ['派生行', 'derived-rows'],
      ['汇总', 'summary'],
      ['行操作', 'operations'],
      ['样式与主题', 'style-and-theme'],
    ].map(([text, path]) => ({ text, link: `/config/${path}` })),
  },
  {
    text: 'API',
    collapsed: true,
    items: [
      ['创建实例', 'create-table'],
      ['实例方法', 'instance'],
      ['命令', 'commands'],
      ['事件', 'events'],
      ['类型', 'types'],
      ['错误', 'errors'],
    ].map(([text, path]) => ({ text, link: `/api/${path}` })),
  },
  {
    text: '交互演示',
    items: [
      ['基础编辑', 'basic'],
      ['分组合并', 'group-merge'],
      ['小计与优惠', 'subtotal-offer'],
      ['固定对比', 'pinned-compare'],
      ['大数据', 'big-data'],
      ['校验与提交', 'validation-submit'],
      ['加载状态', 'loading-states'],
      ['主题与密度', 'theme-density'],
      ['综合报价', 'quotation'],
    ].map(([text, path]) => ({ text, link: `/demos/${path}/` })),
  },
];
export default defineConfig({
  title: 'EditTable',
  description: '原生 TypeScript 可编辑表格组件库',
  lang: 'zh-CN',
  base: process.env.DOCS_BASE ?? '/',
  lastUpdated: true,
  cleanUrls: true,
  vite: {
    css: {
      postcss: {
        // 原生演示组件不继承文档正文的表格布局、字号和全局重置样式。
        plugins: [postcssIsolateStyles({ includeFiles: [/base\.css$/, /vp-doc\.css$/] })],
      },
    },
    resolve: {
      alias: [
        {
          find: /^edit-table$/,
          replacement: fileURLToPath(new URL('../../packages/core/src/index.ts', import.meta.url)),
        },
        {
          find: 'edit-table/style.css',
          replacement: fileURLToPath(
            new URL('../../packages/core/src/styles/style.css', import.meta.url),
          ),
        },
      ],
    },
  },
  themeConfig: {
    nav: [
      { text: '指南', link: '/guide/getting-started' },
      { text: '演示', link: '/demos/quotation/' },
      { text: 'API', link: '/api/instance' },
      { text: '性能', link: '/performance' },
    ],
    sidebar: groups,
    search: { provider: 'local' },
    outline: { label: '本页目录', level: [2, 3] },
    ...(process.env.DOCS_REPO
      ? {
          editLink: {
            pattern: `${process.env.DOCS_REPO}/edit/main/website/:path`,
            text: '编辑本页',
          },
        }
      : {}),
    footer: { message: '原生 TypeScript · ESM · 独立 CSS', copyright: 'EditTable' },
  },
});
