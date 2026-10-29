import type { Metadata } from "next";
import Link from "next/link";

import { button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chevron } from "@/components/ui/icons";
import { StatusDot } from "@/components/ui/status-dot";
import { StepList } from "@/components/ui/step-list";
import { sharedOrderAddress } from "@/lib/mailgun/config";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Home",
};

const STEPS = [
  "Pick a job site and store",
  "Build a cart at Home Depot or Lowe's",
  "Send us the cart — don't check out",
];

export default async function PortalHomePage() {
  const supabase = await createClient();

  // RLS scopes the orders query to the signed-in customer's company.
  const { data: orders } = await supabase
    .from("orders")
    .select("id, order_number")
    .eq("status", "awaiting_customer")
    .order("created_at", { ascending: false })
    .limit(1);

  const awaiting = orders?.[0];
  const orderAddress = sharedOrderAddress();

  return (
    <div className="space-y-3">
      <Card className="border-accent/30 bg-accent-soft/40 p-5">
        {orderAddress ? (
          <>
            <Link
              href="/portal/start"
              className={cn(
                button({ intent: "primary", size: "lg" }),
                "flex w-full justify-between sm:w-auto",
              )}
            >
              Start an order
              <Chevron className="h-4.5 w-4.5" />
            </Link>
            <p className="mt-5 text-[10.5px] font-semibold tracking-widest text-ink-faint uppercase">
              How it works
            </p>
            <StepList steps={STEPS} tone="muted" className="mt-2.5" />
          </>
        ) : (
          <p className="text-[12.5px] leading-relaxed text-warning-ink">
            Cart intake is not ready. Contact the dispatcher before sharing. The
            old Gmail address does not reach this app.
          </p>
        )}
      </Card>

      {awaiting ? (
        <Link
          href={`/portal/orders/${awaiting.id}`}
          className="flex items-center gap-3 rounded-card border border-hairline bg-accent-soft px-4 py-3.5 transition-colors hover:bg-accent-soft/70"
        >
          <StatusDot tone="warning" />
          <span className="flex-1 text-[13px] font-medium text-accent-soft-ink">
            Order {awaiting.order_number} is ready to approve
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
