import Link from "next/link";

// Employer-facing public landing. Leads with the comp/availability index (CEO decision D6/D7).
// This is a static teaser; the live index (Phase 3.2) drills into the real pool.
export default function ForEmployers() {
  return (
    <main className="mx-auto max-w-[1080px] px-6">
      <header className="flex items-center justify-between border-b border-n4 py-5">
        <Link href="/" className="font-display text-[22px] font-semibold">
          Open<span className="text-sage">Bench</span>
        </Link>
        <Link
          href="/signin?next=/hire"
          className="rounded-md bg-sage px-5 py-2.5 text-[15px] font-semibold text-white"
        >
          List a role
        </Link>
      </header>

      <section className="max-w-[760px] py-16 sm:py-20">
        <span className="text-xs font-semibold uppercase tracking-[0.08em] text-sage">
          Verified available talent · India
        </span>
        <h1 className="mb-4 mt-4 text-4xl leading-[1.04] sm:text-[54px]">
          Know what the market costs, before you spend a single call.
        </h1>
        <p className="mb-7 max-w-[560px] text-lg text-n1">
          Every person here is genuinely on the market, with their salary
          expectation and start date declared upfront. Read the market, then
          reach the people behind the numbers.
        </p>
        <Link
          href="/signin?next=/hire"
          className="rounded-md bg-sage px-5 py-2.5 text-[15px] font-semibold text-white"
        >
          Explore the index
        </Link>
      </section>
    </main>
  );
}
