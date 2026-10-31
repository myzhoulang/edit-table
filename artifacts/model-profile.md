# CPU Profile

| Duration | Samples | Interval | Functions |
|----------|---------|----------|----------|
| 3.75s | 2855 | 1.0ms | 93 |

**Top 10:** `freeze` 42.1%, `values` 22.0%, `entries` 4.6%, `map` 2.9%, `freeze` 2.8%, `freeze` 2.1%, `fromEntries` 2.1%, `freeze` 1.6%, `freeze` 1.5%, `project` 1.4%

## Hot Functions (Self Time)

| Self% | Self | Total% | Total | Function | Location |
|------:|-----:|-------:|------:|----------|----------|
| 42.1% | 1.58s | 42.1% | 1.58s | `freeze` | `[native code]` |
| 22.0% | 827.8ms | 22.0% | 827.8ms | `values` | `[native code]` |
| 4.6% | 172.8ms | 4.6% | 172.8ms | `entries` | `[native code]` |
| 2.9% | 111.9ms | 12.5% | 473.0ms | `map` | `[native code]` |
| 2.8% | 108.6ms | 2.8% | 108.6ms | `freeze` | `/Users/zhoulangzhoulang/development/edit-table/packages/core/src/utils/immutable.ts:10` |
| 2.1% | 80.3ms | 58.0% | 2.18s | `freeze` | `/Users/zhoulangzhoulang/development/edit-table/packages/core/src/utils/immutable.ts:12` |
| 2.1% | 78.9ms | 2.1% | 78.9ms | `fromEntries` | `[native code]` |
| 1.6% | 61.1ms | 43.7% | 1.64s | `freeze` | `/Users/zhoulangzhoulang/development/edit-table/packages/core/src/utils/immutable.ts:13` |
| 1.5% | 57.4ms | 1.5% | 57.4ms | `freeze` | `/Users/zhoulangzhoulang/development/edit-table/packages/core/src/utils/immutable.ts:11` |
| 1.4% | 54.8ms | 11.1% | 420.5ms | `project` | `/Users/zhoulangzhoulang/development/edit-table/packages/core/src/model/pipeline.ts:36` |
| 1.4% | 54.6ms | 1.4% | 54.6ms | `assign` | `[native code]` |
| 1.2% | 47.7ms | 1.2% | 47.7ms | `stringify` | `[native code]` |
| 1.2% | 45.2ms | 1.2% | 45.2ms | `freeze` | `/Users/zhoulangzhoulang/development/edit-table/packages/core/src/utils/immutable.ts` |
| 1.0% | 38.1ms | 11.8% | 446.5ms | `own` | `/Users/zhoulangzhoulang/development/edit-table/packages/core/src/utils/immutable.ts:17` |
| 0.9% | 34.9ms | 0.9% | 34.9ms | `createView` | `/Users/zhoulangzhoulang/development/edit-table/packages/core/src/view/view.ts:32` |
| 0.9% | 34.8ms | 0.9% | 34.8ms | `Map` | `[native code]` |
| 0.8% | 33.6ms | 8.6% | 325.8ms | `(anonymous)` | `/Users/zhoulangzhoulang/development/edit-table/packages/core/src/model/model.ts:31` |
| 0.8% | 33.6ms | 0.8% | 33.6ms | `arrayIteratorNextHelper` | `[native code]` |
| 0.8% | 30.7ms | 0.8% | 30.7ms | `createView` | `/Users/zhoulangzhoulang/development/edit-table/packages/core/src/view/view.ts:35` |
| 0.7% | 28.8ms | 2.1% | 78.8ms | `project` | `/Users/zhoulangzhoulang/development/edit-table/packages/core/src/model/pipeline.ts:33` |
| 0.7% | 28.4ms | 1.6% | 62.0ms | `createView` | `/Users/zhoulangzhoulang/development/edit-table/packages/core/src/view/view.ts:30` |
| 0.6% | 24.4ms | 0.7% | 27.1ms | `(anonymous)` | `/Users/zhoulangzhoulang/development/edit-table/packages/core/src/utils/immutable.ts:6` |
| 0.5% | 20.1ms | 1.8% | 70.8ms | `filter` | `[native code]` |
| 0.4% | 17.0ms | 0.4% | 17.0ms | `(anonymous)` | `/Users/zhoulangzhoulang/development/edit-table/packages/core/src/model/grouping.ts:6` |
| 0.4% | 15.5ms | 0.4% | 15.5ms | `slice` | `[native code]` |
| 0.3% | 14.0ms | 0.3% | 14.0ms | `createView` | `/Users/zhoulangzhoulang/development/edit-table/packages/core/src/view/view.ts:49` |
| 0.2% | 10.2ms | 0.2% | 10.2ms | `keyOf` | `/Users/zhoulangzhoulang/development/edit-table/packages/core/src/model/model.ts` |
| 0.2% | 10.1ms | 0.2% | 10.1ms | `includes` | `[native code]` |
| 0.2% | 8.1ms | 3.0% | 113.1ms | `project` | `/Users/zhoulangzhoulang/development/edit-table/packages/core/src/model/pipeline.ts:34` |
| 0.1% | 6.8ms | 0.1% | 6.8ms | `project` | `/Users/zhoulangzhoulang/development/edit-table/packages/core/src/model/pipeline.ts:75` |
| 0.1% | 6.6ms | 0.1% | 6.6ms | `createView` | `/Users/zhoulangzhoulang/development/edit-table/packages/core/src/view/view.ts:31` |
| 0.1% | 6.0ms | 7.9% | 300.0ms | `clone` | `/Users/zhoulangzhoulang/development/edit-table/packages/core/src/utils/immutable.ts:6` |
| 0.1% | 6.0ms | 0.1% | 6.0ms | `compute` | `/Users/zhoulangzhoulang/development/edit-table/scripts/performance/model.ts:7` |
| 0.1% | 5.4ms | 0.1% | 6.5ms | `scalar` | `/Users/zhoulangzhoulang/development/edit-table/packages/core/src/utils/immutable.ts:20` |
| 0.1% | 5.3ms | 0.6% | 25.4ms | `from` | `[native code]` |
| 0.1% | 4.8ms | 0.1% | 4.8ms | `project` | `/Users/zhoulangzhoulang/development/edit-table/packages/core/src/model/pipeline.ts:23` |
| 0.1% | 4.2ms | 0.1% | 4.2ms | `(anonymous)` | `/Users/zhoulangzhoulang/development/edit-table/packages/core/src/utils/immutable.ts` |
| 0.1% | 4.0ms | 0.1% | 4.0ms | `(anonymous)` | `/Users/zhoulangzhoulang/development/edit-table/packages/core/src/model/pipeline.ts` |
| 0.1% | 3.9ms | 0.1% | 3.9ms | `createView` | `/Users/zhoulangzhoulang/development/edit-table/packages/core/src/view/view.ts:34` |
| 0.0% | 3.2ms | 0.0% | 3.2ms | `_isNativeFunction` | `/Users/zhoulangzhoulang/development/edit-table/node_modules/.bun/async-validator@4.2.5/node_modules/async-validator/dist-node/index.js` |
| 0.0% | 3.0ms | 0.0% | 3.0ms | `resolve` | `[native code]` |
| 0.0% | 2.9ms | 0.0% | 2.9ms | `(anonymous)` | `/Users/zhoulangzhoulang/development/edit-table/scripts/performance/model.ts:10` |
| 0.0% | 2.8ms | 0.2% | 8.9ms | `parseModule` | `[native code]` |
| 0.0% | 2.7ms | 0.0% | 2.7ms | `project` | `/Users/zhoulangzhoulang/development/edit-table/packages/core/src/model/pipeline.ts:35` |
| 0.0% | 2.6ms | 0.0% | 2.6ms | `(anonymous)` | `/Users/zhoulangzhoulang/development/edit-table/packages/core/src/model/pipeline.ts:15` |
| 0.0% | 1.6ms | 0.0% | 1.6ms | `@lazy` | `[native code]` |
| 0.0% | 1.4ms | 0.0% | 2.6ms | `project` | `/Users/zhoulangzhoulang/development/edit-table/packages/core/src/model/pipeline.ts:31` |
| 0.0% | 1.4ms | 0.0% | 1.4ms | `clone` | `/Users/zhoulangzhoulang/development/edit-table/packages/core/src/utils/immutable.ts:3` |
| 0.0% | 1.4ms | 0.0% | 1.4ms | `Float64Array` | `[native code]` |
| 0.0% | 1.4ms | 0.0% | 2.7ms | `find` | `[native code]` |
| 0.0% | 1.4ms | 0.0% | 1.4ms | `createView` | `/Users/zhoulangzhoulang/development/edit-table/packages/core/src/view/view.ts` |
| 0.0% | 1.4ms | 99.5% | 3.73s | `(module)` | `/Users/zhoulangzhoulang/development/edit-table/scripts/performance/model.ts:11` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `(anonymous)` | `/Users/zhoulangzhoulang/development/edit-table/packages/core/src/model/model.ts:46` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `normalizeConfig` | `/Users/zhoulangzhoulang/development/edit-table/packages/core/src/model/config.ts` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `clone` | `/Users/zhoulangzhoulang/development/edit-table/packages/core/src/utils/immutable.ts:4` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `bound` | `node:os` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `get` | `[native code]` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `createController` | `/Users/zhoulangzhoulang/development/edit-table/packages/core/src/model/model.ts:182` |

