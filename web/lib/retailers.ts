/**
 * Retailer constants.
 *
 * These are properties of the retailer itself, not of any one store, so they
 * live in code rather than in the seeded `retailer_stores` table. The
 * store-specific facts — address, coordinates, page URL, and the retailer's own
 * label for that store — come from the database.
 */
export const RETAILERS = {
  homedepot: {
    label: "Home Depot",
    homeUrl: "https://www.homedepot.com",
    /** The button on their store page that makes it your store. */
    storeAction: "Shop This Store",
  },
  lowes: {
    label: "Lowe's",
    homeUrl: "https://www.lowes.com",
    storeAction: "Set as My Store",
  },
} as const;

export type RetailerId = keyof typeof RETAILERS;

export const RETAILER_IDS = Object.keys(RETAILERS) as RetailerId[];

export function isRetailerId(value: unknown): value is RetailerId {
  return typeof value === "string" && value in RETAILERS;
}
