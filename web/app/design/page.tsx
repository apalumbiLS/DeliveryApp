import type { Metadata } from "next";
import type { ReactNode } from "react";

import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button, type ButtonIntent } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Chevron, CopyIcon } from "@/components/ui/icons";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { List, ListItem } from "@/components/ui/list";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { StatusDot } from "@/components/ui/status-dot";
import { cn } from "@/lib/utils";
import {
  orderStatusLabel,
  orderStatusTone,
  TONES,
  type OrderStatus,
  type Tone,
} from "@/lib/tokens";

export const metadata: Metadata = {
  title: "Design — tokens & components",
};

const SURFACES = [
  { name: "bg-surface", className: "bg-surface" },
  { name: "bg-card", className: "bg-card" },
  { name: "bg-card-muted", className: "bg-card-muted" },
  { name: "bg-sunken", className: "bg-sunken" },
] as const;

const TEXT = [
  { name: "text-ink", className: "text-ink" },
  { name: "text-ink-muted", className: "text-ink-muted" },
  { name: "text-ink-faint", className: "text-ink-faint" },
] as const;

const ACCENT = [
  { name: "bg-accent", className: "bg-accent" },
  { name: "bg-accent-hover", className: "bg-accent-hover" },
  { name: "bg-accent-soft", className: "bg-accent-soft" },
  { name: "bg-accent-ink", className: "bg-accent-ink" },
] as const;

const RADII = [
  { name: "rounded-control", className: "rounded-control" },
  { name: "rounded-field", className: "rounded-field" },
  { name: "rounded-card", className: "rounded-card" },
] as const;

const TONE_CLASSES: Record<Tone, { solid: string; bg: string; ink: string }> = {
  success: {
    solid: "bg-success",
    bg: "bg-success-bg",
    ink: "text-success-ink",
  },
  warning: {
    solid: "bg-warning",
    bg: "bg-warning-bg",
    ink: "text-warning-ink",
  },
  info: { solid: "bg-info", bg: "bg-info-bg", ink: "text-info-ink" },
  danger: { solid: "bg-danger", bg: "bg-danger-bg", ink: "text-danger-ink" },
  neutral: {
    solid: "bg-neutral",
    bg: "bg-neutral-bg",
    ink: "text-neutral-ink",
  },
};

const INTENTS: ButtonIntent[] = ["primary", "secondary", "neutral", "ghost"];

const ORDER_STATUSES = Object.keys(orderStatusTone) as OrderStatus[];

const LIST_ROWS: { id: string; status: OrderStatus; total: string }[] = [
  { id: "#1042", status: "delivered", total: "$482.80" },
  { id: "#1039", status: "awaiting_customer", total: "$120.10" },
  { id: "#1036", status: "en_route", total: "$212.45" },
];

const ICONS: {
  name: string;
  Icon: (props: { className?: string }) => ReactNode;
}[] = [
  { name: "CopyIcon", Icon: CopyIcon },
  { name: "Chevron", Icon: Chevron },
];

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <section className="py-6">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-[12px] font-semibold tracking-[0.14em] text-ink-muted uppercase">
          {title}
        </h2>
        {note ? <p className="text-[12px] text-ink-faint">{note}</p> : null}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Swatch({ name, className }: { name: string; className: string }) {
  return (
    <div className="w-32">
      <div
        className={cn("h-12 rounded-control border border-hairline", className)}
      />
      <div className="mt-1.5 font-mono text-[11px] text-ink-muted">{name}</div>
    </div>
  );
}

