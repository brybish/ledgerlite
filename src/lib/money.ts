// All money is stored as integer cents. These helpers convert at the boundary.
export const toCents = (dollars: number): number => Math.round(dollars * 100);
export const fromCents = (cents: number): number => cents / 100;

export const formatUSD = (cents: number): string =>
  (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });

// Sum a list of cent values safely (integers, no float drift).
export const sumCents = (xs: number[]): number => xs.reduce((a, b) => a + b, 0);
