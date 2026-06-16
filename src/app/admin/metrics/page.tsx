import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Admin metrics dashboard (Phase 6.3) — the kill/pivot + placement-grade signals.
export default async function Metrics() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/signin?next=/admin/metrics");

  const { data } = await supabase.rpc("admin_metrics");
  const m = (data ?? {}) as Record<string, unknown>;
  const forbidden = m.error === "forbidden" || !data;

  const interests = (m.interests as Record<string, number> | undefined) ?? {};
  const stat = (label: string, value: unknown) => ({ label, value: value === null || value === undefined ? "—" : String(value) });

  const cards = [
    stat("Active candidates", m.candidates_active),
    stat("Published profiles", m.candidates_published),
    stat("Open listings", m.listings_open),
    stat("Companies approved", m.companies_approved),
    stat("Companies pending", m.companies_pending),
    stat("Interests accepted", interests.accepted),
    stat("Accept rate", m.accept_rate),
    stat("Reveals", m.reveals_total),
    stat("Hires", m.hires),
    stat("In process", m.in_process),
    stat("Intro emails delivered", m.intro_delivered),
  ];

  return (
    <main className="mx-auto max-w-[900px] px-6">
      <header className="flex items-center justify-between border-b border-n4 py-5">
        <Link href="/" className="font-display text-[22px] font-semibold">
          Open<span className="text-sage">Bench</span>
        </Link>
        <Link href="/admin" className="text-sm font-semibold text-sage">← Verification queue</Link>
      </header>
      <div className="py-10">
        <h1 className="mb-1 text-4xl">Metrics</h1>
        <p className="mb-8 text-n1">North-star is accepted reveals; watch accept rate and hires for the loop completing.</p>
        {forbidden ? (
          <p className="rounded-lg border border-n4 bg-white p-6 text-n1">Admins only. Ask an admin to add your user to <code>app_admin</code>.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {cards.map((c) => (
              <div key={c.label} className="rounded-lg border border-n4 bg-white p-5 shadow-[var(--shadow-soft)]">
                <div className="text-3xl font-semibold tabular">{c.value}</div>
                <div className="mt-1 text-sm text-n1">{c.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
