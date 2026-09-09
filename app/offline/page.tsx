export const metadata = {
  title: "离线学习｜嵌入式复习站",
  robots: { index: false, follow: false },
};

export default function OfflinePage() {
  return <><div className="eyebrow">离线状态</div><h1>当前没有网络</h1><p className="muted">已缓存的内容和本机学习数据仍然可用。私人数据保存在 IndexedDB，不会写入 Service Worker 缓存。</p><section className="panel" style={{ maxWidth: 680, marginTop: 24 }}><h2 style={{ marginTop: 0 }}>可以继续</h2><ul><li>打开已经访问过的课程和题目。</li><li>完成复习、测验、笔记与收藏。</li><li>网络恢复后，已登录账号的待同步变更会按队列尝试上传。</li></ul></section></>;
}
