import type { Metadata } from "next";
import { HomePage } from "@/components/home/home-page";

export const metadata: Metadata = {
  title: "今日学习",
  description: "查看今日到期复习、学习任务和本机学习进度。",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <HomePage />;
}
