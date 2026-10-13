import type { Metadata } from "next";
import Link from "next/link";

import { button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chevron } from "@/components/ui/icons";
import { StatusDot } from "@/components/ui/status-dot";
import { sharedOrderAddress } from "@/lib/mailgun/config";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Home",
};

export default async function PortalHomePage() {
  const supabase = await createClient();

  // RLS scopes the orders query to the signed-in customer's company.
  const { data: orders } = await supabase
    .from("orders")
    .select("order_number")
    .eq("status", "awaiting_customer")
    .order("created_at", { ascending: false })
    .limit(1);

  const awaiting = orders?.[0];
  const orderAddress = sharedOrderAddress();

  return (
    <div className="space-y-3">
      <Card className="p-5">
        <h2 className="text-[17px] font-semibold tracking-tight text-ink">
          Send us your Lowe&apos;s cart
        </h2>
        {orderAddress ? (
          <>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-muted">
              Build a cart at Lowe&apos;s. Use Share Cart to send it to our
              shared pilot address. Don&apos;t buy it at Lowe&apos;s.
            </p>
            <p className="mt-3 rounded-field border border-hairline bg-card-muted px-3 py-2 font-mono text-[12px] break-all text-ink">
              {orderAddress}
            </p>
            <p className="mt-2 text-[12px] leading-relaxed text-ink-muted">
              Our dispatcher will confirm your company, review the items, and
              contact you for the job site, store, and price details.
            </p>
            <Link
              href="/portal/start"
              className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-medium text-accent hover:text-accent-hover"
            >
              Add site and store details first (optional)
              <Chevron className="h-3.5 w-3.5" />
            </Link>
          </>
        ) : (
          <p className="mt-2 text-[12.5px] leading-relaxed text-warning-ink">
            Cart intake is not ready. Contact the dispatcher before sharing. The
            old Gmail address does not reach this app.
          </p>
        )}
      </Card>

      {awaiting ? (
        <Link
          href="/portal/orders"
          className="flex items-center gap-3 rounded-card border border-hairline bg-accent-soft px-4 py-3.5 transition-colors hover:bg-accent-soft/70"
        >
          <StatusDot tone="warning" />
          <span className="flex-1 text-[13px] font-medium text-accent-soft-ink">
            Order {awaiting.order_number} needs dispatcher follow-up; no
            checkout email has been sent
          </span>
          <Chevron className="h-4 w-4 text-accent-soft-ink/70" />
        </Link>
      ) : null}

      <Link
        href="/portal/orders"
        className={cn(
          button({ intent: "secondary", size: "md" }),
          "flex w-full justify-between",
        )}
      >
        See past orders
        <Chevron className="h-4 w-4 text-ink-faint" />
      </Link>
    </div>
  );
}