## Call Tree (Total Time)

| Total% | Total | Self% | Self | Function | Location |
|-------:|------:|------:|-----:|----------|----------|
| 99.6% | 3.74s | 0.0% | 0us | `evaluate` | `[native code]` |
| 99.6% | 3.74s | 0.0% | 0us | `async asyncModuleEvaluation` | `[native code]` |
| 99.5% | 3.73s | 0.0% | 1.4ms | `(module)` | `/Users/zhoulangzhoulang/development/edit-table/scripts/performance/model.ts:11` |
| 61.9% | 2.32s | 0.0% | 0us | `createController` | `/Users/zhoulangzhoulang/development/edit-table/packages/core/src/model/model.ts:32` |
| 58.0% | 2.18s | 2.1% | 80.3ms | `freeze` | `/Users/zhoulangzhoulang/development/edit-table/packages/core/src/utils/immutable.ts:12` |
| 43.7% | 1.64s | 1.6% | 61.1ms | `freeze` | `/Users/zhoulangzhoulang/development/edit-table/packages/core/src/utils/immutable.ts:13` |
| 42.1% | 1.58s | 42.1% | 1.58s | `freeze` | `[native code]` |
| 33.1% | 1.24s | 0.0% | 0us | `apply` | `/Users/zhoulangzhoulang/development/edit-table/packages/core/src/model/model.ts:117` |
| 22.1% | 830.6ms | 0.0% | 0us | `project` | `/Users/zhoulangzhoulang/development/edit-table/packages/core/src/model/pipeline.ts:14` |
| 22.0% | 827.8ms | 22.0% | 827.8ms | `values` | `[native code]` |
| 15.3% | 577.0ms | 0.0% | 0us | `project` | `/Users/zhoulangzhoulang/development/edit-table/packages/core/src/model/pipeline.ts:76` |
| 14.9% | 562.4ms | 0.0% | 0us | `derive` | `/Users/zhoulangzhoulang/development/edit-table/packages/core/src/model/pipeline.ts:48` |
| 14.9% | 562.4ms | 0.0% | 0us | `project` | `/Users/zhoulangzhoulang/development/edit-table/packages/core/src/model/pipeline.ts:74` |
| 14.8% | 556.0ms | 0.0% | 0us | `project` | `/Users/zhoulangzhoulang/development/edit-table/packages/core/src/model/pipeline.ts:19` |
| 12.5% | 473.0ms | 2.9% | 111.9ms | `map` | `[native code]` |
| 11.8% | 446.5ms | 1.0% | 38.1ms | `own` | `/Users/zhoulangzhoulang/development/edit-table/packages/core/src/utils/immutable.ts:17` |
| 11.1% | 420.5ms | 1.4% | 54.8ms | `project` | `/Users/zhoulangzhoulang/development/edit-table/packages/core/src/model/pipeline.ts:36` |
| 8.6% | 325.8ms | 0.8% | 33.6ms | `(anonymous)` | `/Users/zhoulangzhoulang/development/edit-table/packages/core/src/model/model.ts:31` |
| 7.9% | 300.0ms | 0.1% | 6.0ms | `clone` | `/Users/zhoulangzhoulang/development/edit-table/packages/core/src/utils/immutable.ts:6` |
| 4.6% | 172.8ms | 4.6% | 172.8ms | `entries` | `[native code]` |
| 3.0% | 113.1ms | 0.2% | 8.1ms | `project` | `/Users/zhoulangzhoulang/development/edit-table/packages/core/src/model/pipeline.ts:34` |
| 2.8% | 108.6ms | 2.8% | 108.6ms | `freeze` | `/Users/zhoulangzhoulang/development/edit-table/packages/core/src/utils/immutable.ts:10` |
| 2.1% | 78.9ms | 2.1% | 78.9ms | `fromEntries` | `[native code]` |
| 2.1% | 78.8ms | 0.7% | 28.8ms | `project` | `/Users/zhoulangzhoulang/development/edit-table/packages/core/src/model/pipeline.ts:33` |
| 1.8% | 70.8ms | 0.5% | 20.1ms | `filter` | `[native code]` |
| 1.6% | 62.0ms | 0.7% | 28.4ms | `createView` | `/Users/zhoulangzhoulang/development/edit-table/packages/core/src/view/view.ts:30` |
| 1.5% | 57.4ms | 1.5% | 57.4ms | `freeze` | `/Users/zhoulangzhoulang/development/edit-table/packages/core/src/utils/immutable.ts:11` |
| 1.4% | 54.6ms | 1.4% | 54.6ms | `assign` | `[native code]` |
| 1.2% | 47.7ms | 0.0% | 0us | `(anonymous)` | `/Users/zhoulangzhoulang/development/edit-table/packages/core/src/model/pipeline.ts:34` |
| 1.2% | 47.7ms | 0.0% | 0us | `same` | `/Users/zhoulangzhoulang/development/edit-table/packages/core/src/utils/immutable.ts:22` |
| 1.2% | 47.7ms | 1.2% | 47.7ms | `stringify` | `[native code]` |
| 1.2% | 45.2ms | 1.2% | 45.2ms | `freeze` | `/Users/zhoulangzhoulang/development/edit-table/packages/core/src/utils/immutable.ts` |
| 1.1% | 41.4ms | 0.0% | 0us | `project` | `/Users/zhoulangzhoulang/development/edit-table/packages/core/src/model/pipeline.ts:15` |
| 0.9% | 34.9ms | 0.9% | 34.9ms | `createView` | `/Users/zhoulangzhoulang/development/edit-table/packages/core/src/view/view.ts:32` |
| 0.9% | 34.8ms | 0.9% | 34.8ms | `Map` | `[native code]` |
| 0.8% | 33.6ms | 0.0% | 0us | `next` | `[native code]` |
| 0.8% | 33.6ms | 0.8% | 33.6ms | `arrayIteratorNextHelper` | `[native code]` |
| 0.8% | 30.7ms | 0.8% | 30.7ms | `createView` | `/Users/zhoulangzhoulang/development/edit-table/packages/core/src/view/view.ts:35` |
| 0.7% | 27.1ms | 0.6% | 24.4ms | `(anonymous)` | `/Users/zhoulangzhoulang/development/edit-table/packages/core/src/utils/immutable.ts:6` |
| 0.6% | 25.4ms | 0.1% | 5.3ms | `from` | `[native code]` |
| 0.5% | 20.9ms | 0.0% | 0us | `groupRows` | `/Users/zhoulangzhoulang/development/edit-table/packages/core/src/model/grouping.ts:6` |
| 0.4% | 17.0ms | 0.4% | 17.0ms | `(anonymous)` | `/Users/zhoulangzhoulang/development/edit-table/packages/core/src/model/grouping.ts:6` |
| 0.4% | 15.5ms | 0.4% | 15.5ms | `slice` | `[native code]` |
| 0.3% | 14.0ms | 0.3% | 14.0ms | `createView` | `/Users/zhoulangzhoulang/development/edit-table/packages/core/src/view/view.ts:49` |
| 0.3% | 13.3ms | 0.0% | 0us | `project` | `/Users/zhoulangzhoulang/development/edit-table/packages/core/src/model/pipeline.ts:13` |
| 0.3% | 11.9ms | 0.0% | 0us | `async (anonymous)` | `[native code]` |
| 0.2% | 10.6ms | 0.0% | 0us | `project` | `/Users/zhoulangzhoulang/development/edit-table/packages/core/src/model/pipeline.ts:40` |
| 0.2% | 10.2ms | 0.2% | 10.2ms | `keyOf` | `/Users/zhoulangzhoulang/development/edit-table/packages/core/src/model/model.ts` |
| 0.2% | 10.1ms | 0.2% | 10.1ms | `includes` | `[native code]` |
| 0.2% | 8.9ms | 0.0% | 2.8ms | `parseModule` | `[native code]` |
| 0.2% | 7.6ms | 0.0% | 0us | `project` | `/Users/zhoulangzhoulang/development/edit-table/packages/core/src/model/pipeline.ts:42` |
| 0.1% | 7.1ms | 0.0% | 0us | `project` | `/Users/zhoulangzhoulang/development/edit-table/packages/core/src/model/pipeline.ts:10` |
| 0.1% | 6.8ms | 0.1% | 6.8ms | `project` | `/Users/zhoulangzhoulang/development/edit-table/packages/core/src/model/pipeline.ts:75` |
| 0.1% | 6.6ms | 0.1% | 6.6ms | `createView` | `/Users/zhoulangzhoulang/development/edit-table/packages/core/src/view/view.ts:31` |
| 0.1% | 6.5ms | 0.1% | 5.4ms | `scalar` | `/Users/zhoulangzhoulang/development/edit-table/packages/core/src/utils/immutable.ts:20` |
| 0.1% | 6.0ms | 0.1% | 6.0ms | `compute` | `/Users/zhoulangzhoulang/development/edit-table/scripts/performance/model.ts:7` |
| 0.1% | 6.0ms | 0.0% | 0us | `project` | `/Users/zhoulangzhoulang/development/edit-table/packages/core/src/model/pipeline.ts:30` |
| 0.1% | 4.8ms | 0.1% | 4.8ms | `project` | `/Users/zhoulangzhoulang/development/edit-table/packages/core/src/model/pipeline.ts:23` |
| 0.1% | 4.4ms | 0.0% | 0us | `(module)` | `/Users/zhoulangzhoulang/development/edit-table/scripts/performance/model.ts:10` |
| 0.1% | 4.2ms | 0.1% | 4.2ms | `(anonymous)` | `/Users/zhoulangzhoulang/development/edit-table/packages/core/src/utils/immutable.ts` |
| 0.1% | 4.0ms | 0.0% | 0us | `clone` | `/Users/zhoulangzhoulang/development/edit-table/packages/core/src/utils/immutable.ts:5` |
| 0.1% | 4.0ms | 0.1% | 4.0ms | `(anonymous)` | `/Users/zhoulangzhoulang/development/edit-table/packages/core/src/model/pipeline.ts` |
| 0.1% | 3.9ms | 0.1% | 3.9ms | `createView` | `/Users/zhoulangzhoulang/development/edit-table/packages/core/src/view/view.ts:34` |
| 0.0% | 3.2ms | 0.0% | 0us | `_wrapNativeSuper` | `/Users/zhoulangzhoulang/development/edit-table/node_modules/.bun/async-validator@4.2.5/node_modules/async-validator/dist-node/index.js:82` |
| 0.0% | 3.2ms | 0.0% | 0us | `(anonymous)` | `/Users/zhoulangzhoulang/development/edit-table/node_modules/.bun/async-validator@4.2.5/node_modules/async-validator/dist-node/index.js:269` |
| 0.0% | 3.2ms | 0.0% | 3.2ms | `_isNativeFunction` | `/Users/zhoulangzhoulang/development/edit-table/node_modules/.bun/async-validator@4.2.5/node_modules/async-validator/dist-node/index.js` |
| 0.0% | 3.0ms | 0.0% | 3.0ms | `resolve` | `[native code]` |
| 0.0% | 2.9ms | 0.0% | 2.9ms | `(anonymous)` | `/Users/zhoulangzhoulang/development/edit-table/scripts/performance/model.ts:10` |
| 0.0% | 2.7ms | 0.0% | 0us | `canWrite` | `/Users/zhoulangzhoulang/development/edit-table/packages/core/src/model/model.ts:46` |
| 0.0% | 2.7ms | 0.0% | 0us | `apply` | `/Users/zhoulangzhoulang/development/edit-table/packages/core/src/model/model.ts:85` |
| 0.0% | 2.7ms | 0.0% | 1.4ms | `find` | `[native code]` |
| 0.0% | 2.7ms | 0.0% | 2.7ms | `project` | `/Users/zhoulangzhoulang/development/edit-table/packages/core/src/model/pipeline.ts:35` |
| 0.0% | 2.7ms | 0.0% | 0us | `createController` | `/Users/zhoulangzhoulang/development/edit-table/packages/core/src/model/model.ts:25` |
| 0.0% | 2.6ms | 0.0% | 1.4ms | `project` | `/Users/zhoulangzhoulang/development/edit-table/packages/core/src/model/pipeline.ts:31` |
| 0.0% | 2.6ms | 0.0% | 2.6ms | `(anonymous)` | `/Users/zhoulangzhoulang/development/edit-table/packages/core/src/model/pipeline.ts:15` |
| 0.0% | 2.2ms | 0.0% | 0us | `project` | `/Users/zhoulangzhoulang/development/edit-table/packages/core/src/model/pipeline.ts:20` |
| 0.0% | 1.6ms | 0.0% | 0us | `node:fs/promises` | `node:fs/promises:2` |
| 0.0% | 1.6ms | 0.0% | 1.6ms | `@lazy` | `[native code]` |
| 0.0% | 1.5ms | 0.0% | 0us | `createView` | `/Users/zhoulangzhoulang/development/edit-table/packages/core/src/view/view.ts:20` |
| 0.0% | 1.4ms | 0.0% | 1.4ms | `clone` | `/Users/zhoulangzhoulang/development/edit-table/packages/core/src/utils/immutable.ts:3` |
| 0.0% | 1.4ms | 0.0% | 0us | `RowMetrics` | `/Users/zhoulangzhoulang/development/edit-table/packages/core/src/view/metrics.ts:5` |
| 0.0% | 1.4ms | 0.0% | 0us | `createView` | `/Users/zhoulangzhoulang/development/edit-table/packages/core/src/view/view.ts:75` |
| 0.0% | 1.4ms | 0.0% | 1.4ms | `Float64Array` | `[native code]` |
| 0.0% | 1.4ms | 0.0% | 1.4ms | `createView` | `/Users/zhoulangzhoulang/development/edit-table/packages/core/src/view/view.ts` |
| 0.0% | 1.3ms | 0.0% | 1.3ms | `(anonymous)` | `/Users/zhoulangzhoulang/development/edit-table/packages/core/src/model/model.ts:46` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `normalizeConfig` | `/Users/zhoulangzhoulang/development/edit-table/packages/core/src/model/config.ts` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `clone` | `/Users/zhoulangzhoulang/development/edit-table/packages/core/src/utils/immutable.ts:4` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `bound` | `node:os` |
| 0.0% | 1.2ms | 0.0% | 0us | `node:os` | `node:os:110` |
| 0.0% | 1.2ms | 0.0% | 1.2ms | `get` | `[native code]` |
| 0.0% | 1.1ms | 0.0% | 0us | `apply` | `/Users/zhoulangzhoulang/development/edit-table/packages/core/src/model/model.ts:110` |
| 0.0% | 1.0ms | 0.0% | 1.0ms | `createController` | `/Users/zhoulangzhoulang/development/edit-table/packages/core/src/model/model.ts:182` |
| 0.0% | 1.0ms | 0.0% | 0us | `apply` | `/Users/zhoulangzhoulang/development/edit-table/packages/core/src/model/model.ts:111` |

