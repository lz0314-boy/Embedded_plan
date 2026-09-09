import type { AnchorHTMLAttributes } from "react";
import { localUrl } from "@/lib/pwa/config";

export default function StaticLink({ href = "", ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  const resolved = href.startsWith("/") && !href.startsWith("//") ? localUrl(href) : href;
  return <a {...props} href={resolved} />;
}
