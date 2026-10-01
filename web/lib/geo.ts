const EARTH_RADIUS_MILES = 3958.8;

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

export type Point = { lat: number; lng: number };

/**
 * Great-circle distance in miles.
 *
 * The store list is a few hundred rows, so this runs in the app rather than
 * adding a PostGIS dependency or an RPC. It stops being the right call at
 * thousands of stores, or the first time we need a radius query.
 */
export function distanceMiles(from: Point, to: Point) {
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** "2.4 mi" close in, "18 mi" further out — a tenth of a mile is noise by then. */
export function formatDistance(miles: number) {
  return miles < 10 ? `${miles.toFixed(1)} mi` : `${Math.round(miles)} mi`;
}

/**
 * `zip_centroids` is keyed on the 5-digit ZIP, and ZIP+4 and stray spaces are
 * common in what people type. Anything with fewer than five digits is not a ZIP.
 */
export function normalizeZip(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 5 ? digits.slice(0, 5) : null;
}