## Function Details

### `freeze`
`[native code]` | Self: 42.1% (1.58s) | Total: 42.1% (1.58s) | Samples: 1190

**Called by:**
- `freeze` (1190)

### `values`
`[native code]` | Self: 22.0% (827.8ms) | Total: 22.0% (827.8ms) | Samples: 636

**Called by:**
- `freeze` (636)

### `entries`
`[native code]` | Self: 4.6% (172.8ms) | Total: 4.6% (172.8ms) | Samples: 138

**Called by:**
- `clone` (96)
- `project` (28)
- `project` (14)

### `map`
`[native code]` | Self: 2.9% (111.9ms) | Total: 12.5% (473.0ms) | Samples: 85

**Called by:**
- `createController` (256)
- `clone` (86)
- `project` (8)
- `project` (6)
- `project` (6)
- `clone` (3)
- `project` (2)

**Calls:**
- `(anonymous)` (255)
- `(anonymous)` (21)
- `(anonymous)` (3)
- `(anonymous)` (2)
- `(anonymous)` (1)

### `freeze`
`/Users/zhoulangzhoulang/development/edit-table/packages/core/src/utils/immutable.ts:10` | Self: 2.8% (108.6ms) | Total: 2.8% (108.6ms) | Samples: 81

**Called by:**
- `freeze` (79)
- `(anonymous)` (2)

