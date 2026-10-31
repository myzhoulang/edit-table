<script setup lang="ts">
const factory = () => import('./finance-setup').then((module) => module.default());
</script>

# 分层优惠与精确财务金额

6 类 × 1 项目 × 4 条需求，真实记录 24 条。服务费率为 5%，内部金额保留十位小数。

<TableDemo :factory="factory" :height="500" />

项目打包价替代该项目小计参与父级汇总，数字 0 有效。父级只汇总直接子级的有效结果。整表打包价覆盖所有根组，且与项目打包价互斥。切换列预设与密度设置互相独立。

<<< ../../../examples/quotation/finance.ts

[截图对应案例](/demos/quotation/) · [派生输入](/guide/derived-rows) · [实例方法](/api/instance)
