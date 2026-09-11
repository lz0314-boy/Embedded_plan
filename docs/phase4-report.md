# 阶段 4 验收报告

记录日期：2026-09-09。

## 已实现

- 模拟面试配置、确定性选题、逐题计时、文本回答、自评、参考方向和会后复盘。
- 面试模块仅保存文字回答、计时、自评、追问和复盘；不采集录音。
- Monaco 按需加载与 IndexedDB 代码草稿。
- 标准 C/WASI Worker runner；源码、stdin、输出、准备时间、执行时间和低内存能力均有限制。
- Cortex-M、RT-Thread、ESP32、Linux BSP 和 i.MX6ULL 实验保持代码审查/分析边界。

## 实际测试

| 命令 | 实际结果 |
| --- | --- |
| `corepack pnpm typecheck` | 通过 |
| `corepack pnpm lint` | 通过 |
| `corepack pnpm test` | 8 个测试文件、18 项测试通过（阶段 4 收尾时） |
| `corepack pnpm build` | 55 个静态页面、63 个 precache 资源（阶段 4 内容规模） |
| `corepack pnpm test:e2e` | 面试持久化、草稿缓存边界和无 COI 降级通过；后续阶段 5 最终回归为 9/9 |
| `corepack pnpm test:e2e:runner` | 2/2 通过；覆盖正常输出、编译错误、死循环超时、输出超限、强制终止和低内存降级 |

真实 runner 验收使用 COOP/COEP 测试服务器和从 Runno 官方地址下载的实际编译器资产；为复跑稳定性，资产副本只缓存于被忽略的 `test-results/`，不会进入公开内容或静态产物。

## 已知限制

- 普通 `python -m http.server` 不提供 COOP/COEP，runner 会按设计降级。
- Runno 编译器资产 URL 未版本化，发布前需重新核验供应链与可用性。
- 测试证明的是标准 C/WASI，不是 MCU、RTOS 或板卡仿真。
