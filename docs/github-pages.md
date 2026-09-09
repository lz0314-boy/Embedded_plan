# GitHub Pages 发布

该项目使用 Next.js static export，GitHub Pages 只发布构建后的 `out/`，不运行 Next.js 服务端。

## 站点地址

仓库 `lz0314-boy/Embedded_plan` 的默认项目站点地址为：

```text
https://lz0314-boy.github.io/Embedded_plan/
```

发布工作流使用以下构建变量：

```text
NEXT_PUBLIC_BASE_PATH=/Embedded_plan
NEXT_PUBLIC_SITE_URL=https://lz0314-boy.github.io
```

## Supabase 可选配置

在仓库 Settings > Secrets and variables > Actions > Variables 中设置：

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

两项未设置时，网站继续使用 IndexedDB 本地优先模式；浏览器不得配置 `service_role`、`sb_secret` 或数据库密码。

## Pages 设置

在仓库 Settings > Pages 中将构建来源设置为 `GitHub Actions`。推送到 `main` 后，`.github/workflows/deploy-pages.yml` 会构建并发布 `out/`。

GitHub Pages 不读取 `public/_headers`，因此不会提供 COOP/COEP 响应头。C/WASI runner 在该平台按设计降级；需要完整 runner 时使用支持这些响应头的静态托管平台。
