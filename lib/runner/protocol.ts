export const RUNNER_LIMITS = {
  maxSourceBytes: 64 * 1024,
  maxStdinBytes: 16 * 1024,
  maxOutputBytes: 64 * 1024,
  defaultTimeoutMs: 20_000,
  maxTimeoutMs: 30_000,
  prepareTimeoutMs: 300_000,
  lowMemoryDeviceGiB: 2,
} as const;

export const RUNNER_COMPILER_ASSETS = ["clang.wasm", "clang-fs.tar.gz", "wasm-ld.wasm"] as const;
export const RUNNER_COMPILER_DOWNLOAD_BYTES = 14_197_702;

export type RunnerAvailability = { available: true } | { available: false; reason: "worker" | "wasm" | "isolation" | "memory" };

export type CRunResult = {
  status: "completed" | "failed" | "compile-error" | "timeout" | "output-limit" | "terminated" | "unavailable" | "invalid-input";
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
  message?: string;
};

export type CWorkerRequest = {
  type: "prepare";
} | {
  type: "execute";
  source: string;
  stdin: string;
  maxOutputBytes: number;
};

export type CWorkerResponse =
  | { type: "prepared"; assetBytes: number }
  | { type: "result"; resultType: "complete"; exitCode: number; stdout: string; stderr: string }
  | { type: "result"; resultType: "crash"; message: string }
  | { type: "result"; resultType: "timeout" | "terminated" | "output-limit" };

export type CWorkerResultResponse = Exclude<CWorkerResponse, { type: "prepared" }>;

export function utf8ByteLength(value: string) {
  return new TextEncoder().encode(value).byteLength;
}

export function truncateUtf8(value: string, maxBytes: number) {
  const bytes = new TextEncoder().encode(value);
  if (bytes.byteLength <= maxBytes) return { value, truncated: false };
  return { value: new TextDecoder().decode(bytes.slice(0, maxBytes)), truncated: true };
}

export function boundedOutput(stdout: string, stderr: string, maxBytes = RUNNER_LIMITS.maxOutputBytes) {
  const nextStdout = truncateUtf8(stdout, maxBytes);
  const remaining = Math.max(0, maxBytes - utf8ByteLength(nextStdout.value));
  const nextStderr = truncateUtf8(stderr, remaining);
  return { stdout: nextStdout.value, stderr: nextStderr.value, exceeded: nextStdout.truncated || nextStderr.truncated || utf8ByteLength(stdout) + utf8ByteLength(stderr) > maxBytes };
}

export function getRunnerAvailability(environment: { worker: boolean; wasm: boolean; isolated: boolean; deviceMemoryGiB?: number }): RunnerAvailability {
  if (!environment.worker) return { available: false, reason: "worker" };
  if (!environment.wasm) return { available: false, reason: "wasm" };
  if (!environment.isolated) return { available: false, reason: "isolation" };
  if (environment.deviceMemoryGiB !== undefined && environment.deviceMemoryGiB < RUNNER_LIMITS.lowMemoryDeviceGiB) return { available: false, reason: "memory" };
  return { available: true };
}

export function classifyWorkerResponse(response: CWorkerResultResponse, durationMs: number): CRunResult {
  if (response.resultType === "crash") return { status: "compile-error", exitCode: null, stdout: "", stderr: response.message, durationMs };
  if (response.resultType === "timeout") return { status: "timeout", exitCode: null, stdout: "", stderr: "", durationMs, message: "运行超过时间限制，Worker 已终止。" };
  if (response.resultType === "terminated") return { status: "terminated", exitCode: null, stdout: "", stderr: "", durationMs, message: "运行已终止。" };
  if (response.resultType === "output-limit") return { status: "output-limit", exitCode: null, stdout: "", stderr: "", durationMs, message: "stdout/stderr 超过 64 KiB 限制。" };
  if (!("stdout" in response)) return { status: "compile-error", exitCode: null, stdout: "", stderr: "Worker 返回了未知结果。", durationMs };
  const output = boundedOutput(response.stdout, response.stderr);
  if (output.exceeded) return { status: "output-limit", exitCode: null, stdout: output.stdout, stderr: output.stderr, durationMs, message: "stdout/stderr 超过 64 KiB 限制。" };
  return { status: response.exitCode === 0 ? "completed" : "failed", exitCode: response.exitCode, stdout: output.stdout, stderr: output.stderr, durationMs };
}
