import type { Metadata } from "next";
import { ProjectWorkspace } from "@/components/projects/project-workspace";

export const metadata: Metadata = {
  title: "项目经历 · 嵌入式复习站",
  description: "本机保存的私人项目经历模板和确定性追问。",
  robots: { index: false, follow: false },
};

export default function ProjectsPage() {
  return <><div className="eyebrow">私人模块</div><h1>项目经历</h1><p className="muted">把真实经历整理成可复盘、可追问的结构；不生成、不猜测、不公开。</p><ProjectWorkspace /></>;
}