### `freeze`
`/Users/zhoulangzhoulang/development/edit-table/packages/core/src/utils/immutable.ts:12` | Self: 2.1% (80.3ms) | Total: 58.0% (2.18s) | Samples: 63

**Called by:**
- `project` (634)
- `freeze` (481)
- `derive` (162)
- `project` (161)
- `project` (156)
- `project` (34)
- `own` (34)

**Calls:**
- `values` (636)
- `freeze` (481)
- `freeze` (363)
- `freeze` (79)
- `freeze` (37)
- `freeze` (3)

### `fromEntries`
`[native code]` | Self: 2.1% (78.9ms) | Total: 2.1% (78.9ms) | Samples: 63

**Called by:**
- `clone` (47)
- `project` (14)
- `own` (2)

### `freeze`
`/Users/zhoulangzhoulang/development/edit-table/packages/core/src/utils/immutable.ts:13` | Self: 1.6% (61.1ms) | Total: 43.7% (1.64s) | Samples: 46

**Called by:**
- `freeze` (363)
- `derive` (267)
- `project` (266)
- `project` (261)
- `own` (41)
- `project` (35)
- `(anonymous)` (3)

**Calls:**
- `freeze` (1190)

### `freeze`
`/Users/zhoulangzhoulang/development/edit-table/packages/core/src/utils/immutable.ts:11` | Self: 1.5% (57.4ms) | Total: 1.5% (57.4ms) | Samples: 44

