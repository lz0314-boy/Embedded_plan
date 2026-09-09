import type { Metadata } from "next";

export const metadata: Metadata = { title: "登录回调", robots: { index: false, follow: false } };
export default function AuthCallbackLayout({ children }: Readonly<{ children: React.ReactNode }>) { return children; }
