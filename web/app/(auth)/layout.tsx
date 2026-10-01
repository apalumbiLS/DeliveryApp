import type { ReactNode } from "react";

import { APP_MARK, APP_NAME } from "@/lib/brand";

/**
 * The unauthenticated shell — one centred column on the muted surface.
 * Wraps /login and /request-access.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-full flex-1 flex-col items-center justify-center bg-card-muted px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-control bg-accent text-[13px] font-semibold text-accent-ink">
            {APP_MARK}
          </div>
          <span className="text-[15px] font-semibold text-ink">{APP_NAME}</span>
        </div>
        {children}
      </div>
    </main>
  );
}
