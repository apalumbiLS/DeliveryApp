import { SignOutButton } from "@/components/app/sign-out-button";
import { Card } from "@/components/ui/card";

/**
 * A signed-in user with nowhere to go.
 *
 * An inactive account, or one with no profile. Rendering a notice rather than
 * bouncing to /login avoids a redirect loop between the consoles.
 */
export function NotAvailable({ role }: { role: string }) {
  return (
    <main className="flex min-h-full flex-1 items-center justify-center bg-card-muted px-5 py-10">
      <Card className="w-full max-w-sm p-6">
        <h1 className="text-[18px] font-semibold tracking-tight text-ink">
          No console for this account
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-muted">
          You&apos;re signed in as <span className="font-medium">{role}</span>,
          but this account isn&apos;t active. Ask a dispatcher to check it.
        </p>
        <div className="mt-5">
          <SignOutButton label="Sign out" intent="secondary" size="md" />
        </div>
      </Card>
    </main>
  );
}
