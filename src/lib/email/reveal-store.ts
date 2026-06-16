import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PendingReveal, RevealStore } from "./intro";

// Admin-backed RevealStore (service role). Shared by the daily cron and the
// send-on-accept path. Pass `interestId` to scope to a single reveal (instant intro
// when a candidate accepts); omit it for the batch cron over all pending/failed reveals.
export function adminRevealStore(opts: { interestId?: string } = {}): RevealStore {
  const admin = createAdminClient();

  return {
    async pending(limit) {
      let q = admin
        .from("reveal")
        .select("id, candidate_id, company_id, interest_id")
        .in("intro_delivery", ["pending", "failed"])
        .limit(limit);
      if (opts.interestId) q = q.eq("interest_id", opts.interestId);
      const { data } = await q;

      const out: PendingReveal[] = [];
      for (const r of data ?? []) {
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
}
