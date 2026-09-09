# 阶段 5 验收报告

记录日期：2026-09-09。

## 已实现

- `projectCases` IndexedDB 表和 schema v4 升级，不清除已有数据。
- 项目背景、职责、目标、约束、行动、结果、复盘、技术关键词和公开课程关联模板。
- 固定字段模板与公开知识点生成的确定性追问；没有预置或虚构个人经历。
- 项目经历默认仅本机；逐条勾选后才加入 `project_case` 同步队列；取消授权会给已同步副本排入云端 tombstone。
- JSON 备份/恢复包含项目经历，录音仍不进入备份。
- 内容库达到 40 篇课程、200 道面试题、250 道测验和 20 个实验。
- 25 个来源入口；阶段 5 的 475 条新增内容全部强制保持 `draft` 和 `verifiedAt: null`。

## 实际测试

| 命令 | 实际结果 |
| --- | --- |
| `corepack pnpm typecheck` | 通过 |
| `corepack pnpm lint` | 通过 |
| `corepack pnpm test` | 8 个测试文件、22 项测试通过 |
| `corepack pnpm content:validate` | 510 个 MDX、25 个来源；40/200/250/20 数量通过 |
| `corepack pnpm build` | 546 个静态页面、64 个 precache 资源、5 个可选离线包 |
| `corepack pnpm test:e2e` | 9/9 通过；项目默认本机、显式同步入队和 Cache Storage 隔离通过 |
| `corepack pnpm test:e2e:runner` | 2/2 通过；最终阶段 5 构建对应的真实 runner 场景通过 |
| `corepack pnpm dlx supabase db lint --linked` | 通过；`No schema errors found` |

## 未宣称完成

- 475 条扩充内容是系统化草稿，不是逐条人工核验完成的正式课程。
- 未录入用户个人项目经历；界面只提供空模板。
- 没有完成真实双用户项目同步、跨设备冲突或移动端真机验收。
- 阶段 6 的性能、可访问性、SEO、三网、托管选择和恢复演练尚未执行。
