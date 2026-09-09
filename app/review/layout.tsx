import type { Metadata } from "next";

export const metadata: Metadata = { title: "到期复习", robots: { index: false, follow: false } };
export default function ReviewLayout({ children }: Readonly<{ children: React.ReactNode }>) { return children; }
