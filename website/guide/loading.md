# 数据加载

dataLoader({ signal, requestId }) 配置后自动首次加载，loadData / retryLoad 刷新，返回数组或 { rows, emptyReason }。新请求取消旧请求，epoch 与请求号保证忽略取消的旧响应仍不会写回。

宿主管理时使用 loading / loadError / emptyReason / onRetry，并通过 setLoadingState 后续同步。

状态包含 loading、refreshing、ready、empty、filtered-empty、error、refresh-error。刷新保留旧内容，失败提供重试。编辑、本地写入、换数和销毁使在途请求失效。

## 相关 API

[实例方法](/api/instance) · [配置](/config/table-config) · [命令](/api/commands)
