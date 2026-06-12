import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

// Service-role client. BYPASSES RLS. Use ONLY in trusted server code that must
// act across users: nightly stat snapshots, listing expiry, admin approval, abuse
// adjudication. NEVER import this into a candidate- or employer-facing read path —
// that would defeat the entire privacy model.
export function createAdminClient() {
  if (!env.supabaseServiceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY missing — admin client unavailable.");
  }
  return createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
