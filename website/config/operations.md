# 行操作

operations.actions 支持 add / remove 简写或完整动作对象。对象有 key / label / kind / scope / position / minRemaining / rowDefaults / inheritFields / visible / enabled / create / execute。

上下文 rows 只含真实记录，start / end 为源数据闭区间。visible 控制出现，enabled 在展示和执行时检查；create 可异步返回新记录或 false，execute 可接管流程。默认菜单提供插入、删除、复制、锁定、固定对比。

| 参数              | 必填 / 默认值 | 行为                                           |
| ----------------- | ------------- | ---------------------------------------------- |
| key / label       | 必填          | 动作身份与菜单文字                             |
| kind              | add           | add / remove / duplicate / lock / pin / custom |
| icon / danger     | 无 / false    | 图标前缀与危险样式                             |
| scope             | row           | row / table / 分组 key                         |
| fields            | 所有列        | 限制动作出现的字段                             |
| position          | after         | before / after 作用域；end 为全表末尾          |
| minRemaining      | 0             | 删除后最少真实记录数                           |
| message           | 默认限制提示  | 覆盖删除失败原因                               |
| rowDefaults       | {}            | 新记录默认字段                                 |
| inheritFields     | []            | 从当前行继承字段                               |
| visible / enabled | true          | 展示与执行时检查                               |
| create            | 无            | 异步返回新记录或 false，过期不应用             |
| execute           | 无            | 完全接管动作，异常显示错误                     |

add / remove 简写对应默认菜单已有动作；完整对象追加自定义操作。默认与自定义动作遵守 readonly，删除还遵守锁定和最小剩余数限制。

[公共类型](/api/types) · [快速开始](/guide/getting-started)