export default function DesignPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[17px] font-semibold">
            Design tokens & components
          </h1>
          <p className="mt-1 text-[13px] text-ink-muted">
            Roles live in{" "}
            <code className="font-mono text-[12px]">app/styles/theme.css</code>;
            components use semantic roles only.
          </p>
        </div>
        <ThemeToggle />
      </div>

      <div className="mt-4 divide-y divide-hairline-soft">
        <Section title="Surfaces">
          <div className="flex flex-wrap gap-3">
            {SURFACES.map((s) => (
              <Swatch key={s.name} name={s.name} className={s.className} />
            ))}
          </div>
        </Section>

        <Section title="Text">
          <div className="space-y-2">
            {TEXT.map((t) => (
              <div key={t.name} className="flex items-baseline gap-4">
                <span className="w-32 font-mono text-[11px] text-ink-muted">
                  {t.name}
                </span>
                <span className={cn("text-[15px] font-medium", t.className)}>
                  Materials, delivered.
                </span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Accent" note="buttons, links, brand marks">
          <div className="flex flex-wrap gap-3">
            {ACCENT.map((a) => (
              <Swatch key={a.name} name={a.name} className={a.className} />
            ))}
          </div>
        </Section>

        <Section
          title="Status tones"
          note="solid · tint · text on tint — order statuses map to these in lib/tokens.ts"
        >
          <div className="space-y-3">
            {TONES.map((tone) => (
              <div key={tone} className="flex flex-wrap items-center gap-3">
                <span className="w-20 font-mono text-[11px] text-ink-muted">
                  {tone}
                </span>
                <div
                  className={cn(
                    "h-8 w-14 rounded-control border border-hairline",
                    TONE_CLASSES[tone].solid,
                  )}
                />
                <div
                  className={cn(
                    "h-8 w-14 rounded-control border border-hairline",
                    TONE_CLASSES[tone].bg,
                  )}
                />
                <div
                  className={cn(
                    "flex h-8 w-14 items-center justify-center rounded-control border border-hairline bg-card",
                    TONE_CLASSES[tone].ink,
                  )}
                >
                  <span className="text-[12px] font-medium">Aa</span>
                </div>
                <Badge tone={tone}>{tone}</Badge>
                <StatusDot tone={tone} />
              </div>
            ))}
          </div>
        </Section>

        <Section title="Shape" note="radii · card shadow">
          <div className="flex flex-wrap items-end gap-3">
            {RADII.map((r) => (
              <div key={r.name} className="w-32">
                <div
                  className={cn(
                    "h-16 border border-hairline bg-card-muted shadow-card",
                    r.className,
                  )}
                />
                <div className="mt-1.5 font-mono text-[11px] text-ink-muted">
                  {r.name}
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section
          title="Card"
          note="surface · hairline · shadow-card — the treatment lists share"
        >
          <div className="flex flex-wrap gap-4">
            <Card className="w-60 p-4">
              <div className="text-[13px] font-semibold">Default card</div>
              <p className="mt-1 text-[12px] text-ink-muted">
                White surface, for primary content.
              </p>
            </Card>
            <Card tone="muted" className="w-60 p-4">
              <div className="text-[13px] font-semibold">Muted card</div>
              <p className="mt-1 text-[12px] text-ink-muted">
                For secondary panels, like Start an order.
              </p>
            </Card>
          </div>
        </Section>

        <Section title="List" note="divided rows on the card surface">
          <List className="max-w-md">
            {LIST_ROWS.map((row) => (
              <ListItem key={row.id}>
                <StatusDot tone={orderStatusTone[row.status]} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-medium">{row.id}</span>
                    <Badge tone={orderStatusTone[row.status]}>
                      {orderStatusLabel[row.status]}
                    </Badge>
                  </div>
                </div>
                <span className="text-[13px] font-semibold tabular-nums">
                  {row.total}
                </span>
              </ListItem>
            ))}
          </List>
        </Section>

        <Section title="Badge">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-20 font-mono text-[11px] text-ink-muted">
                default
              </span>
              {TONES.map((tone) => (
                <Badge key={tone} tone={tone}>
                  {tone}
                </Badge>
              ))}
              <Badge tone="accent">accent</Badge>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-20 font-mono text-[11px] text-ink-muted">
                bordered
              </span>
              {TONES.map((tone) => (
                <Badge key={tone} tone={tone} bordered>
                  {tone}
                </Badge>
              ))}
              <Badge tone="accent" bordered>
                accent
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-20 font-mono text-[11px] text-ink-muted">
                sizes
              </span>
              <Badge size="sm" tone="neutral" bordered>
                sm
              </Badge>
              <Badge size="md" tone="neutral" bordered>
                md
              </Badge>
            </div>
          </div>
        </Section>

        <Section
          title="Order statuses"
          note="every domain state, via orderStatusTone / orderStatusLabel"
        >
          <div className="flex flex-wrap items-center gap-2">
            {ORDER_STATUSES.map((status) => (
              <Badge key={status} tone={orderStatusTone[status]} bordered>
                {orderStatusLabel[status]}
              </Badge>
            ))}
          </div>
        </Section>

        <Section title="Button">
          <div className="flex flex-wrap items-center gap-2">
            {INTENTS.map((intent) => (
              <Button key={intent} intent={intent}>
                {intent}
              </Button>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button intent="secondary" size="md">
              <CopyIcon className="h-4 w-4" />
              Copy address
            </Button>
            <Button intent="ghost" size="md" disabled>
              Disabled
            </Button>
          </div>
        </Section>

        <Section
          title="Form controls"
          note="label · input · select · field with hint and error"
        >
          <div className="max-w-sm space-y-5">
            <Field
              id="design-email"
              label="Email"
              hint="We'll never share this."
            >
              {(control) => (
                <Input
                  {...control}
                  type="email"
                  placeholder="you@company.com"
                />
              )}
            </Field>

            <Field
              id="design-password"
              label="Password"
              error="That password is too short."
            >
              {(control) => (
                <Input {...control} type="password" placeholder="••••••••" />
              )}
            </Field>

            <div className="space-y-1.5">
              <Label htmlFor="design-plain">Plain input</Label>
              <Input id="design-plain" placeholder="Default" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="design-select">Select</Label>
              <Select id="design-select" defaultValue="customer">
                <option value="dispatcher">Dispatcher</option>
                <option value="driver">Driver</option>
                <option value="customer">Customer</option>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="design-disabled">Disabled</Label>
              <Input id="design-disabled" disabled placeholder="Not editable" />
            </div>
          </div>
        </Section>

        <Section title="Page header" note="title · description · actions">
          <Card className="p-5">
            <PageHeader
              title="Orders"
              description="Everything your company has ordered."
              actions={<Button size="sm">New order</Button>}
            />
          </Card>
        </Section>

        <Section title="StatusDot">
          <div className="flex flex-wrap items-center gap-4">
            {TONES.map((tone) => (
              <div key={tone} className="flex items-center gap-2">
                <StatusDot tone={tone} />
                <span className="font-mono text-[11px] text-ink-muted">
                  {tone}
                </span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Icons" note="stroke icons · inherit currentColor">
          <div className="space-y-4">
            {ICONS.map(({ name, Icon }) => (
              <div key={name} className="flex items-center gap-4">
                <Icon className="h-5 w-5 text-ink" />
                <span className="w-24 font-mono text-[11px] text-ink-muted">
                  {name}
                </span>
                <div className="flex items-center gap-3 text-ink-faint">
                  <Icon className="h-3.5 w-3.5" />
                  <Icon className="h-4 w-4" />
                  <Icon className="h-5 w-5" />
                </div>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </main>
  );
}
