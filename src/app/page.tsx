import Link from "next/link";

// Candidate-facing public landing. Warm & human — trust through empathy (DESIGN.md).
export default function Home() {
  return (
    <main className="mx-auto max-w-[1080px] px-6">
      <header className="flex items-center justify-between border-b border-n4 py-5">
        <div className="font-display text-[22px] font-semibold">
          Open<span className="text-sage">Bench</span>
        </div>
        <nav className="hidden gap-7 text-[15px] text-n1 sm:flex">
          <Link href="/for-employers">For employers</Link>
          <Link href="/me">For candidates</Link>
        </nav>
        <Link
          href="/me"
          className="rounded-md border border-n3 px-5 py-2.5 text-[15px] font-semibold"
        >
          Sign in
        </Link>
      </header>

      <section className="max-w-[720px] py-16 sm:py-20">
        <span className="text-xs font-semibold uppercase tracking-[0.08em] text-sage">
          Verified available · India
        </span>
        <h1 className="mb-4 mt-4 text-4xl leading-[1.04] sm:text-[54px]">
          On the market? Set your terms. Stay invisible until you say yes.
        </h1>
        <p className="mb-7 max-w-[560px] text-lg text-n1">
          Upload your resume, declare what you want, and choose exactly how
          visible you are. Your name and your employers stay hidden by default.
          No company sees who you are until you accept.
        </p>
        <div className="flex items-center gap-3.5">
          <Link
            href="/me"
            className="rounded-md bg-sage px-5 py-2.5 text-[15px] font-semibold text-white"
          >
            Create your profile
          </Link>
          <Link
            href="/for-employers"
            className="rounded-md border border-n3 px-5 py-2.5 text-[15px] font-semibold"
          >
            I&apos;m hiring
          </Link>
        </div>
      </section>
    </main>
  );
}
