# 本地验收记录

日期：2026-10-31。macOS / Apple M1，Bun 1.3.13，Node 24.15.0。仅记录实际执行结果，外部 CI 与发布不计为通过。

| 检查 | 结果 | 证据 |
| --- | --- | --- |
| 类型检查 | 通过 | bun run typecheck |
| 模型 / DOM / React | 58 个测试，8 个文件全部通过 | unit-output.txt |
| 三引擎交互与文档 | 183 个通过，0 失败、0 跳过、0 flaky | e2e-results.json、e2e-output.txt；约 1 分钟 |
| 缩放 / DPR | 30 个通过 | ../spikes/results.json、spike-output.txt；9.2 s |
| 浅色 / 深色视觉 | 2 个基线比较通过 | visual-results.json、visual-output.txt；3.5 s |
| 格式与 lint | 通过，零警告 | lint-output.txt |
| 文档构建与代码块 | 41 个 TypeScript 代码块、TypeDoc、VitePress 均通过 | docs-build-output.txt；VitePress 4.80 s |
| 发布包消费方类型 | 通过，无源码别名，skipLibCheck=false | bun run test:package |
| 构建样式扫描 | 源码与产物通过 | bun run check:no-sticky |
| Node ESM 与 React SSR | 通过 | ssr-output.txt |
| 本地 npm pack | 核心与 React 适配均成功 | package-manifest.json、react-package-manifest.json、两个 tgz |

行控制的 15 个三引擎用例覆盖：固定区逐行取消、勾选批量取消、全部取消、源行固定标记、横滚后的取消入口、行号只选当前行、Shift / Ctrl 选择、派生行连续编号、固定副本定位、部分合并区写入保护，以及显隐和容器变化后的列宽填满与头体对齐。

增量实现另有 7 个单元用例与 6 个三引擎用例：最终计算记录差量、汇总抛错回滚、数据所有权和 __proto__ 保留、120 次精确汇总随机对照、300 次结构编辑与完整投影对照、500 次高度索引随机拼接对照、视口锚点与表头复用、布局占位和源下标样式更新。

浅色、深色基线已重新生成、查看并复跑比较，使用 macOS Chromium；包含固定区、整行选中、白字行号、项目列小计与蓝色批注提示。三套 Playwright 配置的输出目录独立，避免互相清理文件。全屏此前在三种引擎均进入 fullscreenElement 且无页面错误，见 visual-checks.json。

## 性能

第 4 版协议同时采样界面更新、写入后立即读取完整冻结快照、十万行中部插入与删除。采样期间无并行重型检查，保留增量优化前第 3 版 JSON。

- 十万行精确金额案例，Chromium / Firefox / WebKit 初始化为 704.1 / 936 / 731 ms；可见单格更新中位为 0.5 / 2 / 6 ms，前测为 87.4 / 107 / 237 ms。
- 立即读取完整快照的对应中位为 1.6 / 3 / 41 ms，WebKit 仍有完整数组成本。
- 无分组与 1000 分组 / 小计的六个结构场景均检查汇总稳定与表头复用。结构写入仍涉及数组和索引等线性工作，中位 20.9–132 ms；取得新增身份的完整快照读取位于结构计时之外。
- 原始记录为 performance-browser.json、performance-model.json；生成结果为 ../website/performance.md。同步脚本耗时不代表完整帧或物理触控板体验。

## 原生 Safari 与人工边界

使用本机 Safari 原生界面检查十万行展示、滚动、文本输入、回车保存、Cmd+Z 撤销与 Cmd+Shift+Z 重做。修复 grid 语义后，工具栏和编辑框可被辅助功能树访问。本轮进一步点击行号、固定行、勾选并取消固定，观察管理区消失和源行固定标记移除。

ASCII 文本输入通过，不算作真实中文输入法验证。物理触控板惯性、浏览器菜单缩放、系统表格剪贴板往返与长时间手动验收仍见 MANUAL-ACCEPTANCE.md；十万行自动高度的三引擎往返抽样已覆盖无空白、DOM 上限与锚点漂移不超过 1 px。

没有远程仓库、npm 组织或文档部署目标，因此外部 CI、npm 发布和文档部署未执行。当前交付本地源码、构建、可消费的包与完整验收记录。

## 本次标注稿与输入交互验收

再增加 18 个三引擎用例：整行单一连续选框、包含行号与固定列、主题底色白字行号、多行选择与旧状态清理、校验红角和批注提示区分、悬浮失败原因、修正后清除错误、小计放在项目列，以及 Excel 键入覆盖、F2 光标、Enter / Tab / Shift 导航、Esc 取消、Backspace 空白草稿、方向键提交、数字规范化失败不移动、选择面板 Enter 提交。原有合成 IME、日期、级联、多选与异步候选用例保持通过。

用户已确认选中时 Enter 移动，F2 / 双击编辑；此行为覆盖旧规格的 Enter 进入编辑。真实中文输入法的硬件验收仍保留，不以合成事件冒充。
