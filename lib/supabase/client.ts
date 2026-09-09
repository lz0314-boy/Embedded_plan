import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type SupabaseConfig = {
  url: string;
  publishableKey: string;
};

let browserClient: SupabaseClient | null | undefined;

export function getSupabaseConfig(): SupabaseConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey = (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)?.trim();
  if (!url || !publishableKey) return null;

  try {
    const parsed = new URL(url);
    if (!/^https?:$/.test(parsed.protocol)) return null;
  } catch {
    return null;
  }

  if (/service_role|sb_secret|secret/i.test(publishableKey)) return null;
  return { url, publishableKey };
}

export function isSupabaseConfigured() {
  return getSupabaseConfig() !== null;
}

export function getSupabaseClient(): SupabaseClient | null {
  if (typeof window === "undefined") return null;
  if (browserClient !== undefined) return browserClient;
  const config = getSupabaseConfig();
  browserClient = config
    ? createClient(config.url, config.publishableKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          flowType: "pkce",
        },
      })
    : null;
  return browserClient;
}

export function resetSupabaseClientForTests() {
  browserClient = undefined;
}
