"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Email OTP: request a 6-digit code, then verify it. No passwords, no redirect callback.
export function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/me";
  const msg = params.get("msg");

  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function requestCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        shouldCreateUser: true,
        // Make the email's magic link work too (not just the code): it lands on our
        // callback, which completes the session. Must be in Supabase's Redirect URLs.
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    setBusy(false);
    if (error) setError(error.message);
    else setStep("code");
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: code.trim(),
      type: "email",
    });
    setBusy(false);
    if (error) setError(error.message);
    else {
      router.push(next);
      router.refresh();
    }
  }

  return (
    <div>
      <h1 className="mb-2 text-3xl">{step === "email" ? "Sign in to OpenBench" : "Enter your code"}</h1>
      <p className="mb-6 text-n1">
        {step === "email"
          ? "We'll email you a one-time code. No passwords."
          : `We sent a 6-digit code to ${email}. Enter it below.`}
      </p>

      {msg && step === "email" && (
        <p className="mb-5 rounded-md border-l-[3px] border-clay bg-clay-soft px-3 py-2 text-sm">
          {msg === "link_expired"
            ? "That email link expired. Enter your email for a fresh code."
            : "Couldn't complete that sign-in link. Enter your email to try again."}
        </p>
      )}

      {step === "email" ? (
        <form onSubmit={requestCode} className="space-y-4">
          <input
            type="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@work-email.com"
            className="w-full rounded-md border border-n3 bg-white px-3.5 py-2.5 text-[15px]"
          />
          {error && <p className="text-sm text-error">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-md bg-sage px-5 py-2.5 text-[15px] font-semibold text-white disabled:opacity-40"
          >
            {busy ? "Sending…" : "Email me a code"}
          </button>
        </form>
      ) : (
        <form onSubmit={verify} className="space-y-4">
          <input
            inputMode="numeric"
            required
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="123456"
            className="w-full rounded-md border border-n3 bg-white px-3.5 py-2.5 text-center text-2xl tracking-[0.3em] tabular"
          />
          {error && <p className="text-sm text-error">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-md bg-sage px-5 py-2.5 text-[15px] font-semibold text-white disabled:opacity-40"
          >
            {busy ? "Verifying…" : "Verify & continue"}
          </button>
          <button
            type="button"
            onClick={() => { setStep("email"); setCode(""); setError(null); }}
            className="w-full text-sm text-n1"
          >
            Use a different email
          </button>
        </form>
      )}
    </div>
  );
}
