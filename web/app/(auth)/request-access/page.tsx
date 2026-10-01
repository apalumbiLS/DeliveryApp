import type { Metadata } from "next";
import Link from "next/link";

import { Card } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Request access",
};

/**
 * There is no self-signup: every account belongs to a company, and a company is
 * created by a dispatcher (ADR-0007). Until an in-app request path exists, this
 * page explains the process rather than pretending to collect a request.
 */
export default function RequestAccessPage() {
  return (
    <Card className="p-6">
      <h1 className="text-[17px] font-semibold tracking-tight text-ink">
        Request access
      </h1>

      <div className="mt-2 space-y-2 text-[12.5px] leading-relaxed text-ink-muted">
        <p>
          Portal accounts are set up by our dispatch team — there&apos;s no
          self-signup. Every account belongs to a company, and the company is
          created first.
        </p>
        <p>
          If your company already has a login, ask your dispatcher to add you.
          If your company is new to us, get in touch and we&apos;ll set it up.
        </p>
        <p>
          We hand over credentials out of band. Once you have them, sign in with
          your email address and password.
        </p>
      </div>

      <Link
        href="/login"
        className="mt-5 inline-block text-[12.5px] font-medium text-accent transition-colors hover:text-accent-hover"
      >
        ← Back to sign in
      </Link>
    </Card>
  );
}