**Called by:**
- `freeze` (37)
- `own` (5)
- `project` (2)

### `project`
`/Users/zhoulangzhoulang/development/edit-table/packages/core/src/model/pipeline.ts:36` | Self: 1.4% (54.8ms) | Total: 11.1% (420.5ms) | Samples: 43

**Called by:**
- `createController` (321)
- `apply` (4)

**Calls:**
- `own` (131)
- `assign` (41)
- `freeze` (35)
- `freeze` (34)
- `freeze` (31)
- `slice` (8)
- `freeze` (2)

### `assign`
`[native code]` | Self: 1.4% (54.6ms) | Total: 1.4% (54.6ms) | Samples: 41

**Called by:**
- `project` (41)

### `stringify`
`[native code]` | Self: 1.2% (47.7ms) | Total: 1.2% (47.7ms) | Samples: 37

**Called by:**
- `same` (37)

### `freeze`
`/Users/zhoulangzhoulang/development/edit-table/packages/core/src/utils/immutable.ts` | Self: 1.2% (45.2ms) | Total: 1.2% (45.2ms) | Samples: 35

**Called by:**
- `project` (31)
- `freeze` (3)
- `(anonymous)` (1)

### `own`
`/Users/zhoulangzhoulang/development/edit-table/packages/core/src/utils/immutable.ts:17` | Self: 1.0% (38.1ms) | Total: 11.8% (446.5ms) | Samples: 29

**Called by:**
- `(anonymous)` (215)
- `project` (131)
- `apply` (1)
- `createController` (1)

**Calls:**
- `clone` (234)
- `freeze` (41)
- `freeze` (34)
- `freeze` (5)
- `fromEntries` (2)
- `clone` (1)
- `clone` (1)
- `clone` (1)

### `createView`
`/Users/zhoulangzhoulang/development/edit-table/packages/core/src/view/view.ts:32` | Self: 0.9% (34.9ms) | Total: 0.9% (34.9ms) | Samples: 27

**Called by:**
- `(module)` (27)

### `Map`
`[native code]` | Self: 0.9% (34.8ms) | Total: 0.9% (34.8ms) | Samples: 27

**Called by:**
- `project` (26)
- `createView` (1)

### `(anonymous)`
`/Users/zhoulangzhoulang/development/edit-table/packages/core/src/model/model.ts:31` | Self: 0.8% (33.6ms) | Total: 8.6% (325.8ms) | Samples: 26

**Called by:**
- `map` (255)

**Calls:**
- `own` (215)
- `keyOf` (8)
- `freeze` (3)
- `freeze` (2)
- `freeze` (1)

### `arrayIteratorNextHelper`
`[native code]` | Self: 0.8% (33.6ms) | Total: 0.8% (33.6ms) | Samples: 26

**Called by:**
- `next` (26)

### `createView`
`/Users/zhoulangzhoulang/development/edit-table/packages/core/src/view/view.ts:35` | Self: 0.8% (30.7ms) | Total: 0.8% (30.7ms) | Samples: 24

**Called by:**
- `(module)` (24)

### `project`
`/Users/zhoulangzhoulang/development/edit-table/packages/core/src/model/pipeline.ts:33` | Self: 0.7% (28.8ms) | Total: 2.1% (78.8ms) | Samples: 22

**Called by:**
- `createController` (62)

**Calls:**
- `entries` (28)
- `includes` (7)
- `scalar` (5)

### `createView`
`/Users/zhoulangzhoulang/development/edit-table/packages/core/src/view/view.ts:30` | Self: 0.7% (28.4ms) | Total: 1.6% (62.0ms) | Samples: 15

**Called by:**
- `(module)` (41)

**Calls:**
- `next` (26)

### `(anonymous)`
`/Users/zhoulangzhoulang/development/edit-table/packages/core/src/utils/immutable.ts:6` | Self: 0.6% (24.4ms) | Total: 0.7% (27.1ms) | Samples: 19

**Called by:**
- `map` (21)

**Calls:**
- `clone` (2)

### `filter`
`[native code]` | Self: 0.5% (20.1ms) | Total: 1.8% (70.8ms) | Samples: 15

**Called by:**
- `project` (54)

**Calls:**
- `(anonymous)` (37)
- `(anonymous)` (2)

### `(anonymous)`
`/Users/zhoulangzhoulang/development/edit-table/packages/core/src/model/grouping.ts:6` | Self: 0.4% (17.0ms) | Total: 0.4% (17.0ms) | Samples: 13

**Called by:**
- `from` (13)

### `slice`
`[native code]` | Self: 0.4% (15.5ms) | Total: 0.4% (15.5ms) | Samples: 13

**Called by:**
- `project` (8)
- `derive` (4)
- `apply` (1)

### `createView`
`/Users/zhoulangzhoulang/development/edit-table/packages/core/src/view/view.ts:49` | Self: 0.3% (14.0ms) | Total: 0.3% (14.0ms) | Samples: 10

**Called by:**
- `(module)` (10)

### `keyOf`
`/Users/zhoulangzhoulang/development/edit-table/packages/core/src/model/model.ts` | Self: 0.2% (10.2ms) | Total: 0.2% (10.2ms) | Samples: 8

**Called by:**
- `(anonymous)` (8)

### `includes`
`[native code]` | Self: 0.2% (10.1ms) | Total: 0.2% (10.1ms) | Samples: 8

**Called by:**
- `project` (7)
- `scalar` (1)

