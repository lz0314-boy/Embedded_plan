# 阶段 6 发布选择与质量报告

记录日期：2026-09-09。

## 已实现

- 首页和内容页使用 `robots`、canonical、Open Graph 元数据；草稿内容保持 `noindex`，不进入 sitemap。
- 公开内容页生成 `TechArticle`/`LearningResource` 与 `BreadcrumbList` JSON-LD；JSON-LD URL 与实际路由一致。
- 生成 `robots.txt`、`sitemap.xml`，并在构建后为静态 HTML 注入按页面计算的 CSP hash。
- 首页改用轻量学习索引，同步引擎和首页完成操作按需加载，首屏 JS/CSS 受 gzip 预算检查。
- 增加全新浏览器 JSON 恢复 E2E；校验设置、笔记、进度、书签、测验、错题和 FSRS 到期时间。
- 增加 `axe-core` 公共/私人页面检查、Cloudflare Pages/Netlify `_headers` 和 Vercel 安全头配置。
- 不使用第三方分析、广告或远程字体；录音权限只允许本站，录音仍不进入备份和同步。

## 实际自动化结果

| 命令 | 实际结果 |
| --- | --- |
| `corepack pnpm typecheck` | 通过 |
| `corepack pnpm lint` | 通过 |
| `corepack pnpm test` | 8 个测试文件、23 项测试通过 |
| `corepack pnpm build` | 549 个静态页面、76 个 precache 资源、5 个可选离线包 |
| `corepack pnpm quality:check` | 通过：首页 JS gzip 171335 B、内容页 170289 B、CSS 2476 B、内容索引 20607 B |
| `corepack pnpm test:e2e:quality` | 1 个测试通过；5 个页面无 axe WCAG 2A/2AA 违规 |
| `corepack pnpm test:e2e` | 10/10 通过；包含全新浏览器恢复 |
| `corepack pnpm test:e2e:runner` | 2/2 通过 |
| `corepack pnpm dlx supabase db lint --linked` | 阶段 5 已通过；本阶段未修改数据库 schema |

## 托管决策与安全边界

- 主站候选选择 Cloudflare Pages：可直接托管 `out/`，并可使用 `public/_headers` 提供 COOP/COEP、安全头和 Worker 不缓存策略。
- GitHub Pages 保留为同一构建产物的静态镜像；它不读取 `_headers`，因此 C runner 在没有 cross-origin isolation 时按设计降级。
- Vercel 可作为同等主站候选，安全头配置已写入 `vercel.json`；在真实部署并完成访问测试前不宣称已上线或可达。
- CSP 不开放通用 `unsafe-eval`；现有 JSX 内联样式需要 `style-src 'unsafe-inline'`，这是已记录的受控例外。页面脚本使用构建时 hash，Supabase 和 Runno 仅开放到明确 origin。
- `NEXT_PUBLIC_SITE_URL` 只接受 origin，默认本机地址仅用于开发构建；正式发布前必须设置真实主站 origin，并重新生成 canonical、sitemap 和 PWA 产物。

## 未完成与外部阻塞

- 尚未在真实 Android、iOS、Safari 和桌面浏览器完成安装、离线、存储、屏幕阅读器和性能实测；本机 Chromium 结果不能替代真机结果。
- 尚未从中国大陆不同运营商网络完成三网访问，也未实际部署并比较 Cloudflare Pages、GitHub Pages 和 Vercel；不能宣称大陆访问质量或 SLA。
- 尚未创建两个真实登录用户完成 Supabase Auth、RLS、项目经历同步、双设备冲突和网络恢复演练；匿名拒绝和 linked schema lint 不等价于双用户验收。
- 本地 pgTAP 仍受 Podman machine 镜像下载网络中断影响；不能将远端 lint 当作本地 pgTAP 通过。
- 扩充内容仍为 `draft`/待核验；RT-Thread tag/commit 和正点原子 ALPHA 匹配版本资料尚未完成逐条核验。

这些事项需要真实设备、真实网络、托管账号或个人 Supabase 登录账号，不能由当前工作区自动代替。
