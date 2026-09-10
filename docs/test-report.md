# 测试报告索引

记录日期：2026-09-10。

- 阶段 0–2：工程基线、本地学习闭环和 PWA 已通过对应静态检查、内容构建和浏览器回归。
- 阶段 3：Supabase migration 已应用到 linked 项目；RLS 元数据、匿名拒绝和 linked schema lint 已验证。本地 pgTAP 仍因 Podman machine 镜像下载网络中断未执行。
- 阶段 4：实际结果见 `docs/phase4-report.md`。
- 阶段 5：实际结果见 `docs/phase5-report.md`。
- 阶段 6：实际结果见 `docs/phase6-report.md`。
- 本次内容核验：新增 15 条分层调试内容已按 `debugging-core-20260910` 批次更新为 `verified`；其余 510 条内容保持 `draft`，ALPHA 板级细节仍待逐项核验。
- 本次回归：内容总量 525 条，来源登记 28 条；根路径构建 564 个静态页面，GitHub Pages 子路径构建同样通过。

当前最终命令集：

```text
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm test
corepack pnpm content:validate
corepack pnpm build
corepack pnpm test:e2e
corepack pnpm test:e2e:runner
corepack pnpm quality:check
corepack pnpm test:e2e:quality
corepack pnpm dlx supabase db lint --linked
```

本次实际通过：`corepack pnpm lint`、`corepack pnpm typecheck`、`corepack pnpm test`（8 个文件/23 个用例）、`corepack pnpm content:check`、`corepack pnpm build`、`corepack pnpm quality:check`、`corepack pnpm test:e2e`（10/10）、`corepack pnpm test:e2e:quality`（2/2）和 `corepack pnpm test:e2e:runner`（2/2）。另以 `NEXT_PUBLIC_BASE_PATH=/Embedded_plan` 构建并通过 `PWA_TEST_BASE_PATH=/Embedded_plan corepack pnpm test:e2e`（10/10）。

任何未执行的真实设备、双用户、跨设备、三网或生产托管测试都不得从本报告推断为通过。
