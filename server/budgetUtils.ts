/**
 * Shared budget conversion utility.
 * Budget is stored as micro-dollars (USD * 100_000) for precision without floating point issues.
 */

/** Multiplier: 1 USD = 100_000 micro-dollars in the DB */
export const USD_TO_UNITS = 100_000;

/** Convert a USD cost to the integer unit stored in the database. */
export function usdToUnits(costUsd: number): number {
  return Math.round(costUsd * USD_TO_UNITS);
}
