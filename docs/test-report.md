# 测试报告索引

记录日期：2026-09-09。

- 阶段 0–2：工程基线、本地学习闭环和 PWA 已通过对应静态检查、内容构建和浏览器回归。
- 阶段 3：Supabase migration 已应用到 linked 项目；RLS 元数据、匿名拒绝和 linked schema lint 已验证。本地 pgTAP 仍因 Podman machine 镜像下载网络中断未执行。
- 阶段 4：实际结果见 `docs/phase4-report.md`。
- 阶段 5：实际结果见 `docs/phase5-report.md`。
- 阶段 6：实际结果见 `docs/phase6-report.md`。

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

任何未执行的真实设备、双用户、跨设备、三网或生产托管测试都不得从本报告推断为通过。
