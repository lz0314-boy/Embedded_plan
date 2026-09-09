import { RUNNER_LIMITS, classifyWorkerResponse, getRunnerAvailability, type CRunResult, type CWorkerRequest, type CWorkerResponse } from "./protocol";

type RunnerWorker = Pick<Worker, "postMessage" | "terminate"> & {
  onmessage: ((event: MessageEvent<CWorkerResponse>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
};

export type WorkerFactory = () => RunnerWorker;
export type RunnerPreparationResult =
  | { status: "ready"; assetBytes: number }
  | { status: "unavailable" | "failed" | "timeout"; assetBytes: 0; message: string };

function defaultWorkerFactory() {
  return new Worker(new URL("../../workers/c-runner.worker.ts", import.meta.url), { type: "module" });
}

export function getBrowserRunnerAvailability() {
  const deviceMemoryGiB = typeof navigator === "undefined" ? undefined : (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  return getRunnerAvailability({ worker: typeof Worker !== "undefined", wasm: typeof WebAssembly !== "undefined", isolated: typeof crossOriginIsolated !== "undefined" && crossOriginIsolated, deviceMemoryGiB });
}

const unavailableMessages = {
  worker: "当前浏览器不支持 Worker，已降级为编辑、保存和参考答案对比。",
  wasm: "当前浏览器不支持 WebAssembly，已降级为编辑、保存和参考答案对比。",
  isolation: "当前部署未启用 cross-origin isolation；为避免不安全执行，已降级为编辑、保存和参考答案对比。",
  memory: "设备可用内存偏低，已降级为编辑、保存和参考答案对比。",
} as const;

export class CRunnerClient {
  private worker: RunnerWorker | undefined;
  private settle: ((result: CRunResult) => void) | undefined;
  private preparePromise: Promise<RunnerPreparationResult> | undefined;
  private startedAt = 0;
  private clearTimer: (() => void) | undefined;

  constructor(private readonly workerFactory: WorkerFactory = defaultWorkerFactory, private readonly availability = getBrowserRunnerAvailability) {}

  prepare(): Promise<RunnerPreparationResult> {
    const available = this.availability();
    if (!available.available) return Promise.resolve({ status: "unavailable", assetBytes: 0, message: unavailableMessages[available.reason] });
    if (this.worker) return Promise.resolve({ status: "ready", assetBytes: 0 });
    if (this.preparePromise) return this.preparePromise;

    const worker = this.workerFactory();
    this.worker = worker;
    const promise = new Promise<RunnerPreparationResult>((resolve) => {
      const finish = (result: RunnerPreparationResult, keepWorker = false) => {
        window.clearTimeout(timer);
        worker.onmessage = null;
        worker.onerror = null;
        if (!keepWorker) {
          worker.terminate();
          if (this.worker === worker) this.worker = undefined;
        }
        resolve(result);
      };
      const timer = window.setTimeout(() => finish({ status: "timeout", assetBytes: 0, message: "C runner 准备超时，未开始执行用户代码。" }), RUNNER_LIMITS.prepareTimeoutMs);
      worker.onmessage = (event) => {
        if (event.data.type === "prepared") {
          finish({ status: "ready", assetBytes: event.data.assetBytes }, true);
          return;
        }
        if (event.data.resultType === "crash") finish({ status: "failed", assetBytes: 0, message: event.data.message });
        else finish({ status: "failed", assetBytes: 0, message: "C runner 准备阶段返回了未知结果。" });
      };
      worker.onerror = (event) => finish({ status: "failed", assetBytes: 0, message: event.message || "C runner 准备失败。" });
      worker.postMessage({ type: "prepare" } satisfies CWorkerRequest);
    });
    this.preparePromise = promise.finally(() => { this.preparePromise = undefined; });
    return this.preparePromise;
  }

  async run(source: string, stdin = "", timeoutMs: number = RUNNER_LIMITS.defaultTimeoutMs) {
    const available = this.availability();
    if (!available.available) return { status: "unavailable", exitCode: null, stdout: "", stderr: "", durationMs: 0, message: unavailableMessages[available.reason] } satisfies CRunResult;
    if (new TextEncoder().encode(source).byteLength > RUNNER_LIMITS.maxSourceBytes) return Promise.resolve<CRunResult>({ status: "invalid-input", exitCode: null, stdout: "", stderr: "", durationMs: 0, message: "源代码不能超过 64 KiB。" });
    if (new TextEncoder().encode(stdin).byteLength > RUNNER_LIMITS.maxStdinBytes) return Promise.resolve<CRunResult>({ status: "invalid-input", exitCode: null, stdout: "", stderr: "", durationMs: 0, message: "标准输入不能超过 16 KiB。" });
    if (this.settle) return { status: "invalid-input", exitCode: null, stdout: "", stderr: "", durationMs: 0, message: "已有代码正在运行。" } satisfies CRunResult;
    const preparation = await this.prepare();
    if (preparation.status !== "ready") return { status: preparation.status === "unavailable" ? "unavailable" : "compile-error", exitCode: null, stdout: "", stderr: "", durationMs: 0, message: preparation.message } satisfies CRunResult;
    if (!this.worker) return { status: "compile-error", exitCode: null, stdout: "", stderr: "", durationMs: 0, message: "C runner 准备完成后 Worker 不可用。" } satisfies CRunResult;
    const boundedTimeout = Math.min(Math.max(timeoutMs, 1), RUNNER_LIMITS.maxTimeoutMs);
    const worker = this.worker;
    this.startedAt = performance.now();
    return new Promise<CRunResult>((resolve) => {
      this.settle = resolve;
      const finish = (result: CRunResult) => {
        if (!this.settle) return;
        const settle = this.settle;
        this.settle = undefined;
        this.clearTimer = undefined;
        worker.onmessage = null;
        worker.onerror = null;
        if (result.status === "timeout" || result.status === "output-limit" || result.status === "terminated") {
          if (this.worker === worker) this.worker = undefined;
          worker.terminate();
        }
        settle(result);
      };
      const timer = window.setTimeout(() => {
        finish({ status: "timeout", exitCode: null, stdout: "", stderr: "", durationMs: Math.round(performance.now() - this.startedAt), message: "运行超过时间限制，Worker 已终止。" });
      }, boundedTimeout);
      this.clearTimer = () => window.clearTimeout(timer);
      worker.onmessage = (event) => {
        if (event.data.type === "prepared") return;
        window.clearTimeout(timer);
        finish(classifyWorkerResponse(event.data, Math.round(performance.now() - this.startedAt)));
      };
      worker.onerror = (event) => {
        window.clearTimeout(timer);
        finish({ status: "compile-error", exitCode: null, stdout: "", stderr: event.message || "Worker 执行失败。", durationMs: Math.round(performance.now() - this.startedAt) });
      };
      const request: CWorkerRequest = { type: "execute", source, stdin, maxOutputBytes: RUNNER_LIMITS.maxOutputBytes };
      worker.postMessage(request);
    });
  }

  terminate() {
    if (!this.worker || !this.settle) return false;
    this.clearTimer?.();
    this.clearTimer = undefined;
    this.worker.terminate();
    const settle = this.settle;
    this.worker = undefined;
    this.settle = undefined;
    settle({ status: "terminated", exitCode: null, stdout: "", stderr: "", durationMs: Math.round(performance.now() - this.startedAt), message: "运行已终止。" });
    return true;
  }
}

export const cRunner = new CRunnerClient();
