/**
 * The original cart email, served for the review queue's iframe.
 *
 * Its own route rather than inline markup, because the body is untrusted
 * third-party HTML and this way it gets real headers — see
 * `lib/dispatch/email-html.ts` for the four layers around it.
 *
 * Authenticated: the caller must be a dispatcher, and the order must be one RLS
 * lets them see. A missing order and a forbidden one both return 404, so the
 * route does not confirm which orders exist.
 */

import { NextResponse } from "next/server";

import {
  EMAIL_CONTENT_SECURITY_POLICY,
  sanitizeEmailHtml,
} from "@/lib/dispatch/email-html";
import { requireDispatcher } from "@/lib/dispatch/require-dispatcher";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: RouteContext<"/dispatch/email/[orderId]">,
) {
  const { orderId } = await context.params;
  const { supabase } = await requireDispatcher();

  const { data: orderData } = await supabase
    .from("orders")
    .select("inbound_email_id")
    .eq("id", orderId)
    .maybeSingle();

  const inboundEmailId = (
    orderData as { inbound_email_id: string | null } | null
  )?.inbound_email_id;

  if (!inboundEmailId) {
    return new NextResponse(null, { status: 404 });
  }

  const { data: emailData } = await supabase
    .from("inbound_emails")
    .select("body_html")
    .eq("id", inboundEmailId)
    .maybeSingle();

  const html = (emailData as { body_html: string | null } | null)?.body_html;

  if (!html) {
    return new NextResponse(null, { status: 404 });
  }

  return new NextResponse(sanitizeEmailHtml(html), {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": EMAIL_CONTENT_SECURITY_POLICY,
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Cache-Control": "private, no-store",
    },
  });
}
