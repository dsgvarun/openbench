import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { RevealInbox } from "@/components/candidate/RevealInbox";
import { DEMO_REQUESTS } from "@/lib/demo";

// Candidate reveal inbox. Demo requests when there's no session; real interest requests
// (with accept/decline driving the RPCs) once a candidate is signed in.
export default async function Inbox() {
  let demo = true;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) demo = false; // real requests loaded here once seeded
  } catch {
    demo = true;
  }

  return (
    <main className="mx-auto max-w-[680px] px-6">
      <header className="flex items-center justify-between border-b border-n4 py-5">
        <Link href="/" className="font-display text-[22px] font-semibold">
          Open<span className="text-sage">Bench</span>
        </Link>
        <div className="flex items-center gap-5 text-sm">
          <Link href="/me/onboarding" className="font-semibold text-sage">Edit profile</Link>
          <Link href="/me/settings" className="font-semibold text-sage">Settings</Link>
        </div>
      </header>
      <div className="py-10">
        <h1 className="mb-1 text-4xl">Your interest inbox</h1>
        <p className="mb-8 text-n1">Each company sees only the role and your terms — never who you are, until you accept.</p>
        <RevealInbox requests={demo ? DEMO_REQUESTS : []} demo={demo} />
      </div>
    </main>
  );
}
