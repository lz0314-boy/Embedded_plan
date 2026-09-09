"use client";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let deferredPrompt: InstallPromptEvent | undefined;
const listeners = new Set<(available: boolean) => void>();
let initialized = false;

export function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
}

export function initInstallPrompt() {
  if (typeof window === "undefined" || initialized) return;
  initialized = true;
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event as InstallPromptEvent;
    listeners.forEach((listener) => listener(true));
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = undefined;
    listeners.forEach((listener) => listener(false));
  });
}

export function subscribeInstallPrompt(listener: (available: boolean) => void) {
  listeners.add(listener);
  listener(Boolean(deferredPrompt) && !isStandalone());
  return () => { listeners.delete(listener); };
}

export async function promptInstall() {
  if (!deferredPrompt) return false;
  const prompt = deferredPrompt;
  deferredPrompt = undefined;
  await prompt.prompt();
  const result = await prompt.userChoice;
  listeners.forEach((listener) => listener(false));
  return result.outcome === "accepted";
}
