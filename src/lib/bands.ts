// Predefined CTC bands (₹). Order + labels shared across the index and forms.
export const CTC_BANDS = ["b4_8", "b8_15", "b15_25", "b25_40", "b40_60", "b60_80", "b80_plus"] as const;
export type CtcBand = (typeof CTC_BANDS)[number];

export const BAND_LABEL: Record<CtcBand, string> = {
  b4_8: "₹4–8L",
  b8_15: "₹8–15L",
  b15_25: "₹15–25L",
  b25_40: "₹25–40L",
  b40_60: "₹40–60L",
  b60_80: "₹60–80L",
  b80_plus: "₹80L+",
};
