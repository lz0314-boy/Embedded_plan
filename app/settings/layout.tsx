import type { Metadata } from "next";

export const metadata: Metadata = { title: "数据管理", robots: { index: false, follow: false } };
export default function SettingsLayout({ children }: Readonly<{ children: React.ReactNode }>) { return children; }
