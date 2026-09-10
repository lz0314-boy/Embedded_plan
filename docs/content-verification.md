# 内容核验流程

内容的 `status` 是来源核验状态，不是页面是否能构建的状态。

## 状态边界

- `draft`：内容草稿、来源占位或仍需逐条核对；页面显示“待核验”。
- `reviewed`：已完成编辑审阅，但不能据此宣称来源事实已经核验。
- `verified`：内容中的关键事实已经对照登记来源完成审阅，并填写 `verifiedAt`。
- ALPHA V2.4 的拨码、启动偏移、分区、DTS、环境变量和脚本，必须有对应版本官方资料逐项证据；没有证据就保持“待板级核验”。

## 批量更新

批次登记在 `content/verification/batches.json`，必须列出审阅日期、来源和明确的内容 ID。工具默认只预览：

```text
corepack pnpm content:verify -- --batch debugging-core-20260910
```

确认批次证据和内容范围后，才允许写入：

```text
corepack pnpm content:verify -- --batch debugging-core-20260910 --apply
```

工具拒绝覆盖已有核验状态、拒绝没有来源的内容，也不会默认修改 `catalog-*` 扩充条目。写入后必须运行 `corepack pnpm content:validate` 和 `corepack pnpm content:build`。

本项目当前批次只核验分层调试方法的通用内容，不代表浏览器 runner、真实 Cortex-M、RT-Thread 或 ALPHA V2.4 真板测试已经完成。
