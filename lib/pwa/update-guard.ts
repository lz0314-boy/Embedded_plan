"use client";

import { useEffect, useRef } from "react";

const guards = new Set<() => Promise<void>>();

export function useUpdateGuard(handler: () => Promise<void>) {
  const current = useRef(handler);
  useEffect(() => { current.current = handler; }, [handler]);
  useEffect(() => {
    const guard = () => current.current();
    guards.add(guard);
    return () => { guards.delete(guard); };
  }, []);
}

export async function saveBeforeUpdate() {
  for (const guard of guards) await guard();
}
