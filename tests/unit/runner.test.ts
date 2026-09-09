import { describe, expect, it } from "vitest";
import { CRunnerClient } from "@/lib/runner/client";
import { boundedOutput, classifyWorkerResponse, getRunnerAvailability, RUNNER_LIMITS } from "@/lib/runner/protocol";

describe("browser C runner safety boundary", () => {
  it("downgrades when cross-origin isolation or memory is unavailable", () => {
    expect(getRunnerAvailability({ worker: true, wasm: true, isolated: false })).toEqual({ available: false, reason: "isolation" });
    expect(getRunnerAvailability({ worker: true, wasm: true, isolated: true, deviceMemoryGiB: 1 })).toEqual({ available: false, reason: "memory" });
  });

  it("caps combined stdout and stderr", () => {
    const result = boundedOutput("a".repeat(RUNNER_LIMITS.maxOutputBytes), "stderr");
    expect(result.exceeded).toBe(true);
    expect(new TextEncoder().encode(result.stdout + result.stderr).byteLength).toBeLessThanOrEqual(RUNNER_LIMITS.maxOutputBytes);
  });

  it("classifies compiler errors and normal output", () => {
    expect(classifyWorkerResponse({ type: "result", resultType: "crash", message: "syntax error" }, 12)).toMatchObject({ status: "compile-error", stderr: "syntax error" });
    expect(classifyWorkerResponse({ type: "result", resultType: "complete", exitCode: 0, stdout: "ok\n", stderr: "" }, 12)).toMatchObject({ status: "completed", exitCode: 0, stdout: "ok\n" });
  });

  it("terminates an unresponsive worker at the timeout boundary", async () => {
    let terminated = 0;
    const worker: { onmessage: ((event: MessageEvent) => void) | null; onerror: ((event: ErrorEvent) => void) | null; postMessage: (message: { type: string }) => void; terminate: () => void } = {
      onmessage: null,
      onerror: null,
      postMessage: (message) => {
        if (message.type === "prepare") queueMicrotask(() => worker.onmessage?.({ data: { type: "prepared", assetBytes: 1 } } as MessageEvent));
      },
      terminate: () => { terminated += 1; },
    };
    const previousWindow = (globalThis as { window?: unknown }).window;
    Object.defineProperty(globalThis, "window", { configurable: true, value: globalThis });
    const runner = new CRunnerClient(() => worker, () => ({ available: true }));
    const result = await runner.run("int main(void) { return 0; }", "", 10);
    if (previousWindow === undefined) delete (globalThis as { window?: unknown }).window;
    else Object.defineProperty(globalThis, "window", { configurable: true, value: previousWindow });
    expect(result.status).toBe("timeout");
    expect(terminated).toBe(1);
  });
});
