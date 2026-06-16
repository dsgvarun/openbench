import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AdminQueue } from "@/components/admin/AdminQueue";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { DEMO_PENDING_COMPANIES, type DemoCompany } from "@/lib/demo";

// Admin: company verification queue (Phase 3.1). Real pending companies for an admin
// (RLS gates the data); demo queue otherwise so the flow is clickable.
export default async function Admin() {
  let demo = true;
  let companies: DemoCompany[] = DEMO_PENDING_COMPANIES;

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: isAdmin } = await supabase.rpc("is_admin");
      if (isAdmin) {
        const { data } = await supabase
          .from("company")
          .select("id, legal_name, domain, seat(email), created_at")
          .eq("verification_status", "pending")
          .order("created_at");
        demo = false;
        companies = (data ?? []).map((c: Record<string, unknown>) => ({
          id: String(c.id),
          legal_name: String(c.legal_name),
          domain: String(c.domain),
          seat_email: (c.seat as { email: string }[] | null)?.[0]?.email ?? "—",
          requested: "",
        }));
      }
    }
  } catch {
    demo = true;
  }

  return (
    <main className="mx-auto max-w-[820px] px-6">
      <header className="flex items-center justify-between border-b border-n4 py-5">
        <Link href="/" className="font-display text-[22px] font-semibold">
          Open<span className="text-sage">Bench</span>
        </Link>
        <div className="flex items-center gap-5 text-sm">
          <Link href="/admin/metrics" className="font-semibold text-sage">Metrics</Link>
          {!demo && <SignOutButton />}
        </div>
      </header>
      <div className="py-10">
        <h1 className="mb-1 text-4xl">Verification queue</h1>
        <p className="mb-8 text-n1">Approve direct employers (work email, no free-mail). Approval unlocks the index for their seats.</p>
        <AdminQueue companies={companies} demo={demo} />
      </div>
    </main>
  );
}
