import { SignOutButton } from "@/components/app/sign-out-button";
import { Card } from "@/components/ui/card";

/**
 * A signed-in user whose role has no surface yet.
 *
 * Rendering a notice rather than bouncing to /login avoids a redirect loop
 * between the two consoles while the driver app does not exist.
 */
export function NotAvailable({ role }: { role: string }) {
  return (
    <main className="flex min-h-full flex-1 items-center justify-center bg-card-muted px-5 py-10">
      <Card className="w-full max-w-sm p-6">
        <h1 className="text-[17px] font-semibold tracking-tight text-ink">
          No console for this account
        </h1>
        <p className="mt-2 text-[12.5px] leading-relaxed text-ink-muted">
          You&apos;re signed in as <span className="font-medium">{role}</span>.
          The customer portal and the admin console are the only surfaces built
          so far — the driver app is still to come.
        </p>
        <div className="mt-5">
          <SignOutButton label="Sign out" intent="secondary" size="md" />
        </div>
      </Card>
    </main>
  );
}
