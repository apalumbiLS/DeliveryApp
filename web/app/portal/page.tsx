import type { Metadata } from "next";
import Link from "next/link";

import { button } from "@/components/ui/button";
import { Chevron } from "@/components/ui/icons";
import { StatusDot } from "@/components/ui/status-dot";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Home",
};

export default async function PortalHomePage() {
  const supabase = await createClient();

  // RLS scopes this to the signed-in customer's company.
  const { data } = await supabase
    .from("orders")
    .select("order_number")
    .eq("status", "awaiting_customer")
    .order("created_at", { ascending: false })
    .limit(1);

  const awaiting = (data ?? [])[0] as { order_number: string } | undefined;

  return (
    <div className="space-y-3">
      <Link
        href="/portal/start"
        className="block rounded-card border border-hairline bg-card p-5 shadow-card transition-colors hover:bg-card-muted"
      >
        <div className="flex items-center justify-between gap-3">
          <span className="text-[17px] font-semibold tracking-tight text-ink">
            Start an order
          </span>
          <Chevron className="h-4 w-4 text-ink-faint" />
        </div>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-muted">
          We buy the materials and deliver them to your site.
        </p>
      </Link>

      {awaiting ? (
        <Link
          href="/portal/orders"
          className="flex items-center gap-3 rounded-card border border-hairline bg-accent-soft px-4 py-3.5 transition-colors hover:bg-accent-soft/70"
        >
          <StatusDot tone="warning" />
          <span className="flex-1 text-[13px] font-medium text-accent-soft-ink">
            Order {awaiting.order_number} is waiting for your approval
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
