import type { Metadata } from "next";

export const metadata: Metadata = { title: "学习统计", robots: { index: false, follow: false } };
export default function StatsLayout({ children }: Readonly<{ children: React.ReactNode }>) { return children; }
