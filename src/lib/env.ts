// Centralized env access. NEXT_PUBLIC_* are safe in the browser; the rest are server-only.
// We read lazily so `next build` doesn't fail before a Supabase project is linked.

export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  // Server-only. Bypasses RLS — use ONLY in trusted server code (jobs, admin RPC). Never ship to client.
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
} as const;

export function assertSupabaseEnv() {
  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    throw new Error(
      "Supabase env missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (see .env.example).",
    );
  }
}
