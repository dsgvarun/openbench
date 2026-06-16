import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyCompany } from "@/lib/employer/listing-actions";
import { ListingManager, type Listing } from "@/components/employer/ListingManager";

// Employer job-listing management. Requires an approved company.
export default async function Listings() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin?next=/hire/listings");

  const company = await getMyCompany();
  if (!company) redirect("/hire/register");

  let listings: Listing[] = [];
  if (company.status === "approved") {
    const { data } = await supabase
      .from("job_listing")
      .select("id, title, function, city, ctc_band, status")
      .eq("company_id", company.companyId)
      .order("created_at", { ascending: false });
    listings = (data ?? []) as Listing[];
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
        {company.status !== "approved" ? (
          <div className="rounded-lg border border-n4 bg-white p-8">
            <h1 className="mb-2 text-3xl">{company.legalName} is awaiting verification</h1>
            <p className="text-n1">We approve direct employers within 24 hours. You can post roles once approved.</p>
          </div>
        ) : (
          <ListingManager initial={listings} />
        )}
      </div>
    </main>
  );
}
