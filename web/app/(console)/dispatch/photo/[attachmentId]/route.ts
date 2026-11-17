/**
 * A driver's receipt or delivery photo, for the review page.
 *
 * Photos live in the private `evidence` bucket, and signed URLs expire. The
 * page links here instead of to a signed URL, and every request signs a fresh
 * one and redirects to it, so a page left open never shows a dead photo.
 *
 * Authenticated: the caller must be a dispatcher, and the attachment one RLS
 * lets them see. A missing photo and a forbidden one both return 404.
 */

import { NextResponse } from "next/server";

import { requireDispatcher } from "@/lib/dispatch/require-dispatcher";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Only has to outlive the redirect. */
const SIGNED_URL_SECONDS = 60;

const UUID = /^[0-9a-f-]{36}$/i;

export async function GET(
  _request: Request,
  context: RouteContext<"/dispatch/photo/[attachmentId]">,
) {
  const { attachmentId } = await context.params;
  if (!UUID.test(attachmentId)) {
    return new NextResponse(null, { status: 404 });
  }

  const { supabase } = await requireDispatcher();

  const { data } = await supabase
    .from("attachments")
    .select("storage_path")
    .eq("id", attachmentId)
    .maybeSingle();

  const path = (data as { storage_path: string | null } | null)?.storage_path;
  if (!path) {
    return new NextResponse(null, { status: 404 });
  }

  const { data: signed } = await supabase.storage
    .from("evidence")
    .createSignedUrl(path, SIGNED_URL_SECONDS);
  if (!signed?.signedUrl) {
    return new NextResponse(null, { status: 404 });
  }

  const response = NextResponse.redirect(signed.signedUrl, 302);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
