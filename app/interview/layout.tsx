import type { Metadata } from "next";

export const metadata: Metadata = { title: "模拟面试", robots: { index: false, follow: false } };
export default function InterviewLayout({ children }: Readonly<{ children: React.ReactNode }>) { return children; }
