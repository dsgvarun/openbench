import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CandidateGrid, type GridListing } from "@/components/employer/CandidateGrid";
import { getMyCompany } from "@/lib/employer/listing-actions";
import { DEMO_CARDS } from "@/lib/demo";

// Employer search / drill-through. Approved seats get real candidates + their own open
// listings to attach interest to; otherwise demo cards so the flow is clickable.
export default async function Search() {
  let demo = true;
  let cards = DEMO_CARDS;
  let listings: GridListing[] = [];

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const company = await getMyCompany();
      if (company?.status === "approved") {
        demo = false;
        const [{ data: results }, { data: openListings }] = await Promise.all([
          supabase.rpc("search_profiles", { filters: {}, lim: 20, off: 0 }),
          supabase.from("job_listing").select("id, title, ctc_band, city").eq("company_id", company.companyId).eq("status", "open").order("created_at", { ascending: false }),
        ]);
        cards = (Array.isArray(results) ? results : []).map((c: Record<string, unknown>) => ({
          candidate_id: String(c.candidate_id),
          headline: (c.headline as string) ?? "Candidate",
          seniority: (c.seniority as string) ?? "",
          cities: (c.cities as string[]) ?? [],
          expected_band: (c.expected_band as GridListing["ctc_band"]) ?? "b25_40",
          availability: (c.availability as string) ?? "",
          skills: (c.skills as string[]) ?? [],
          industries: [],
          employers_hidden: !(c.revealed as boolean),
        }));
        listings = (openListings ?? []) as GridListing[];
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
        <CandidateGrid cards={cards} demo={demo} listings={listings} />
      </div>
    </main>
  );
}
