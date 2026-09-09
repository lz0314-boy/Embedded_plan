import { RUNNER_COMPILER_ASSETS, boundedOutput, type CWorkerRequest, type CWorkerResponse } from "@/lib/runner/protocol";

type WorkerShim = {
  window?: unknown;
  customElements?: { define: (...args: unknown[]) => void };
  HTMLElement?: unknown;
  CSSStyleSheet?: unknown;
  document?: {
    documentElement: { style: Record<string, never> };
    createTreeWalker: () => { currentNode: null; nextNode: () => false };
    createComment: () => Record<string, never>;
  };
  fetch: typeof fetch;
};

const workerGlobal = globalThis as unknown as WorkerShim;
workerGlobal.window ??= globalThis;
workerGlobal.customElements ??= { define: () => undefined };
workerGlobal.HTMLElement ??= class {};
workerGlobal.CSSStyleSheet ??= class { replaceSync() {} };
workerGlobal.document ??= {
  documentElement: { style: {} },
  createTreeWalker: () => ({ currentNode: null, nextNode: () => false }),
  createComment: () => ({}),
};

const compilerAssetFetch = globalThis.fetch.bind(globalThis);
workerGlobal.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
  const value = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const url = new URL(value, self.location.href);
  if (url.origin !== "https://runno.dev" || !url.pathname.startsWith("/langs/")) return Promise.reject(new Error("执行器只允许访问固定的编译器资源。"));
  return compilerAssetFetch(input, init);
};

const runtimePromise = import("@runno/runtime");

async function prepareCompiler() {
  const runtime = await runtimePromise;
  const sizes = await Promise.all(RUNNER_COMPILER_ASSETS.map(async (asset) => {
    const response = await workerGlobal.fetch(`https://runno.dev/langs/${asset}`, { cache: "force-cache", credentials: "omit", redirect: "error" });
    if (!response.ok) throw new Error(`编译器资源加载失败：${asset} (${response.status})`);
    return (await response.arrayBuffer()).byteLength;
  }));
  const warmup = await runtime.headlessRunCode("clang", "int main(void) { return 0; }");
  if (warmup.resultType !== "complete" || warmup.exitCode !== 0) throw new Error("C 编译器预热失败，请联网后重试。");
  return sizes.reduce((total, size) => total + size, 0);
}

self.onmessage = async (event: MessageEvent<CWorkerRequest>) => {
  try {
    if (event.data.type === "prepare") {
      const assetBytes = await prepareCompiler();
      self.postMessage({ type: "prepared", assetBytes } satisfies CWorkerResponse);
      return;
    }
    const runtime = await runtimePromise;
    const result = await runtime.headlessRunCode("clang", event.data.source, event.data.stdin);
    if (result.resultType === "complete") {
      const output = boundedOutput(result.stdout, result.stderr, event.data.maxOutputBytes);
      const response: CWorkerResponse = output.exceeded
        ? { type: "result", resultType: "output-limit" }
        : { type: "result", resultType: "complete", exitCode: result.exitCode, stdout: output.stdout, stderr: output.stderr };
      self.postMessage(response);
      return;
    }
    if (result.resultType === "timeout" || result.resultType === "terminated") {
      self.postMessage({ type: "result", resultType: result.resultType } satisfies CWorkerResponse);
      return;
    }
    self.postMessage({ type: "result", resultType: "crash", message: result.error.message } satisfies CWorkerResponse);
  } catch (error) {
    self.postMessage({ type: "result", resultType: "crash", message: error instanceof Error ? error.message : "C 编译器加载失败。" } satisfies CWorkerResponse);
  }
};
