import { describe, it, expect } from "vitest";
import { processIntroEmails, type PendingReveal, type RevealStore } from "./intro";
import { FakeEmailClient, type EmailMessage } from "./client";

function reveal(id: string, candidateEmail: string): PendingReveal {
  return {
    id,
    candidateEmail,
    candidateName: "Asha",
    companyName: "Acme",
    seatEmails: ["rec@acme.com"],
    role: "Senior PM",
  };
}

class FakeStore implements RevealStore {
  status: Record<string, "pending" | "delivered" | "failed"> = {};
  constructor(private reveals: PendingReveal[]) {
    reveals.forEach((r) => (this.status[r.id] = "pending"));
  }
  async pending(limit: number) {
    return this.reveals.filter((r) => this.status[r.id] === "pending").slice(0, limit);
  }
  async markDelivered(id: string) { this.status[id] = "delivered"; }
  async markFailed(id: string) { this.status[id] = "failed"; }
}

describe("processIntroEmails", () => {
  it("delivers both intros and marks delivered", async () => {
    const store = new FakeStore([reveal("a", "a@x.com")]);
    const email = new FakeEmailClient();
    const r = await processIntroEmails(store, email);
    expect(r).toEqual({ processed: 1, delivered: 1, failed: 0 });
    expect(email.sent).toHaveLength(2); // candidate + seat
    expect(store.status.a).toBe("delivered");
  });

  it("marks failed (for retry) when an intro send fails, without blocking others", async () => {
    const store = new FakeStore([reveal("a", "a@x.com"), reveal("b", "b@x.com")]);
    const email = new FakeEmailClient((m: EmailMessage) => m.to === "a@x.com");
    const r = await processIntroEmails(store, email);
    expect(r.delivered).toBe(1);
    expect(r.failed).toBe(1);
    expect(store.status.a).toBe("failed");
    expect(store.status.b).toBe("delivered");
  });

  it("is idempotent — a second run skips already-delivered reveals", async () => {
    const store = new FakeStore([reveal("a", "a@x.com")]);
    const email = new FakeEmailClient();
    await processIntroEmails(store, email);
    const r2 = await processIntroEmails(store, email);
    expect(r2.processed).toBe(0); // nothing left pending
    expect(email.sent).toHaveLength(2); // not re-sent
  });
});
