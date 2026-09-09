import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

const output = path.resolve("out");
const basePath = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/$/, "");

function externalOrigin(value) {
  try {
    const url = new URL(value);
    return url.origin;
  } catch {
    return null;
  }
}

function securityPolicy(html) {
  const hashes = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
    .filter(([, attributes]) => !/\bsrc\s*=/.test(attributes))
    .map(([, , body]) => `'sha256-${createHash("sha256").update(body).digest("base64")}'`);
  const origins = [externalOrigin(process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""), "https://runno.dev"].filter((origin) => origin);
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "form-action 'self'",
    `script-src 'self' 'wasm-unsafe-eval' ${hashes.join(" ")}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
    `connect-src 'self' ${origins.join(" ")}`,
    "manifest-src 'self'",
  ].join("; ");
}

const files = await fs.readdir(output, { recursive: true });
let count = 0;
for (const relative of files.filter((file) => file.endsWith(".html"))) {
  const file = path.join(output, relative);
  const html = await fs.readFile(file, "utf8");
  const policy = securityPolicy(html);
  const withoutPolicy = html.replace(/\s*<meta http-equiv="Content-Security-Policy" content="[^"]*"\s*\/>/gi, "");
  const meta = `<meta http-equiv="Content-Security-Policy" content="${policy}" />`;
  const next = withoutPolicy.replace(/(<head[^>]*>)/i, `$1${meta}`);
  if (next === withoutPolicy) throw new Error(`无法注入 CSP：${relative}`);
  await fs.writeFile(file, next);
  count += 1;
}

if (!basePath) console.log(`静态安全策略已注入 ${count} 个 HTML 页面。`);
else console.log(`静态安全策略已注入 ${count} 个 HTML 页面（basePath=${basePath}）。`);
