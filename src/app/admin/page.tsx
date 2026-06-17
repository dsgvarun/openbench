import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AdminQueue } from "@/components/admin/AdminQueue";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { DEMO_PENDING_COMPANIES, type DemoCompany } from "@/lib/demo";

// Admin: company verification queue (Phase 3.1). Real pending companies for an admin
// (RLS gates the data); demo queue otherwise so the flow is clickable.
export default async function Admin() {
  // Demo queue only for anonymous visitors. Signed-in non-admins get a clear
  // "admins only" message (not fake data); admins get the real pending companies.
  let demo = true;
  let signedIn = false;
  let isAdminUser = false;
  let companies: DemoCompany[] = DEMO_PENDING_COMPANIES;

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    signedIn = !!user;
    if (user) {
      const { data: isAdmin } = await supabase.rpc("is_admin");
      isAdminUser = !!isAdmin;
      if (isAdmin) {
        demo = false;
        const { data } = await supabase
          .from("company")
          .select("id, legal_name, domain, seat(email), created_at")
          .eq("verification_status", "pending")
          .order("created_at");
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

  const notAdmin = signedIn && !isAdminUser;

  return (
    <main className="mx-auto max-w-[820px] px-6">
      <header className="flex items-center justify-between border-b border-n4 py-5">
        <Link href="/" className="font-display text-[22px] font-semibold">
          Open<span className="text-sage">Bench</span>
        </Link>
        <div className="flex items-center gap-5 text-sm">
          {isAdminUser && <Link href="/admin/metrics" className="font-semibold text-sage">Metrics</Link>}
          {signedIn && <SignOutButton />}
        </div>
      </header>
      <div className="py-10">
        <h1 className="mb-1 text-4xl">Verification queue</h1>
        <p className="mb-8 text-n1">Approve direct employers (work email, no free-mail). Approval unlocks the index for their seats.</p>
        {notAdmin ? (
          <div className="rounded-lg border border-n4 bg-white p-8">
            <h2 className="mb-2 text-2xl">Admins only</h2>
            <p className="text-n1">
              Your account isn&apos;t a platform admin, so the real verification queue is
              hidden. Ask an existing admin to add your user to <code>app_admin</code> (or
              sign in with the admin account).
            </p>
          </div>
        ) : (
          <AdminQueue companies={companies} demo={demo} />
        )}
      </div>
    </main>
  );
}
