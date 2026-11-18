import { notFound } from "next/navigation";

/**
 * `/mockups` and `/design` are working material for the team, not part of the
 * product. They stay visible locally and on Vercel preview deploys, and 404 on
 * the production deploy. `VERCEL_ENV` is set by Vercel itself.
 */
export function hideInProduction(): void {
  if (process.env.VERCEL_ENV === "production") notFound();
}
