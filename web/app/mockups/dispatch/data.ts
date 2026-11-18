import type { Tone } from "@/lib/tokens";

import { SITE } from "../orders/detail/data";
import { RETAILERS } from "../start/data";

/**
 * Console demo data. The queue holds every order waiting on a dispatcher —
 * a clean parse is not a pass, it is just one of the checks. Stores and
 * distances come from `start/data.ts` (the seeded list the customer picks
 * from); the site comes from `orders/detail/data.ts`.
 */

export const DISPATCHER = {
  name: "Dana Reyes",
  initials: "DR",
};

export const NAV = [
  { label: "Review queue", badge: 6 },
  { label: "Orders" },
  { label: "Admin" },
];

export type StoreOption = {
  name: string;
  short: string;
  address: string;
  distance: string;
};

function stores(retailer: "homedepot" | "lowes"): StoreOption[] {
  const found = RETAILERS.find((r) => r.id === retailer);
  return (found?.stores ?? []).map((store) => ({
    name: store.name.replace(/^The /, ""),
    short: store.name.split(" · ").pop() ?? store.name,
    address: `${store.street}, ${store.city}`,
    distance: store.distance.toFixed(1),
  }));
}

export const STORES = {
  homedepot: stores("homedepot"),
  lowes: stores("lowes"),
};

/** The two sizes a dispatcher can price — the delivery vehicle class. */
export const SIZES = ["Car", "Truck"] as const;
export type Size = (typeof SIZES)[number];

/** The rate card a future fee rule engine would encode (see 12-deferred). */
export const FEE_POLICY = {
  sizing: { Car: "$15.00", Truck: "$45.00" } as Record<Size, string>,
  mileage: { freeMiles: 3, rate: "$2.50" },
};

export type ReviewOrder = {
  number: string;
  company: string;
  retailer: string;
  /** What the customer picked in the portal — null until they (or we) set one. */
  store: StoreOption | null;
  site: { label: string; address: string };
  items: number;
  materials: string;
  flag: string;
  tone: Tone;
  age: string;
  parse: "clean" | "mismatch" | "empty";
  confidence: string;
};

export const ORDERS: ReviewOrder[] = [
  {
    number: "#1046",
    company: "Acme Construction",
    retailer: "Home Depot",
    store: STORES.homedepot[1],
    site: SITE,
    items: 4,
    materials: "$159.74",
    flag: "Subtotal mismatch",
    tone: "danger",
    age: "12m",
    parse: "mismatch",
    confidence: "0.82",
  },
  {
    number: "#1044",
    company: "Acme Construction",
    retailer: "Home Depot",
    store: STORES.homedepot[0],
    site: SITE,
    items: 3,
    materials: "$142.18",
    flag: "Ready to verify",
    tone: "info",
    age: "8m",
    parse: "clean",
    confidence: "0.94",
  },
  {
    number: "#1052",
    company: "Bayside Builders",
    retailer: "Lowe's",
    store: STORES.lowes[2],
    site: { label: "Riverside Depot", address: "88 Depot Rd" },
    items: 6,
    materials: "$88.40",
    flag: "Store 7.2 mi out",
    tone: "warning",
    age: "22m",
    parse: "clean",
    confidence: "0.91",
  },
  {
    number: "#1053",
    company: "Acme Construction",
    retailer: "Lowe's",
    store: STORES.lowes[0],
    site: SITE,
    items: 5,
    materials: "$64.20",
    flag: "Ready to verify",
    tone: "info",
    age: "3m",
    parse: "clean",
    confidence: "0.96",
  },
  {
    number: "#1049",
    company: "Acme Construction",
    retailer: "Lowe's",
    store: STORES.lowes[0],
    site: SITE,
    items: 0,
    materials: "—",
    flag: "No items read",
    tone: "danger",
    age: "41m",
    parse: "empty",
    confidence: "—",
  },
];

export const UNATTRIBUTED = {
  address: "taylor@orders.example.com",
  detail: "Lowe's cart · no company matches this alias",
  age: "26m",
};

/** The site the customer captured — the same one the portal and driver use. */
export { SITE };

/** #1046 — what the retailer's email actually said. */
export const EMAIL = {
  from: "HomeDepot@order.homedepot.com",
  subject: "Your cart is ready",
  received: "Sep 22, 7:54 AM",
  lines: [
    {
      name: "7/16 in. OSB sheathing",
      detail: "8 @ $11.99 · #1514",
      amount: "$95.92",
    },
    { name: "2×4×8 SPF stud", detail: "10 @ $3.85 · #5116", amount: "$38.50" },
    {
      name: "16d framing nails, 1 lb",
      detail: "1 @ $7.76 · #1640",
      amount: "$7.76",
    },
    {
      name: "Builder's felt, 3 ft × 144 ft",
      detail: "1 @ $17.56 · #2270",
      amount: "$17.56",
    },
  ],
  statedSubtotal: "$159.74",
};

/** #1046 — what the parser read. One line is wrong. */
export const EXTRACTED = {
  strategy: "deterministic",
  confidence: "0.82",
  lines: [
    {
      name: "7/16 in. OSB sheathing",
      model: "1514",
      qty: "6",
      total: "$71.94",
      bad: true,
    },
    { name: "2×4×8 SPF stud", model: "5116", qty: "10", total: "$38.50" },
    {
      name: "16d framing nails, 1 lb",
      model: "1640",
      qty: "1",
      total: "$7.76",
    },
    {
      name: "Builder's felt, 3 ft × 144 ft",
      model: "2270",
      qty: "1",
      total: "$17.56",
    },
  ],
  sum: "$135.76",
  delta: "$23.98",
};

/** #1044 — a clean parse, priced from the rate card. */
export const QUOTE = {
  number: "#1044",
  company: "Acme Construction",
  retailer: "Home Depot",
  store: STORES.homedepot[0],
  size: "Truck" as Size,
  fit: "3 lines · longest 8 ft — a car won't take it",
  lines: [
    { name: "7/16 in. OSB sheathing", qty: "8", total: "$95.92" },
    { name: "2×4×8 SPF stud", qty: "10", total: "$38.50" },
    { name: "16d framing nails, 1 lb", qty: "1", total: "$7.76" },
  ],
  materials: "$142.18",
  sizing: "$45.00",
  mileage: "$0.00",
  mileageNote: "2.4 mi — inside the 3 mi free band",
  total: "$187.18",
  confidence: "0.94",
  template: "Home Depot cart email · matched the last 38 carts",
  lastMismatch:
    "Last mismatch on this template: Aug 30 (a quantity, like this one)",
};

/** The one-pass lane: a clean order's quote, ready to send. */
export const CLEAN_QUOTES: Record<string, { size: Size; total: string }> = {
  "#1044": { size: "Truck", total: "$187.18" },
  "#1053": { size: "Truck", total: "$89.20" },
};

/** #1052 — the exception: the customer's store is nowhere near the site. */
export const EXCEPTION = {
  number: "#1052",
  company: "Bayside Builders",
  retailer: "Lowe's",
  store: STORES.lowes[2],
  nearest: STORES.lowes[0],
  site: { label: "Riverside Depot", address: "88 Depot Rd" },
  items: 6,
  size: "Truck" as Size,
  fit: "6 lines · longest 10 ft — needs a truck",
  materials: "$88.40",
  sizing: "$45.00",
  mileage: "$10.50",
  mileageNote: "7.2 mi − 3 mi free = 4.2 mi × $2.50",
  total: "$143.90",
};
