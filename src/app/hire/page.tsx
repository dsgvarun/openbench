import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { BAND_LABEL, CTC_BANDS, type CtcBand } from "@/lib/bands";

// Employer comp/availability index (Phase 3.2) — the first thing a verified recruiter
// sees (CEO decision D6/D7). Leads with the market, every aggregate drills into the
// candidates behind it. k-anon-suppressed cells render hatched, never as a number.

type BandRow = { band: CtcBand; count: number | null; suppressed: boolean };
type Curve = { within_30: number | null; within_60: number | null; within_90: number | null };

async function loadIndex() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { state: "anon" as const };

    const { data: seat } = await supabase.from("seat").select("company_id").eq("user_id", user.id).maybeSingle();
    if (!seat) return { state: "unverified" as const };

    const [pool, dist, curve] = await Promise.all([
      supabase.rpc("pool_count", { filters: {} }),
      supabase.rpc("band_distribution", { filters: {} }),
      supabase.rpc("availability_curve", { filters: {} }),
    ]);

    return {
      state: "ready" as const,
      total: (pool.data as { count: number | null; suppressed: boolean } | null) ?? { count: null, suppressed: true },
      bands: ((dist.data as BandRow[] | null) ?? []),
      curve: (curve.data as Curve | null) ?? { within_30: null, within_60: null, within_90: null },
    };
  } catch {
    return { state: "error" as const };
  }
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-[1080px] px-6">
      <header className="flex items-center justify-between border-b border-n4 py-5">
        <Link href="/" className="font-display text-[22px] font-semibold">
          Open<span className="text-sage">Bench</span>
        </Link>
        <span className="text-sm text-n1">Hiring workspace</span>
      </header>
      {children}
    </main>
  );
}

export default async function Hire() {
  const idx = await loadIndex();

  if (idx.state === "anon")
    return (
      <Shell>
        <div className="py-20">
          <h1 className="text-4xl">Sign in to your hiring workspace</h1>
          <p className="mt-3 text-n1">Verified recruiters see the live market here.</p>
        </div>
      </Shell>
    );

  if (idx.state === "unverified")
    return (
      <Shell>
        <div className="py-20">
          <h1 className="text-4xl">Verify your company to continue</h1>
          <p className="mt-3 max-w-[520px] text-n1">
            We approve direct employers (work email, no free-mail) within 24 hours. Once
            you&apos;re verified, the full comp and availability index unlocks.
          </p>
        </div>
      </Shell>
    );

  if (idx.state === "error" || idx.state !== "ready")
    return (
      <Shell>
        <div className="py-20">
          <h1 className="text-4xl">The market index is warming up</h1>
          <p className="mt-3 text-n1">Connect the database to see live counts. (No data yet.)</p>
        </div>
      </Shell>
    );

  const maxCount = Math.max(1, ...idx.bands.map((b) => b.count ?? 0));

  return (
    <Shell>
      <section className="max-w-[760px] py-12">
        <span className="text-xs font-semibold uppercase tracking-[0.08em] text-sage">
          Verified available · India
        </span>
        <h1 className="mb-3 mt-3 text-4xl leading-[1.05] sm:text-[44px]">
          {idx.total.suppressed ? "The market" : <><span className="tabular">{idx.total.count}</span> people on the market right now</>}
        </h1>
        <p className="max-w-[560px] text-lg text-n1">
          Every person here is genuinely available, with comp and start date declared
          upfront. Read the market, then reach the people behind any number.
        </p>
      </section>

      <section className="mb-8 rounded-lg border border-n4 bg-white p-7 shadow-[var(--shadow-soft)]">
        <div className="mb-1 flex items-baseline justify-between">
          <h2 className="text-2xl">Available by salary band</h2>
          <Link href="/hire/search" className="text-sm font-semibold text-sage">
            See the candidates →
          </Link>
        </div>
        <div className="mt-5 space-y-2.5">
          {CTC_BANDS.map((band) => {
            const row = idx.bands.find((b) => b.band === band);
            const count = row?.count ?? null;
            const suppressed = row?.suppressed ?? true;
            const width = suppressed ? 22 : Math.max(6, Math.round(((count ?? 0) / maxCount) * 100));
            return (
              <div key={band} className="flex items-center gap-3 text-sm">
                <span className="w-20 text-n1">{BAND_LABEL[band]}</span>
                <div className="h-[22px] flex-1 overflow-hidden rounded-[var(--radius-sm)] bg-sage-soft">
                  <div
                    className={`h-full rounded-[var(--radius-sm)] ${suppressed ? "" : "bg-sage"}`}
                    style={
                      suppressed
                        ? {
                            width: `${width}%`,
                            backgroundImage:
                              "repeating-linear-gradient(45deg, var(--color-n3), var(--color-n3) 5px, var(--color-n4) 5px, var(--color-n4) 10px)",
                          }
                        : { width: `${width}%` }
                    }
                  />
                </div>
                <span className="w-12 text-right font-semibold tabular" aria-label={suppressed ? "fewer than 5, suppressed" : undefined}>
                  {suppressed ? "<5" : count}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mb-16 rounded-lg border border-n4 bg-white p-7 shadow-[var(--shadow-soft)]">
        <h2 className="mb-5 text-2xl">How soon they can start</h2>
        <div className="grid grid-cols-3 gap-4">
          {(["within_30", "within_60", "within_90"] as const).map((k, i) => {
            const v = idx.curve[k];
            return (
              <div key={k} className="rounded-md border border-n4 p-4">
                <div className="text-3xl font-semibold tabular" aria-label={v === null ? "fewer than 5, suppressed" : undefined}>
                  {v === null ? "<5" : v}
                </div>
                <div className="mt-1 text-sm text-n1">within {[30, 60, 90][i]} days</div>
              </div>
            );
          })}
        </div>
      </section>
    </Shell>
  );
}
