import type { Metadata } from "next";
import type { ComponentType } from "react";
import Link from "next/link";

import { ThemeToggle } from "@/components/theme-toggle";

import { ExceptionBoard } from "./dispatch/review-exceptions";
import { GuidedReview } from "./dispatch/review-guided";
import { ReviewQueue } from "./dispatch/review-queue";
import { JobBoard } from "./driver/board";
import { JobDetail, ReceiptPrompt } from "./driver/job";
import { CleanSaas } from "./orders/clean-saas";
import { ApprovalEmail } from "./start/email";
import { StartOrderFlow } from "./start/flow";
import { HomeScreen } from "./start/home";
import { LoginScreen } from "./start/login";

export const metadata: Metadata = {
  title: "Mockups — all screens",
};

type Screen = {
  name: string;
  note: string;
  href?: string;
  Component?: ComponentType;
};

type Shape = "phone" | "desktop" | "console";

type Group = {
  id: string;
  title: string;
  note: string;
  shape: Shape;
  screens: Screen[];
};

/** Frame width per surface — the same widths the directions pages use. */
const WIDTH: Record<Shape, string> = {
  phone: "w-97.5",
  desktop: "w-160",
  console: "w-280",
};

const GROUPS: Group[] = [
  {
    id: "portal",
    title: "Customer portal",
    note: "Mobile 390 wide · the surface the client has reviewed",
    shape: "phone",
    screens: [
      {
        name: "Login",
        note: "One login per company — email + password. Built and live at /login.",
        href: "/login",
        Component: LoginScreen,
      },
      {
        name: "Home",
        note: "Start an order + see past orders. One line appears only when an approval is waiting.",
        href: "/mockups/start",
        Component: HomeScreen,
      },
      {
        name: "Orders list",
        note: "The approved Clean SaaS direction, on design tokens. Repaints with the theme switcher.",
        href: "/mockups/orders",
        Component: CleanSaas,
      },
      {
        name: "Start an order",
        note: "Where's it going → retailer → store → check your store → build & share. Both retailers open their store page, from the seeded store record.",
        href: "/mockups/start",
        Component: StartOrderFlow,
      },
      {
        name: "Email · cart ready",
        note: "The checkout invite — order summary, one CTA to the order page, and a call-us line.",
        href: "/mockups/start",
        Component: ApprovalEmail,
      },
      {
        name: "Order detail",
        note: "Status timeline, delivery info, items, price, status-driven CTA — and the review & approve state for a forwarded cart.",
        href: "/mockups/orders/detail",
      },
    ],
  },
  {
    id: "dispatch",
    title: "Dispatcher console",
    note: "Desktop 1120 · review queue, three directions",
    shape: "console",
    screens: [
      {
        name: "Review queue · checklist",
        note: "Every order waits here. Items vs the email, the address, the store and its distance, the size, the fees — and the gate that blocks the invite.",
        href: "/mockups/dispatch",
        Component: ReviewQueue,
      },
      {
        name: "Review queue · guided",
        note: "One order at a time, priced from a rate card, with the invite the customer will see rendered before you send it.",
        href: "/mockups/dispatch",
        Component: GuidedReview,
      },
      {
        name: "Review queue · exceptions",
        note: "Sorted by risk: exceptions get the full treatment, clean orders get a one-pass lane. Store 7.2 mi out, with the switch decision.",
        href: "/mockups/dispatch",
        Component: ExceptionBoard,
      },
    ],
  },
  {
    id: "driver",
    title: "Driver app",
    note: "Mobile PWA · first-accept-wins",
    shape: "phone",
    screens: [
      {
        name: "Job board",
        note: "Open postings with store, item count, and fee. The address stays hidden until accept.",
        href: "/mockups/driver",
        Component: JobBoard,
      },
      {
        name: "Job detail",
        note: "Accepted: the buy list, the drop-off that just unlocked, and the status ladder.",
        href: "/mockups/driver",
        Component: JobDetail,
      },
      {
        name: "Photos",
        note: "Receipt and delivery prompts — skippable with a reason the dispatcher sees.",
        href: "/mockups/driver",
        Component: ReceiptPrompt,
      },
    ],
  },
];

function Frame({ screen, shape }: { screen: Screen; shape: Shape }) {
  if (screen.Component) {
    const ScreenComponent = screen.Component;
    return shape === "console" ? (
      <div className="h-160 overflow-hidden rounded-2xl border border-zinc-800 bg-white shadow-2xl">
        <ScreenComponent />
      </div>
    ) : (
      <div className="h-158.25 overflow-hidden rounded-4xl border border-zinc-800 bg-white shadow-2xl">
        <div data-frame-scroll className="h-full overflow-y-auto">
          <ScreenComponent />
        </div>
      </div>
    );
  }

  return (
    <div
      className={
        shape === "phone"
          ? "flex h-158.25 items-center justify-center rounded-4xl border border-zinc-800 bg-zinc-900/60"
          : "flex h-100 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900/60"
      }
    >
      <span className="text-[12px] tracking-[0.12em] text-zinc-600 uppercase">
        Not started
      </span>
    </div>
  );
}

export default function MockupsPage() {
  return (
    <main className="min-h-screen bg-[#111113] px-8 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[15px] font-medium text-zinc-200">All screens</h1>
          <p className="mt-1 max-w-xl text-[13px] text-zinc-500">
            Every screen in the MVP. Designed screens are live; the rest are
            placeholders until we get to them.
          </p>
        </div>
        <ThemeToggle />
      </div>

      {GROUPS.map((group) => (
        <section key={group.id} id={group.id} className="mt-12 scroll-mt-6">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className="text-[13px] font-semibold tracking-[0.14em] text-zinc-300 uppercase">
              {group.title}
            </h2>
            <p className="text-[12px] text-zinc-500">{group.note}</p>
          </div>

          <div className="mt-5 flex flex-wrap gap-8">
            {group.screens.map((screen) => (
              <div key={screen.name} className={WIDTH[group.shape]}>
                <div className="mb-3 flex items-baseline justify-between gap-3">
                  <span className="text-[13px] font-medium text-zinc-200">
                    {screen.name}
                  </span>
                  {screen.href ? (
                    <Link
                      href={screen.href}
                      className="text-[11px] tracking-[0.12em] text-zinc-500 uppercase transition-colors hover:text-zinc-300"
                    >
                      Directions →
                    </Link>
                  ) : null}
                </div>
                <Frame screen={screen} shape={group.shape} />
                <p className="mt-3 text-[12px] leading-relaxed text-zinc-500">
                  {screen.note}
                </p>
              </div>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
