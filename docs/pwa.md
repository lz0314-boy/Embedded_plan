# PWA 与离线边界

阶段 2 使用静态 Next.js export 加构建后 Serwist 注入。部署只提供 `out/` 静态文件，不使用 `next start`、Server Actions 或其他运行时应用服务器。子路径部署通过 `NEXT_PUBLIC_BASE_PATH` 同步生成资源地址、manifest、Service Worker scope 和离线索引。

## 缓存分层

- 应用壳、公开导航、离线页、图标、静态 JS/CSS 和 manifest 进入版本化 precache。
- 公开内容 HTML 按支柱组成用户主动下载的离线包，资源逐项校验 SHA-256 后原子切换。
- Supabase、授权请求、跨源请求和未知请求不由 Service Worker 缓存。
- 笔记、学习数据、代码草稿和项目经历只使用 IndexedDB；它们不进入 Cache Storage。面试模块不采集录音。
- Monaco 与 C/WASI runner 只在实验页按需加载；Runno 跨源编译器资产不进入本站 Service Worker Cache。

## C runner

普通静态预览没有下列响应头，因此会明确降级为编辑、保存和参考答案对比：

```text
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

`corepack pnpm test:e2e:runner` 使用测试专用静态服务器添加上述响应头，验证正常输出、编译错误、死循环超时、输出超限、强制终止和低内存降级。首次准备显示约 13.5 MiB 下载量；准备阶段最长 300 秒，不执行用户代码；用户代码默认 20 秒、最大 30 秒，并可强制终止 Worker。

这只验证标准 C/WASI。Cortex-M、RT-Thread、ESP32、Linux BSP 和 i.MX6ULL 条目继续作为代码审查或分析实验，不宣称浏览器硬件仿真。

## 更新与验证

新 Worker 安装后保持 waiting。用户确认更新时，页面先保存已注册的本地草稿，再检查多标签页并激活。测试静态服务器对 `sw.js` 使用 `Cache-Control: no-store`，避免同秒文件时间戳导致更新检查误用 HTTP 缓存。

构建后运行 `corepack pnpm test:e2e` 验证离线导航、原子离线包、更新保护、移动端布局及私人数据缓存边界。真实 Android、iOS、Safari、长期容量回收和生产 CDN 仍属于阶段 6。
