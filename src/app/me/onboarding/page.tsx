import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { OnboardingStepper } from "@/components/onboarding/OnboardingStepper";

// Candidate onboarding: upload → confirm employers → preferences → visibility → publish.
// Demo mode (no Supabase session) lets the whole flow be clicked through with sample
// data; with a session the steps drive the real server actions.
export default async function Onboarding() {
  let hasSession = false;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    hasSession = !!user;
  } catch {
    hasSession = false;
  }

  return (
    <main className="mx-auto max-w-[1080px] px-6">
      <header className="flex items-center justify-between border-b border-n4 py-5">
        <Link href="/" className="font-display text-[22px] font-semibold">
          Open<span className="text-sage">Bench</span>
        </Link>
        <Link href="/me/inbox" className="text-sm font-semibold text-sage">
          Your inbox →
        </Link>
      </header>
      <div className="py-12">
        <OnboardingStepper demo={!hasSession} />
      </div>
    </main>
  );
}
