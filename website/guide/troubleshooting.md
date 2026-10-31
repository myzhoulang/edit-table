# 常见问题

## 没有滚动

给宿主设置高度，或传 height 指定表体可视高度。

## 零值优惠失效

使用 ?? 判断空值，不要用 || 覆盖有效数字 0。

## 配置更新失败

读取 configError 的 path / code / message，检查标识、引用、计算拓扑和受限样式。

## SSR 报错

只有浏览器挂载后调用 createTable；纯模型使用 createModel。模块导入本身不访问 DOM。

## 手动合并

先声明允许的列，再选择单列连续真实记录，确认预览。

## 相关 API

[实例方法](/api/instance) · [配置](/config/table-config) · [命令](/api/commands)
