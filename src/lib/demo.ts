// Demo data for click-through before a database is connected. When there's no
// Supabase session, screens render this sample data and advance locally; once the DB
// is connected and a user signs in, the same screens drive the real server actions.

import type { CtcBand } from "./bands";

export interface DemoEmployer {
  id: string;
  name: string;
  domain: string | null;
  is_current: boolean;
  tenure: string | null;
}

export interface DemoCard {
  candidate_id: string;
  headline: string;
  seniority: string;
  cities: string[];
  expected_band: CtcBand;
  availability: string;
  skills: string[];
  industries: string[];
  employers_hidden: boolean;
}

export interface DemoRequest {
  id: string;
  company: string;
  role: string;
  band: CtcBand;
  city: string;
  note: string;
  sent: string;
}

export const DEMO_PARSED_EMPLOYERS: DemoEmployer[] = [
  { id: "d1", name: "Razorpay", domain: "razorpay.com", is_current: true, tenure: "Mar 2023 – Current" },
  { id: "d2", name: "Flipkart", domain: "flipkart.com", is_current: false, tenure: "2020 – 2023" },
  { id: "d3", name: "Freshworks", domain: "freshworks.com", is_current: false, tenure: "2018 – 2020" },
];

export const DEMO_CARDS: DemoCard[] = [
  {
    candidate_id: "c1",
    headline: "Senior Product Manager, payments",
    seniority: "senior",
    cities: ["Mumbai"],
    expected_band: "b25_40",
    availability: "serving notice (free Aug 1)",
    skills: ["roadmaps", "payments", "growth"],
    industries: ["Fintech", "SaaS"],
    employers_hidden: true,
  },
  {
    candidate_id: "c2",
    headline: "Group PM, marketplace",
    seniority: "lead",
    cities: ["Bengaluru", "Remote"],
    expected_band: "b40_60",
    availability: "available now",
    skills: ["marketplace", "0→1", "experimentation"],
    industries: ["E-commerce"],
    employers_hidden: true,
  },
  {
    candidate_id: "c3",
    headline: "Product Manager, B2B SaaS",
    seniority: "mid",
    cities: ["Mumbai", "Pune"],
    expected_band: "b15_25",
    availability: "30 days",
    skills: ["B2B", "onboarding", "analytics"],
    industries: ["SaaS"],
    employers_hidden: false,
  },
];

export interface DemoCompany {
  id: string;
  legal_name: string;
  domain: string;
  seat_email: string;
  requested: string;
}

export const DEMO_PENDING_COMPANIES: DemoCompany[] = [
  { id: "co1", legal_name: "Acme Fintech Pvt Ltd", domain: "acmefintech.com", seat_email: "priya@acmefintech.com", requested: "3 hours ago" },
  { id: "co2", legal_name: "Northwind Commerce", domain: "northwind.in", seat_email: "rahul@northwind.in", requested: "1 day ago" },
  { id: "co3", legal_name: "Lumen Health", domain: "lumenhealth.co", seat_email: "ops@lumenhealth.co", requested: "2 days ago" },
];

export const DEMO_REQUESTS: DemoRequest[] = [
  {
    id: "r1",
    company: "Acme Fintech",
    role: "Senior PM, Payments",
    band: "b25_40",
    city: "Mumbai",
    note: "Loved your payments background — we're building a new UPI stack and your profile fits exactly.",
    sent: "2 days ago",
  },
  {
    id: "r2",
    company: "Northwind Commerce",
    role: "Group PM, Marketplace",
    band: "b40_60",
    city: "Remote",
    note: "We're hiring a GPM for our seller platform. Would love to talk.",
    sent: "5 days ago",
  },
];
