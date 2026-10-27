import type { ReactNode } from "react";

import { BrandLockup } from "@/components/ui/brand-lockup";

/**
 * The unauthenticated shell — one centred column on the muted surface.
 * Wraps /login and /request-access.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-full flex-1 flex-col items-center justify-center bg-card-muted px-5 py-10">
      <div className="w-full max-w-sm">
        <BrandLockup animated className="mb-6 justify-center" />
        {children}
      </div>
    </main>
  );
}
