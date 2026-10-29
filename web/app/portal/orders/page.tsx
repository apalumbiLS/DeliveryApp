import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { List, ListItem } from "@/components/ui/list";
import { PageHeader } from "@/components/ui/page-header";
import { StatusDot } from "@/components/ui/status-dot";
import { portalStatusLabel } from "@/lib/portal/order";
import { isRetailerId, RETAILERS } from "@/lib/retailers";
import { createClient } from "@/lib/supabase/server";
import { orderStatusTone, type OrderStatus } from "@/lib/tokens";

export const metadata: Metadata = {
  title: "Orders",
};

type OrderRow = {
  id: string;
  order_number: string;
  status: OrderStatus;
  retailer: string;
  total_cents: number;
  created_at: string;
};

function retailerLabel(retailer: string) {
  return isRetailerId(retailer) ? RETAILERS[retailer].label : retailer;
}

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const shortDate = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });

export default async function PortalOrdersPage() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("orders")
    .select("id, order_number, status, retailer, total_cents, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  const orders = (data ?? []) as unknown as OrderRow[];

  return (
    <div>
      <PageHeader
        title="Orders"
        description="Everything your company has ordered."
      />

      {error ? (
        <p className="mt-5 rounded-field bg-danger-bg px-3 py-2 text-[12.5px] leading-relaxed text-danger-ink">
          Could not read orders: {error.message}
        </p>
      ) : orders.length === 0 ? (
        <Card className="mt-5 p-6">
          <h2 className="text-[13px] font-medium text-ink">No orders yet</h2>
          <p className="mt-1 text-[12.5px] leading-relaxed text-ink-muted">
            Send your first cart and it&apos;ll show up here.
          </p>
        </Card>
      ) : (
        <List className="mt-5">
          {orders.map((order) => (
            <ListItem key={order.id} className="p-0">
              <Link
                href={`/portal/orders/${order.id}`}
                className="flex flex-1 items-center gap-3 px-4 py-3 transition-colors hover:bg-card-muted"
              >
                <StatusDot tone={orderStatusTone[order.status]} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[13px] font-medium text-ink tabular-nums">
                      {order.order_number}
                    </span>
                    <Badge tone={orderStatusTone[order.status]} bordered>
                      {portalStatusLabel(order.status)}
                    </Badge>
                  </div>
                  <div className="mt-0.5 text-[12px] text-ink-faint">
                    {retailerLabel(order.retailer)} ·{" "}
                    {shortDate.format(new Date(order.created_at))}
                  </div>
                </div>
                <span className="text-[13px] font-semibold text-ink tabular-nums">
                  {order.total_cents > 0
                    ? money.format(order.total_cents / 100)
                    : "Not priced"}
                </span>
              </Link>
            </ListItem>
          ))}
        </List>
      )}
    </div>
  );
}
