/**
 * A delivery photo, for the customer's order page.
 *
 * Photos live in the private `evidence` bucket, and signed URLs expire, so
 * every request signs a fresh one and redirects to it. Mirrors
 * `/dispatch/photo/[attachmentId]`, through the customer's RLS session: it
 * reaches only their own company's delivery photos, never a receipt. A missing
 * photo and a forbidden one both return 404.
 */

import { NextResponse } from "next/server";

import { requireCustomer } from "@/lib/portal/require-customer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Only has to outlive the redirect. */
const SIGNED_URL_SECONDS = 60;

const UUID = /^[0-9a-f-]{36}$/i;

export async function GET(
  _request: Request,
  context: RouteContext<"/portal/photo/[attachmentId]">,
) {
  const { attachmentId } = await context.params;
  if (!UUID.test(attachmentId)) {
    return new NextResponse(null, { status: 404 });
  }

  const { supabase } = await requireCustomer();

  const { data } = await supabase
    .from("attachments")
    .select("kind, storage_path")
    .eq("id", attachmentId)
    .maybeSingle();

  const row = data as { kind: string; storage_path: string | null } | null;
  if (!row?.storage_path || row.kind !== "delivery") {
    return new NextResponse(null, { status: 404 });
  }

  const { data: signed } = await supabase.storage
    .from("evidence")
    .createSignedUrl(row.storage_path, SIGNED_URL_SECONDS);
  if (!signed?.signedUrl) {
    return new NextResponse(null, { status: 404 });
  }

  const response = NextResponse.redirect(signed.signedUrl, 302);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