### `project`
`/Users/zhoulangzhoulang/development/edit-table/packages/core/src/model/pipeline.ts:34` | Self: 0.2% (8.1ms) | Total: 3.0% (113.1ms) | Samples: 6

**Called by:**
- `createController` (88)

**Calls:**
- `filter` (54)
- `fromEntries` (14)
- `entries` (14)

### `project`
`/Users/zhoulangzhoulang/development/edit-table/packages/core/src/model/pipeline.ts:75` | Self: 0.1% (6.8ms) | Total: 0.1% (6.8ms) | Samples: 5

**Called by:**
- `createController` (5)

### `createView`
`/Users/zhoulangzhoulang/development/edit-table/packages/core/src/view/view.ts:31` | Self: 0.1% (6.6ms) | Total: 0.1% (6.6ms) | Samples: 5

**Called by:**
- `(module)` (5)

### `clone`
`/Users/zhoulangzhoulang/development/edit-table/packages/core/src/utils/immutable.ts:6` | Self: 0.1% (6.0ms) | Total: 7.9% (300.0ms) | Samples: 5

**Called by:**
- `own` (234)

**Calls:**
- `entries` (96)
- `map` (86)
- `fromEntries` (47)

### `compute`
`/Users/zhoulangzhoulang/development/edit-table/scripts/performance/model.ts:7` | Self: 0.1% (6.0ms) | Total: 0.1% (6.0ms) | Samples: 5

**Called by:**
- `project` (5)

### `scalar`
`/Users/zhoulangzhoulang/development/edit-table/packages/core/src/utils/immutable.ts:20` | Self: 0.1% (5.4ms) | Total: 0.1% (6.5ms) | Samples: 4

**Called by:**
- `project` (5)

**Calls:**
- `includes` (1)

### `from`
`[native code]` | Self: 0.1% (5.3ms) | Total: 0.6% (25.4ms) | Samples: 4

**Called by:**
- `groupRows` (16)
- `(module)` (3)

**Calls:**
- `(anonymous)` (13)
- `(anonymous)` (2)

### `project`
`/Users/zhoulangzhoulang/development/edit-table/packages/core/src/model/pipeline.ts:23` | Self: 0.1% (4.8ms) | Total: 0.1% (4.8ms) | Samples: 4

**Called by:**
- `createController` (4)

### `(anonymous)`
`/Users/zhoulangzhoulang/development/edit-table/packages/core/src/utils/immutable.ts` | Self: 0.1% (4.2ms) | Total: 0.1% (4.2ms) | Samples: 3

**Called by:**
- `map` (3)

### `(anonymous)`
`/Users/zhoulangzhoulang/development/edit-table/packages/core/src/model/pipeline.ts` | Self: 0.1% (4.0ms) | Total: 0.1% (4.0ms) | Samples: 3

**Called by:**
- `filter` (2)
- `map` (1)

### `createView`
`/Users/zhoulangzhoulang/development/edit-table/packages/core/src/view/view.ts:34` | Self: 0.1% (3.9ms) | Total: 0.1% (3.9ms) | Samples: 3

**Called by:**
- `(module)` (3)

### `_isNativeFunction`
`/Users/zhoulangzhoulang/development/edit-table/node_modules/.bun/async-validator@4.2.5/node_modules/async-validator/dist-node/index.js` | Self: 0.0% (3.2ms) | Total: 0.0% (3.2ms) | Samples: 1

**Called by:**
- `_wrapNativeSuper` (1)

### `resolve`
`[native code]` | Self: 0.0% (3.0ms) | Total: 0.0% (3.0ms) | Samples: 2

**Called by:**
- `async (anonymous)` (2)

### `(anonymous)`
`/Users/zhoulangzhoulang/development/edit-table/scripts/performance/model.ts:10` | Self: 0.0% (2.9ms) | Total: 0.0% (2.9ms) | Samples: 2

**Called by:**
- `from` (2)

### `parseModule`
`[native code]` | Self: 0.0% (2.8ms) | Total: 0.2% (8.9ms) | Samples: 2

**Called by:**
- `async (anonymous)` (5)

**Calls:**
- `(anonymous)` (1)
- `node:os` (1)
- `node:fs/promises` (1)

### `project`
`/Users/zhoulangzhoulang/development/edit-table/packages/core/src/model/pipeline.ts:35` | Self: 0.0% (2.7ms) | Total: 0.0% (2.7ms) | Samples: 2

**Called by:**
- `createController` (2)

### `(anonymous)`
`/Users/zhoulangzhoulang/development/edit-table/packages/core/src/model/pipeline.ts:15` | Self: 0.0% (2.6ms) | Total: 0.0% (2.6ms) | Samples: 2

**Called by:**
- `map` (2)

### `@lazy`
`[native code]` | Self: 0.0% (1.6ms) | Total: 0.0% (1.6ms) | Samples: 1

**Called by:**
- `node:fs/promises` (1)

### `project`
`/Users/zhoulangzhoulang/development/edit-table/packages/core/src/model/pipeline.ts:31` | Self: 0.0% (1.4ms) | Total: 0.0% (2.6ms) | Samples: 1

**Called by:**
- `createController` (2)

**Calls:**
- `get` (1)

### `clone`
`/Users/zhoulangzhoulang/development/edit-table/packages/core/src/utils/immutable.ts:3` | Self: 0.0% (1.4ms) | Total: 0.0% (1.4ms) | Samples: 1

**Called by:**
- `own` (1)

### `Float64Array`
`[native code]` | Self: 0.0% (1.4ms) | Total: 0.0% (1.4ms) | Samples: 1

**Called by:**
- `RowMetrics` (1)

### `find`
`[native code]` | Self: 0.0% (1.4ms) | Total: 0.0% (2.7ms) | Samples: 1

**Called by:**
- `canWrite` (2)

**Calls:**
- `(anonymous)` (1)

### `createView`
`/Users/zhoulangzhoulang/development/edit-table/packages/core/src/view/view.ts` | Self: 0.0% (1.4ms) | Total: 0.0% (1.4ms) | Samples: 1

**Called by:**
- `(module)` (1)

### `(module)`
`/Users/zhoulangzhoulang/development/edit-table/scripts/performance/model.ts:11` | Self: 0.0% (1.4ms) | Total: 99.5% (3.73s) | Samples: 1

**Called by:**
- `evaluate` (2845)

**Calls:**
- `createController` (1776)
- `apply` (948)
- `createView` (41)
- `createView` (27)
- `createView` (24)
- `createView` (10)
- `createView` (5)
- `createView` (3)
- `createController` (2)
- `apply` (2)
- `apply` (1)
- `createView` (1)
- `createController` (1)
- `apply` (1)
- `createView` (1)
- `createView` (1)

