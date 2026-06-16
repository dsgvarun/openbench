import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SignInForm } from "@/components/auth/SignInForm";

// Email OTP sign-in (no passwords). Requests a 6-digit code, verifies it, redirects to
// ?next (default /me). If already signed in, skip straight to next.
export default async function SignIn({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const dest = next && next.startsWith("/") ? next : "/me";

  let signedIn = false;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    signedIn = !!user;
  } catch {
    // no session / demo — show the form
  }
  if (signedIn) redirect(dest); // outside try: redirect() throws a control-flow signal

  return (
    <main className="mx-auto max-w-[1080px] px-6">
      <header className="flex items-center justify-between border-b border-n4 py-5">
        <Link href="/" className="font-display text-[22px] font-semibold">
          Open<span className="text-sage">Bench</span>
        </Link>
      </header>
      <div className="mx-auto max-w-[420px] py-16">
        <Suspense>
          <SignInForm />
        </Suspense>
      </div>
    </main>
  );
}
