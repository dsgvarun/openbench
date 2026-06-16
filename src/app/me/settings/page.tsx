import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CandidateSettings } from "@/components/candidate/CandidateSettings";
import { SignOutButton } from "@/components/auth/SignOutButton";

type Status = "active" | "paused" | "placed";

export default async function Settings() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin?next=/me/settings");

  const { data: cand } = await supabase.from("candidate").select("status").eq("user_id", user.id).maybeSingle();
  if (!cand) redirect("/me/onboarding");
  const status = (cand.status === "deleted" ? "active" : cand.status) as Status;

  return (
    <main className="mx-auto max-w-[640px] px-6">
      <header className="flex items-center justify-between border-b border-n4 py-5">
        <Link href="/" className="font-display text-[22px] font-semibold">
          Open<span className="text-sage">Bench</span>
        </Link>
        <div className="flex items-center gap-5 text-sm">
          <Link href="/me/inbox" className="font-semibold text-sage">Your inbox →</Link>
          <SignOutButton />
        </div>
      </header>
      <div className="py-12">
        <h1 className="mb-8 text-4xl">Account settings</h1>
        <CandidateSettings initialStatus={status} />
      </div>
    </main>
  );
}
