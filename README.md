# 嵌入式复习站

个人使用的嵌入式软件系统化学习平台。项目采用静态优先、本地优先架构：公开 Markdown/MDX 内容进入仓库，私人数据写入浏览器 IndexedDB，Supabase 仅用于登录后的可选异步同步。

## 当前阶段

阶段 0 到阶段 5 已形成可运行实现：

- 40 篇课程、200 道面试题、250 道测验和 20 个代码/分析实验，共 510 条 MDX。
- 所有扩充内容仍为 `draft`，只代表结构、来源入口和学习问题已经登记，不代表逐条人工核验完成。
- 今日任务、进度、笔记、收藏、测验、复习、统计、JSON 备份和 PWA 离线包。
- Supabase 可选同步、RLS migration、冲突副本和 linked schema lint；IndexedDB 始终是即时事实来源。
- 模拟面试、计时、自评、追问和复盘（仅文字回答）。
- Monaco 按需加载，以及受 Worker、超时、输出和低内存限制的标准 C/WASI runner。
- 私有项目模板、公开知识点关联和确定性追问；项目经历默认仅本机，逐条明确授权后才同步。

阶段 6 的自动化质量、SEO、恢复和首屏预算检查已完成；真实移动设备、可访问性、三网、多托管平台、双用户同步和正式发布仍需外部实测，详见 `docs/phase6-report.md`。

## 开发与测试

环境要求：Node.js 22+、Corepack；浏览器回归需要 Python Playwright。锁定版本见 `docs/versions.md`。

```text
corepack pnpm install --frozen-lockfile
corepack pnpm dev
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm test
corepack pnpm content:validate
corepack pnpm build
corepack pnpm test:e2e
corepack pnpm test:e2e:runner
corepack pnpm quality:check
corepack pnpm test:e2e:quality
```

静态产物位于 `out/`。普通 `corepack pnpm start` 不提供 COOP/COEP，因此 C runner 会按设计降级；真实 runner 验收命令会启动仅用于测试的 cross-origin isolated 静态服务器。生产环境仍只需静态托管，不依赖 Next.js、Server Actions 或 Edge Functions。

正式构建前设置 `NEXT_PUBLIC_SITE_URL` 为主站 origin，例如 `https://example.com`；它用于生成 canonical、sitemap 和 Open Graph URL。`NEXT_PUBLIC_BASE_PATH` 需要与静态托管项目子路径一致。

## 隐私与边界

- 私人笔记、学习数据、代码草稿、项目经历和导出文件不得进入 `content/`、`generated/` 或静态产物。
- 浏览器只允许 Supabase publishable/anon key，禁止 `service_role`、`sb_secret`、数据库密码和其他 secret。
- 面试模块不采集、不保存、不导出或同步录音；回答、自评和复盘数据保存在本机 IndexedDB。
- 标准 C/WASI runner 不模拟 Cortex-M、RT-Thread、ESP32、Linux BSP 或真实硬件。
- RTOS 通用机制、RT-Thread 实现、Cortex-M 架构和具体芯片实现分层；ESP32 保持独立 scope。
- 正点原子 ALPHA 的拨码、偏移、分区、DTS 和脚本未匹配对应版本官方资料时一律标记“待核验”。

阶段报告见 `docs/phase4-report.md`、`docs/phase5-report.md` 和 `docs/test-report.md`。
