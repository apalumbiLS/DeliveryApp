import { NextResponse } from "next/server";

import {
  EMAIL_CONTENT_SECURITY_POLICY,
  sanitizeEmailHtml,
} from "@/lib/dispatch/email-html";
import { requireDispatcher } from "@/lib/dispatch/require-dispatcher";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ inboundId: string }> };

export async function GET(_request: Request, context: Context) {
  const { inboundId } = await context.params;
  const { supabase } = await requireDispatcher();
  const { data } = await supabase
    .from("inbound_emails")
    .select("body_html, review_status")
    .eq("id", inboundId)
    .maybeSingle();
  const email = data as {
    body_html: string | null;
    review_status: string;
  } | null;
  if (!email?.body_html || email.review_status !== "pending") {
    return new NextResponse(null, { status: 404 });
  }
  return new NextResponse(sanitizeEmailHtml(email.body_html), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": EMAIL_CONTENT_SECURITY_POLICY,
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Cache-Control": "private, no-store",
    },
  });
}
