import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CandidateGrid } from "@/components/employer/CandidateGrid";
import { DEMO_CARDS } from "@/lib/demo";

// Employer search / drill-through. With a verified seat it calls search_profiles();
// otherwise demo cards so the flow is clickable.
export default async function Search() {
  let demo = true;
  let cards = DEMO_CARDS;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: seat } = await supabase.from("seat").select("company_id").eq("user_id", user.id).maybeSingle();
      if (seat) {
        const { data } = await supabase.rpc("search_profiles", { filters: {}, lim: 20, off: 0 });
        if (Array.isArray(data) && data.length) {
          demo = false;
          // Map projected cards → the grid's shape (real cards omit demo-only fields).
          cards = data.map((c: Record<string, unknown>) => ({
            candidate_id: String(c.candidate_id),
            headline: (c.headline as string) ?? "Candidate",
            seniority: (c.seniority as string) ?? "",
            cities: (c.cities as string[]) ?? [],
            expected_band: (c.expected_band as DemoBand) ?? "b25_40",
            availability: (c.availability as string) ?? "",
            skills: ((c.skills as string[]) ?? []),
            industries: [],
            employers_hidden: !(c.revealed as boolean),
          }));
        }
      }
    }
  } catch {
    demo = true;
  }

  return (
    <main className="mx-auto max-w-[1080px] px-6">
      <header className="flex items-center justify-between border-b border-n4 py-5">
        <Link href="/hire" className="font-display text-[22px] font-semibold">
          Open<span className="text-sage">Bench</span>
        </Link>
        <Link href="/hire" className="text-sm font-semibold text-sage">← Back to the index</Link>
      </header>
      <div className="py-10">
        <h1 className="mb-1 text-4xl">Candidates</h1>
        <p className="mb-8 text-n1">Everyone here is genuinely available, with terms declared upfront.</p>
        <CandidateGrid cards={cards} demo={demo} />
      </div>
    </main>
  );
}

type DemoBand = (typeof DEMO_CARDS)[number]["expected_band"];
