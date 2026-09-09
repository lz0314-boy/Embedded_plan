import { localUrl, scopePath } from "./config";

let registrationPromise: Promise<ServiceWorkerRegistration> | undefined;

export function registerWorker() {
  if (process.env.NODE_ENV !== "production") return Promise.reject(new Error("开发模式不启用离线缓存，请先构建静态版本"));
  if (!("serviceWorker" in navigator) || !window.isSecureContext) return Promise.reject(new Error("浏览器不支持 Service Worker，或当前不是 HTTPS/localhost"));
  registrationPromise ??= navigator.serviceWorker.register(localUrl("/sw.js"), { scope: scopePath, updateViaCache: "none" }).catch((error) => {
    registrationPromise = undefined;
    throw error;
  });
  return registrationPromise;
}

export function workerMessage<Value = void>(worker: ServiceWorker, message: { type: string; id?: string }, timeout = 30000): Promise<Value> {
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel();
    const cleanup = () => { clearTimeout(timer); channel.port1.close(); };
    const timer = setTimeout(() => { cleanup(); reject(new Error("缓存操作超时，可联网后重试")); }, timeout);
    channel.port1.onmessage = ({ data }) => {
      cleanup();
      if (data.ok) resolve(data.value as Value);
      else reject(new Error(data.error || "Service Worker 操作失败"));
    };
    worker.postMessage(message, [channel.port2]);
  });
}

export async function activeWorker() {
  const registration = await registerWorker();
  if (registration.active) return registration.active;
  const installing = registration.installing ?? registration.waiting;
  if (!installing) throw new Error("离线资源未安装，请联网后重试");
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => { cleanup(); reject(new Error("离线资源安装超时")); }, 20000);
    const cleanup = () => { clearTimeout(timer); installing.removeEventListener("statechange", changed); };
    const changed = () => {
      if (installing.state === "activated") { cleanup(); resolve(); }
      if (installing.state === "redundant") { cleanup(); reject(new Error("离线资源安装失败，请联网后重试")); }
    };
    installing.addEventListener("statechange", changed);
    changed();
  });
  if (!registration.active) throw new Error("Service Worker 尚未激活");
  return registration.active;
}