### `(anonymous)`
`/Users/zhoulangzhoulang/development/edit-table/packages/core/src/model/model.ts:46` | Self: 0.0% (1.3ms) | Total: 0.0% (1.3ms) | Samples: 1

**Called by:**
- `find` (1)

### `normalizeConfig`
`/Users/zhoulangzhoulang/development/edit-table/packages/core/src/model/config.ts` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `createController` (1)

### `clone`
`/Users/zhoulangzhoulang/development/edit-table/packages/core/src/utils/immutable.ts:4` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `own` (1)

### `bound`
`node:os` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `node:os` (1)

### `get`
`[native code]` | Self: 0.0% (1.2ms) | Total: 0.0% (1.2ms) | Samples: 1

**Called by:**
- `project` (1)

### `createController`
`/Users/zhoulangzhoulang/development/edit-table/packages/core/src/model/model.ts:182` | Self: 0.0% (1.0ms) | Total: 0.0% (1.0ms) | Samples: 1

**Called by:**
- `(module)` (1)

### `async (anonymous)`
`[native code]` | Self: 0.0% (0us) | Total: 0.3% (11.9ms) | Samples: 0

**Calls:**
- `parseModule` (5)
- `resolve` (2)

### `(anonymous)`
`/Users/zhoulangzhoulang/development/edit-table/packages/core/src/model/pipeline.ts:34` | Self: 0.0% (0us) | Total: 1.2% (47.7ms) | Samples: 0

**Called by:**
- `filter` (37)

**Calls:**
- `same` (37)

### `derive`
`/Users/zhoulangzhoulang/development/edit-table/packages/core/src/model/pipeline.ts:48` | Self: 0.0% (0us) | Total: 14.9% (562.4ms) | Samples: 0

**Called by:**
- `project` (433)

**Calls:**
- `freeze` (267)
- `freeze` (162)
- `slice` (4)

### `(module)`
`/Users/zhoulangzhoulang/development/edit-table/scripts/performance/model.ts:10` | Self: 0.0% (0us) | Total: 0.1% (4.4ms) | Samples: 0

**Called by:**
- `evaluate` (3)

**Calls:**
- `from` (3)

### `createController`
`/Users/zhoulangzhoulang/development/edit-table/packages/core/src/model/model.ts:32` | Self: 0.0% (0us) | Total: 61.9% (2.32s) | Samples: 0

**Called by:**
- `(module)` (1776)

**Calls:**
- `project` (321)
- `project` (318)
- `map` (256)
- `project` (224)
- `project` (216)
- `project` (216)
- `project` (88)
- `project` (62)
- `project` (32)
- `project` (10)
- `project` (6)
- `project` (5)
- `project` (5)
- `project` (4)
- `project` (4)
- `project` (3)
- `project` (2)
- `project` (2)
- `project` (2)

### `groupRows`
`/Users/zhoulangzhoulang/development/edit-table/packages/core/src/model/grouping.ts:6` | Self: 0.0% (0us) | Total: 0.5% (20.9ms) | Samples: 0

**Called by:**
- `project` (10)
- `project` (6)

**Calls:**
- `from` (16)

### `clone`
`/Users/zhoulangzhoulang/development/edit-table/packages/core/src/utils/immutable.ts:5` | Self: 0.0% (0us) | Total: 0.1% (4.0ms) | Samples: 0

**Called by:**
- `(anonymous)` (2)
- `own` (1)

**Calls:**
- `map` (3)

### `project`
`/Users/zhoulangzhoulang/development/edit-table/packages/core/src/model/pipeline.ts:76` | Self: 0.0% (0us) | Total: 15.3% (577.0ms) | Samples: 0

**Called by:**
- `createController` (216)
- `apply` (206)

**Calls:**
- `freeze` (261)
- `freeze` (161)

### `project`
`/Users/zhoulangzhoulang/development/edit-table/packages/core/src/model/pipeline.ts:40` | Self: 0.0% (0us) | Total: 0.2% (10.6ms) | Samples: 0

**Called by:**
- `createController` (4)
- `apply` (4)

**Calls:**
- `map` (8)

### `project`
`/Users/zhoulangzhoulang/development/edit-table/packages/core/src/model/pipeline.ts:19` | Self: 0.0% (0us) | Total: 14.8% (556.0ms) | Samples: 0

**Called by:**
- `createController` (216)
- `apply` (206)

**Calls:**
- `freeze` (266)
- `freeze` (156)

### `project`
`/Users/zhoulangzhoulang/development/edit-table/packages/core/src/model/pipeline.ts:74` | Self: 0.0% (0us) | Total: 14.9% (562.4ms) | Samples: 0

**Called by:**
- `createController` (224)
- `apply` (209)

**Calls:**
- `derive` (433)

### `async asyncModuleEvaluation`
`[native code]` | Self: 0.0% (0us) | Total: 99.6% (3.74s) | Samples: 0

**Calls:**
- `evaluate` (2848)

### `node:fs/promises`
`node:fs/promises:2` | Self: 0.0% (0us) | Total: 0.0% (1.6ms) | Samples: 0

**Called by:**
- `parseModule` (1)

**Calls:**
- `@lazy` (1)

### `node:os`
`node:os:110` | Self: 0.0% (0us) | Total: 0.0% (1.2ms) | Samples: 0

**Called by:**
- `parseModule` (1)

**Calls:**
- `bound` (1)

### `same`
`/Users/zhoulangzhoulang/development/edit-table/packages/core/src/utils/immutable.ts:22` | Self: 0.0% (0us) | Total: 1.2% (47.7ms) | Samples: 0

**Called by:**
- `(anonymous)` (37)

**Calls:**
- `stringify` (37)

### `next`
`[native code]` | Self: 0.0% (0us) | Total: 0.8% (33.6ms) | Samples: 0

**Called by:**
- `createView` (26)

**Calls:**
- `arrayIteratorNextHelper` (26)

### `project`
`/Users/zhoulangzhoulang/development/edit-table/packages/core/src/model/pipeline.ts:20` | Self: 0.0% (0us) | Total: 0.0% (2.2ms) | Samples: 0

**Called by:**
- `createController` (2)

**Calls:**
- `map` (2)

### `apply`
`/Users/zhoulangzhoulang/development/edit-table/packages/core/src/model/model.ts:85` | Self: 0.0% (0us) | Total: 0.0% (2.7ms) | Samples: 0

**Called by:**
- `(module)` (2)

**Calls:**
- `canWrite` (2)

