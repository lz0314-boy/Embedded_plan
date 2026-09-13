import type { Metadata } from "next";

export const metadata: Metadata = { title: "随机复习", robots: { index: false, follow: false } };
export default function StatsLayout({ children }: Readonly<{ children: React.ReactNode }>) { return children; }
