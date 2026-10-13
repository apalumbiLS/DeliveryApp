import Link from "next/link";
import { notFound } from "next/navigation";

import { InboundExceptionList } from "@/components/console/inbound-exception-list";
import { Button } from "@/components/ui/button";
import {
  approveInboundEmail,
  dismissInboundEmail,
} from "@/lib/dispatch/actions";
import {
  listInboundExceptions,
  loadInboundIntentPreview,
} from "@/lib/dispatch/review-queue";
import { requireDispatcher } from "@/lib/dispatch/require-dispatcher";
import { ParsedCartSchema } from "@/lib/parsers";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ inboundId: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function InboundReviewPage({
  params,
  searchParams,
}: Props) {
  const { inboundId } = await params;
  const { error: actionError } = await searchParams;
  const { supabase } = await requireDispatcher();
  const [
    { data: rawEmail },
    { data: rawAttempt },
    { data: rawCompanies },
    exceptions,
  ] = await Promise.all([
    supabase
      .from("inbound_emails")
      .select(
        "id, company_id, recipient, sender_email, subject, review_reason, review_status, order_id",
      )
      .eq("id", inboundId)
      .maybeSingle(),
    supabase
      .from("parse_attempts")
      .select("succeeded, output, errors")
      .eq("inbound_email_id", inboundId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("companies")
      .select("id, name")
      .eq("active", true)
      .order("name"),
    listInboundExceptions(supabase),
  ]);

  const email = rawEmail as {
    company_id: string | null;
    recipient: string;
    sender_email: string;
    subject: string | null;
    review_reason: string | null;
    review_status: string;
    order_id: string | null;
  } | null;
  if (!email || email.review_status !== "pending" || email.order_id) notFound();

  const attempt = rawAttempt as {
    succeeded: boolean;
    output: unknown;
    errors: { reason?: string } | null;
  } | null;
  const parsed = ParsedCartSchema.safeParse(attempt?.output);
  const cart =
    attempt?.succeeded && parsed.success && parsed.data.retailer === "lowes"
      ? parsed.data
      : null;
  const companies = (rawCompanies ?? []) as { id: string; name: string }[];
  const intent = await loadInboundIntentPreview(
    supabase,
    email.recipient,
    process.env.ORDER_ALIAS_DOMAIN,
  );
  const companyId = email.company_id ?? intent?.companyId ?? null;
  const intentMismatch = Boolean(
    email.company_id && intent && intent.companyId !== email.company_id,
  );
  const companyName = companies.find(
    (company) => company.id === companyId,
  )?.name;

  return (
    <div className="flex min-h-full">
      <aside className="w-60 shrink-0 border-r border-hairline-soft">
        <Link
          href="/dispatch/review"
          className="block px-4 py-3 text-[12px] text-accent"
        >
          Back to review queue
        </Link>
        <InboundExceptionList entries={exceptions} selectedId={inboundId} />
      </aside>
      <main className="min-w-0 flex-1 space-y-4 p-5">
        <div>
          <h1 className="text-[17px] font-semibold text-ink">
            Inbound cart review
          </h1>
          <p className="mt-1 text-[12px] text-ink-muted">
            No order has been created. Confirm the sender and company before
            approving.
          </p>
        </div>
        <div className="rounded-card border border-hairline bg-card p-4 text-[12px]">
          <p>From: {email.sender_email}</p>
          <p>To: {email.recipient}</p>
          <p>Subject: {email.subject ?? "(none)"}</p>
          <p>
            Matched company: {companyName ?? "Unattributed — confirm below"}
          </p>
          {intentMismatch ? (
            <p className="text-danger-ink">
              Token and inbound company disagree. Do not approve.
            </p>
          ) : null}
          {cart?.requesterEmail ? (
            <p>Cart requester (unverified): {cart.requesterEmail}</p>
          ) : null}
          {intent?.eligible ? (
            <p>
              Portal intent: {intent.site ?? intent.address ?? "Site not named"}
              {" · "}Lowe&apos;s store: {intent.store ?? "Store unavailable"}
            </p>
          ) : intent ? (
            <p>
              This one-use address has already been used; no site or store will
              be reused.
            </p>
          ) : null}
          <p className="mt-2 font-medium text-warning-ink">
            {email.review_reason ?? "Awaiting processing"}
          </p>
          {actionError ? (
            <p role="alert" className="mt-2 text-danger-ink">
              The action failed. This message is still awaiting review.
            </p>
          ) : null}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <iframe
            src={`/dispatch/review/inbound/${inboundId}/email`}
            sandbox=""
            title="Original incoming cart email"
            className="h-96 w-full rounded-card border border-hairline bg-white"
          />
          <div className="rounded-card border border-hairline bg-card p-4">
            <h2 className="text-[13px] font-semibold text-ink">
              Provisional items
            </h2>
            {cart ? (
              <ul className="mt-2 space-y-2 text-[12px] text-ink">
                {cart.items.map((item) => (
                  <li key={item.storeSku}>
                    {item.quantity} × {item.description} · Item #{item.storeSku}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-[12px] text-danger-ink">
                Items could not be validated. Request another cart before
                approval.
                {attempt?.errors?.reason ? ` ${attempt.errors.reason}` : ""}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <form action={approveInboundEmail} className="flex items-end gap-2">
            <input type="hidden" name="inboundId" value={inboundId} />
            {companyId ? (
              <input type="hidden" name="companyId" value={companyId} />
            ) : (
              <label className="text-[12px] text-ink">
                Confirm company
                <select
                  name="companyId"
                  required
                  className="ml-2 rounded-control border border-hairline bg-card p-2"
                >
                  <option value="">Choose company</option>
                  {companies.map((company) => (
                    <option value={company.id} key={company.id}>
                      {company.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <Button
              type="submit"
              disabled={
                !cart ||
                intentMismatch ||
                (!companyId && companies.length === 0)
              }
            >
              Approve and create order
            </Button>
          </form>
          <form action={dismissInboundEmail}>
            <input type="hidden" name="inboundId" value={inboundId} />
            <Button type="submit" intent="secondary">
              Dismiss without an order
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
}
