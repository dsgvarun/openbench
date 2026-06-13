// Email client seam. Job handlers depend on this interface, not on Resend directly,
// so delivery logic is testable with a fake and the provider is swappable.

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
}

export interface EmailClient {
  send(msg: EmailMessage): Promise<{ ok: boolean; error?: string }>;
}

// Resend via REST (no SDK dependency → no outdated-API surface). TODO(key): RESEND_API_KEY.
export class ResendEmailClient implements EmailClient {
  private from = process.env.OPENBENCH_FROM_EMAIL ?? "OpenBench <hello@openbench.in>";
  async send(msg: EmailMessage): Promise<{ ok: boolean; error?: string }> {
    const key = process.env.RESEND_API_KEY;
    if (!key) return { ok: false, error: "RESEND_API_KEY missing" };
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: this.from, to: msg.to, subject: msg.subject, html: msg.html }),
      });
      if (!res.ok) return { ok: false, error: `resend ${res.status}` };
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "send failed" };
    }
  }
}

export class FakeEmailClient implements EmailClient {
  sent: EmailMessage[] = [];
  constructor(private failOn?: (m: EmailMessage) => boolean) {}
  async send(msg: EmailMessage): Promise<{ ok: boolean; error?: string }> {
    if (this.failOn?.(msg)) return { ok: false, error: "forced failure" };
    this.sent.push(msg);
    return { ok: true };
  }
}
