# 内容编写指南

公开内容只放在 `content/`，使用 `.mdx` 文件和 YAML frontmatter。私人笔记、学习数据、录音和项目经历只能通过浏览器 IndexedDB、用户主动导出的文件，以及未来明确启用的 Supabase 私有文档保存。

## 发布规则

- `status: draft` 或 `reviewed` 不显示为已核验；`verifiedAt: null` 显示“待核验”。
- 每条内容必须声明 `scope`：`rtos-generic`、`rt-thread`、`cortex-m`、`chip`、`esp32` 或 `linux-bsp`。
- ESP32 单独使用 `esp32` scope，不得填写 Cortex-M 平台。
- ALPHA 板的拨码、启动偏移、分区、环境变量、DTS 和 init 脚本没有匹配厂商资料时只能写“待板级核验”。
- `verified` 内容必须有 `sourceIds` 和 `verifiedAt`；草稿可以使用占位来源，但不能声称已核验。

运行 `pnpm content:validate` 检查 frontmatter、ID、slug、关联项和来源；运行 `pnpm content:build` 生成 `generated/content-manifest.json`。
