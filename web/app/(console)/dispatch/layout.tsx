import type { ReactNode } from "react";

import { ConsoleHeader } from "@/components/console/console-shell";
import { getQueueCount } from "@/lib/dispatch/queue-count";

/**
 * The review queue's header. The guard and sidebar are in
 * `app/(console)/layout.tsx`.
 */
export default async function DispatchLayout(props: LayoutProps<"/dispatch">) {
  const waiting = await getQueueCount();

  return (
    <>
      <ConsoleHeader
        title="Review queue"
        note={
          waiting === 0
            ? "Nothing waiting."
            : `${waiting} waiting · every order is verified here before the invite goes out`
        }
      />
      <div className="flex-1 overflow-y-auto">
        {props.children as ReactNode}
      </div>
    </>
  );
}
