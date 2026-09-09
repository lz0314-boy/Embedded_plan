# 发布检查清单

- [x] 类型检查、lint、单元测试、内容 CI 和静态构建通过。
- [x] 内容数量达到 40 篇课程、200 道面试题、250 道测验、20 个实验。
- [x] 阶段 5 扩充内容全部保持 `draft`/待核验，没有冒充人工核验结果。
- [x] 私人项目默认仅本机，显式授权后才进入同步队列；录音永不自动同步。
- [x] Supabase migration 启用 RLS，浏览器配置没有 `service_role`/secret key，linked schema lint 通过。
- [x] 普通 PWA 回归与 COI 下标准 C/WASI runner 场景通过。
- [x] 自动化恢复、SEO、CSP hash、gzip 预算和 axe 检查通过；结果见 `docs/phase6-report.md`。
- [ ] 用两个真实普通用户完成 RLS、项目同步、冲突副本和跨设备恢复验收。
- [ ] 在真实 Android、iOS、Safari 和桌面浏览器完成安装、离线、存储与可访问性验收。
- [ ] 在候选静态托管平台核对 COOP/COEP、CSP、`nosniff`、Referrer-Policy 和 Permissions-Policy。
- [ ] 验证性能预算、SEO、三网访问和主站/镜像切换。
- [ ] 为 RT-Thread 内容绑定 tag/commit，并逐条人工核验扩充内容。
- [ ] 为 ALPHA 板级内容匹配官方版本；无法匹配的条目继续显示“待核验”。
- [ ] 完成 JSON 恢复、账号登出保留本机数据、云端故障和托管故障演练。
