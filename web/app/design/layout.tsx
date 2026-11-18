import type { ReactNode } from "react";

import { hideInProduction } from "@/lib/internal-pages";

export default function InternalLayout({ children }: { children: ReactNode }) {
  hideInProduction();
  return children;
}
