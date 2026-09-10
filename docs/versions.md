# 实际版本

> 记录日期：2026-09-09。这里记录当前工作区锁定版本，不表示外部服务条款或远端编译器资源永久不变。

| 组件 | 版本/策略 |
| --- | --- |
| Node.js | `>=22.0.0`；当前开发环境 `v24.19.0` |
| Next.js | `16.3.4`，App Router + `output: "export"` |
| React | `19.2.0` |
| TypeScript | `^5.9.3` |
| Dexie | `4.4.5` |
| ts-fsrs | `5.4.2` |
| Zod | `4.5.4` |
| Serwist / @serwist/build | `9.5.12` |
| Monaco Editor | `0.56.0`；React 适配 `4.7.0`，仅实验页按需加载 |
| Runno runtime | `0.10.0`；只用于标准 C/WASI，编译器资源约 13.5 MiB |
| Supabase JS | `2.116.0`；浏览器只使用 publishable/anon key |
| Supabase CLI | `2.117.0`，通过 `pnpm dlx`；linked schema lint 已通过 |
| Playwright Python | `1.62.0`，E2E 环境 |
| axe-core | `4.13.0`，仅用于质量 E2E |
| RT-Thread | 核心实现固定为 `v5.2.2`，commit `ddf52e2cdd977f14fc04035c88672ac204aec713`；手册来源固定为 `16eb4600ec7f8ea8b037abd7e1cfc2eaba9baf39` |
| 正点原子 ALPHA | 板级参数、启动偏移、分区和脚本仍待匹配版本官方资料核验 |

Runno 0.10.0 默认从 `https://runno.dev/langs/` 获取编译器资产。npm 包已锁定，但远端资产 URL 未版本化；发布前需要重新核验可用性、大小和供应链策略。
