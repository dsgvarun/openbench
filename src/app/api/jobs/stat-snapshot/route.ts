import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedCron } from "@/lib/jobs/auth";

export const dynamic = "force-dynamic";

// Cron job: recompute the global stat snapshot (Phase 5.1).
export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("refresh_stat_snapshot");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ slices: data ?? 0 });
}
