# 错误与失败码

TableConfigError 包含 path / code / message。配置失败原子保留上一状态。

| code                            | 解释                 | 处理                           |
| ------------------------------- | -------------------- | ------------------------------ |
| required                        | 缺必填配置           | 按 path 补齐                   |
| duplicate-id                    | 标识重复             | 检查列、行、分组、规则         |
| unknown-reference               | 引用失效             | 使用已声明列或分组 key         |
| cyclic-dependency               | 计算依赖循环         | 调整 reads / writes            |
| duplicate-writer                | 字段多个写入者       | 保留唯一写入规则               |
| crossing-layout / invalid-range | 布局交叉或范围无效   | 修正列范围                     |
| invalid-style / reserved-class  | 越界样式或保留类名   | 仅使用允许的业务外观           |
| readonly                        | 无写权限             | 检查表格、列、行锁定、计算字段 |
| invalid-target                  | 目标不存在或命令无效 | 检查身份和 payload             |
| rejected                        | 类型或拦截拒绝       | 修正草稿后重试                 |
| validation                      | 独立输入校验失败     | 按提示修正                     |
| calc-error                      | 计算或投影失败       | 根据 ruleId / rowKey 定位      |
| stale                           | 异步结果已过期       | 使用当前会话重新操作           |
| destroyed                       | 实例已销毁           | 创建新实例                     |

[配置参考](/config/table-config) · [命令](/api/commands)
