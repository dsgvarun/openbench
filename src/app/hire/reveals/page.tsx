import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyCompany } from "@/lib/employer/listing-actions";
import { RevealOutcomes, type RevealedCandidate } from "@/components/employer/RevealOutcomes";

// Employer's revealed candidates (full contact via profile_card) + outcome marking.
export default async function Reveals() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/signin?next=/hire/reveals");

  const company = await getMyCompany();
  if (!company) redirect("/hire/register");

  let reveals: RevealedCandidate[] = [];
  if (company.status === "approved") {
    const { data: rows } = await supabase
      .from("reveal")
      .select("id, candidate_id, outcome")
      .eq("company_id", company.companyId)
      .order("revealed_at", { ascending: false });

    reveals = await Promise.all(
      (rows ?? []).map(async (r) => {
        // profile_card returns the revealed identity (name, email) for a company with a reveal.
        const { data: card } = await supabase.rpc("profile_card", { cand: r.candidate_id });
        const c = (card ?? {}) as Record<string, unknown>;
        return {
          revealId: r.id as string,
          name: (c.name as string) ?? "Revealed candidate",
          email: (c.email as string) ?? null,
          headline: (c.headline as string) ?? "",
          outcome: (r.outcome as RevealedCandidate["outcome"]) ?? null,
        };
      }),
    );
  }

  return (
    <main className="mx-auto max-w-[820px] px-6">
      <header className="flex items-center justify-between border-b border-n4 py-5">
        <Link href="/hire" className="font-display text-[22px] font-semibold">
          Open<span className="text-sage">Bench</span>
        </Link>
        <Link href="/hire" className="text-sm font-semibold text-sage">← The index</Link>
      </header>
      <div className="py-10">
        <h1 className="mb-1 text-4xl">Your reveals</h1>
        <p className="mb-8 text-n1">Candidates who accepted your interest. Mark outcomes so we can measure placements.</p>
        <RevealOutcomes reveals={reveals} />
      </div>
    </main>
  );
}
