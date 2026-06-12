import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { EmployerConfirmation, type EmployerRow } from "@/components/onboarding/EmployerConfirmation";

// Onboarding — currently mounts the fail-closed employer-confirmation step (Phase 2.3).
// The upload → parse → preferences → visibility → publish stepper wires around this
// once Supabase + the Anthropic key are connected (Phase 2 remaining).
export default async function Onboarding() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="mx-auto max-w-[1080px] px-6 py-20">
        <h1 className="text-4xl">Sign in to continue</h1>
        <p className="mt-3 text-n1">
          Onboarding needs an account.{" "}
          <Link href="/me" className="text-sage underline">
            Sign in
          </Link>
          .
        </p>
      </main>
    );
  }

  // Load the parsed-but-unconfirmed employer list for this candidate.
  const { data: cand } = await supabase.from("candidate").select("id").eq("user_id", user.id).maybeSingle();
  let employers: EmployerRow[] = [];
  if (cand) {
    const { data } = await supabase
      .from("candidate_employer")
      .select("id, name, domain, is_current")
      .eq("candidate_id", cand.id)
      .order("display_order");
    employers = (data ?? []) as EmployerRow[];
  }

  return (
    <main className="mx-auto max-w-[1080px] px-6 py-16">
      <EmployerConfirmation parsedEmployers={employers} />
    </main>
  );
}