### `apply`
`/Users/zhoulangzhoulang/development/edit-table/packages/core/src/model/model.ts:110` | Self: 0.0% (0us) | Total: 0.0% (1.1ms) | Samples: 0

**Called by:**
- `(module)` (1)

**Calls:**
- `slice` (1)

### `(anonymous)`
`/Users/zhoulangzhoulang/development/edit-table/node_modules/.bun/async-validator@4.2.5/node_modules/async-validator/dist-node/index.js:269` | Self: 0.0% (0us) | Total: 0.0% (3.2ms) | Samples: 0

**Called by:**
- `parseModule` (1)

**Calls:**
- `_wrapNativeSuper` (1)

### `project`
`/Users/zhoulangzhoulang/development/edit-table/packages/core/src/model/pipeline.ts:14` | Self: 0.0% (0us) | Total: 22.1% (830.6ms) | Samples: 0

**Called by:**
- `createController` (318)
- `apply` (316)

**Calls:**
- `freeze` (634)

### `project`
`/Users/zhoulangzhoulang/development/edit-table/packages/core/src/model/pipeline.ts:30` | Self: 0.0% (0us) | Total: 0.1% (6.0ms) | Samples: 0

**Called by:**
- `createController` (5)

**Calls:**
- `compute` (5)

### `_wrapNativeSuper`
`/Users/zhoulangzhoulang/development/edit-table/node_modules/.bun/async-validator@4.2.5/node_modules/async-validator/dist-node/index.js:82` | Self: 0.0% (0us) | Total: 0.0% (3.2ms) | Samples: 0

**Called by:**
- `(anonymous)` (1)

**Calls:**
- `_isNativeFunction` (1)

### `project`
`/Users/zhoulangzhoulang/development/edit-table/packages/core/src/model/pipeline.ts:13` | Self: 0.0% (0us) | Total: 0.3% (13.3ms) | Samples: 0

**Called by:**
- `createController` (10)

**Calls:**
- `groupRows` (10)

### `apply`
`/Users/zhoulangzhoulang/development/edit-table/packages/core/src/model/model.ts:111` | Self: 0.0% (0us) | Total: 0.0% (1.0ms) | Samples: 0

**Called by:**
- `(module)` (1)

**Calls:**
- `own` (1)

### `RowMetrics`
`/Users/zhoulangzhoulang/development/edit-table/packages/core/src/view/metrics.ts:5` | Self: 0.0% (0us) | Total: 0.0% (1.4ms) | Samples: 0

**Called by:**
- `createView` (1)

**Calls:**
- `Float64Array` (1)

### `project`
`/Users/zhoulangzhoulang/development/edit-table/packages/core/src/model/pipeline.ts:15` | Self: 0.0% (0us) | Total: 1.1% (41.4ms) | Samples: 0

**Called by:**
- `createController` (32)

**Calls:**
- `Map` (26)
- `map` (6)

### `createView`
`/Users/zhoulangzhoulang/development/edit-table/packages/core/src/view/view.ts:20` | Self: 0.0% (0us) | Total: 0.0% (1.5ms) | Samples: 0

**Called by:**
- `(module)` (1)

**Calls:**
- `Map` (1)

### `evaluate`
`[native code]` | Self: 0.0% (0us) | Total: 99.6% (3.74s) | Samples: 0

**Called by:**
- `async asyncModuleEvaluation` (2848)

**Calls:**
- `(module)` (2845)
- `(module)` (3)

### `canWrite`
`/Users/zhoulangzhoulang/development/edit-table/packages/core/src/model/model.ts:46` | Self: 0.0% (0us) | Total: 0.0% (2.7ms) | Samples: 0

**Called by:**
- `apply` (2)

**Calls:**
- `find` (2)

### `project`
`/Users/zhoulangzhoulang/development/edit-table/packages/core/src/model/pipeline.ts:10` | Self: 0.0% (0us) | Total: 0.1% (7.1ms) | Samples: 0

**Called by:**
- `createController` (3)
- `apply` (3)

**Calls:**
- `map` (6)

### `createView`
`/Users/zhoulangzhoulang/development/edit-table/packages/core/src/view/view.ts:75` | Self: 0.0% (0us) | Total: 0.0% (1.4ms) | Samples: 0

**Called by:**
- `(module)` (1)

**Calls:**
- `RowMetrics` (1)

### `apply`
`/Users/zhoulangzhoulang/development/edit-table/packages/core/src/model/model.ts:117` | Self: 0.0% (0us) | Total: 33.1% (1.24s) | Samples: 0

**Called by:**
- `(module)` (948)

**Calls:**
- `project` (316)
- `project` (209)
- `project` (206)
- `project` (206)
- `project` (4)
- `project` (4)
- `project` (3)

### `createController`
`/Users/zhoulangzhoulang/development/edit-table/packages/core/src/model/model.ts:25` | Self: 0.0% (0us) | Total: 0.0% (2.7ms) | Samples: 0

**Called by:**
- `(module)` (2)

**Calls:**
- `normalizeConfig` (1)
- `own` (1)

### `project`
`/Users/zhoulangzhoulang/development/edit-table/packages/core/src/model/pipeline.ts:42` | Self: 0.0% (0us) | Total: 0.2% (7.6ms) | Samples: 0

**Called by:**
- `createController` (6)

**Calls:**
- `groupRows` (6)

## Files

| Self% | Self | File |
|------:|-----:|------|
| 80.0% | 3.00s | `[native code]` |
| 11.5% | 433.8ms | `/Users/zhoulangzhoulang/development/edit-table/packages/core/src/utils/immutable.ts` |
| 3.2% | 120.2ms | `/Users/zhoulangzhoulang/development/edit-table/packages/core/src/view/view.ts` |
| 3.0% | 114.5ms | `/Users/zhoulangzhoulang/development/edit-table/packages/core/src/model/pipeline.ts` |
| 1.2% | 46.3ms | `/Users/zhoulangzhoulang/development/edit-table/packages/core/src/model/model.ts` |
| 0.4% | 17.0ms | `/Users/zhoulangzhoulang/development/edit-table/packages/core/src/model/grouping.ts` |
| 0.2% | 10.4ms | `/Users/zhoulangzhoulang/development/edit-table/scripts/performance/model.ts` |
| 0.0% | 3.2ms | `/Users/zhoulangzhoulang/development/edit-table/node_modules/.bun/async-validator@4.2.5/node_modules/async-validator/dist-node/index.js` |
| 0.0% | 1.2ms | `/Users/zhoulangzhoulang/development/edit-table/packages/core/src/model/config.ts` |
| 0.0% | 1.2ms | `node:os` |
