# Supabase 可选同步

阶段 3 的同步仍以浏览器 IndexedDB 为事实来源。Supabase 只保存已登录用户自己的事件和文档副本；未配置、未登录、断网、超时或远端不可用时，学习、笔记、测验和复习继续使用本机数据。

项目经历额外采用逐条授权：新建和编辑默认只写入 `projectCases`，不进入同步队列；用户明确勾选后才作为 `project_case` 文档同步。取消授权时，本机副本继续保留，同时为已有远端副本排入 tombstone。录音始终仅本机。

## 浏览器配置

只提供以下公开构建变量：

```text
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable-or-legacy-anon-key>
```

浏览器和静态构建不得使用 `service_role`、`sb_secret` 或其他 secret key。个人使用阶段建议在 Supabase Dashboard 手动创建唯一账号，再关闭公开注册；密码重置只有在 SMTP 已验证后才启用。

## 数据库

- Migration：`supabase/migrations/20260909030116_user_sync.sql`
- 测试：`supabase/tests/database/user_sync_rls.sql`
- `user_events` 使用 UUID 幂等插入；相同 UUID 的不同内容会阻塞该项。
- `user_documents` 使用 `version = baseVersion + 1` 条件更新；版本跳跃由 trigger 拒绝。
- 两张暴露表均显式 revoke/grant、启用并强制 RLS，策略使用 `auth.uid()` 隔离用户。
- 文档 payload 的客户端和数据库体积上限为 256 KiB；录音不进入同步表。

## 本地验证

安装并启动 Docker Desktop，或完成 Podman machine 初始化后，在项目根目录执行：

```text
corepack pnpm dlx supabase start
corepack pnpm dlx supabase test db
corepack pnpm dlx supabase db lint --local
```

当前 Podman CLI 已安装，但 machine 镜像下载尚未完成，因此本地 pgTAP 双用户测试尚未执行；远端 migration、数据库 lint、RLS 元数据和匿名隔离已完成验证。真实 Supabase 项目的已登录双用户 RLS、Auth redirect 和网络恢复同步仍需创建个人账号后补测，不能将静态审计当作完整端到端验收。

## 云端项目决策

- 项目名：`embedded-learning-platform`
- 区域：`ap-southeast-1`（Singapore）；Supabase 不保证中国大陆网络质量，仍以 IndexedDB 本地优先为事实来源。
- 规格：`micro`，个人使用，不启用高可用。
- Auth：仅保留手动创建的个人账号，关闭公开注册；邮件确认和密码重置仅在配置可用 SMTP 后启用。
- 数据范围：只同步 `user_events` 和 `user_documents`；录音、私人项目经历原始附件和本地导出文件留在浏览器/本地，不上传。
- 实际项目：`embedded-learning-platform`，project ref `vzmbzpwfsxhneokypiuj`，状态 `ACTIVE_HEALTHY`。浏览器配置写入本机 `.env.local`，该文件已被 `.gitignore` 排除。
- 当前未创建个人学习账号；由于公开注册已关闭，需要在 Supabase Dashboard 的 Authentication → Users 中手动创建唯一账号后再测试登录和双设备同步。

本地 `supabase/config.toml` 含开发环境的 Auth redirect，不应直接用 `supabase config push` 覆盖云端配置。创建项目后先运行 `supabase config diff`，再只确认必要的 Auth 设置；数据库结构使用 migration 推送。

## 同步状态

设置页显示：仅本机、正在同步、已同步、离线待同步、登录失效、存在冲突、远端不可用。文档冲突保留本地和远端 payload，可选择保留本地、保留远端；笔记另提供另存副本。登出只清理会话，不删除本机数据。
