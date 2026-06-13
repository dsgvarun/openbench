import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedCron } from "@/lib/jobs/auth";
import { ResendEmailClient } from "@/lib/email/client";
import { processIntroEmails, type PendingReveal, type RevealStore } from "@/lib/email/intro";

export const dynamic = "force-dynamic";

// Cron job: send queued reveal intro emails. Crash-safe via reveal.intro_delivery
// ('pending'/'failed' → retried; 'delivered' terminal). Service-role; never client-callable.
export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  const store: RevealStore = {
    async pending(limit) {
      const { data } = await admin
        .from("reveal")
        .select("id, candidate_id, company_id, interest_id")
        .in("intro_delivery", ["pending", "failed"])
        .limit(limit);
      const rows = data ?? [];
      const out: PendingReveal[] = [];
      for (const r of rows) {
        const [{ data: cand }, { data: company }, { data: interest }, { data: seats }] = await Promise.all([
          admin.from("candidate").select("email").eq("id", r.candidate_id).maybeSingle(),
          admin.from("company").select("legal_name").eq("id", r.company_id).maybeSingle(),
          admin.from("interest_request").select("listing:listing_id(title)").eq("id", r.interest_id).maybeSingle(),
          admin.from("seat").select("email").eq("company_id", r.company_id),
        ]);
        const { data: resume } = await admin
          .from("resume").select("parsed_json").eq("candidate_id", r.candidate_id)
          .order("version", { ascending: false }).limit(1).maybeSingle();
        out.push({
          id: r.id as string,
          candidateEmail: (cand?.email as string) ?? "",
          candidateName: ((resume?.parsed_json as { name?: string } | null)?.name) ?? "the candidate",
          companyName: (company?.legal_name as string) ?? "the company",
          seatEmails: (seats ?? []).map((s) => s.email as string).filter(Boolean),
          role: ((interest?.listing as { title?: string } | null)?.title) ?? "the role",
        });
      }
      return out;
    },
    async markDelivered(id) {
      await admin.from("reveal").update({ intro_delivery: "delivered" }).eq("id", id);
    },
    async markFailed(id) {
      await admin.from("reveal").update({ intro_delivery: "failed" }).eq("id", id);
    },
  };

  const result = await processIntroEmails(store, new ResendEmailClient());
  return NextResponse.json(result);
}
