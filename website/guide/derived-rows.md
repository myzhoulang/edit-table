# 派生行与独立输入

派生行支持 aggregate、input、compute、text。input 为显式可写入口，其余只读。聚合读取当前作用域全部真实记录，包含子孙，不包含派生行本身；子组先于父组投影，同组按声明顺序执行。

独立输入由 ruleKey / groupKey / field 定位。0 有效，清空回退默认值。getDerivedValues 只输出偏离默认值的项，setDerivedValues([]) 完整清空。

无法匹配的组输入被丢弃，derivedValuesChange 报告 dropped。validateDerivedValues 可约束跨组互斥；外部回填也检查。精确金额由示例的 BigNumber 聚合提供。

## 相关 API

[实例方法](/api/instance) · [配置](/config/table-config) · [命令](/api/commands)
