"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";

type DeliveryEditState = { open: boolean; toggle: () => void };

const DeliveryEditContext = createContext<DeliveryEditState | null>(null);

function useDeliveryEdit(): DeliveryEditState {
  const state = useContext(DeliveryEditContext);
  if (!state)
    throw new Error("Delivery edit parts must be inside the provider");
  return state;
}

/**
 * The delivery address is read-only until the dispatcher asks to edit it.
 *
 * The toggle sits on the summary card and the fields sit below the band's
 * columns, so the open state is shared through context rather than owned by
 * either one.
 */
export function DeliveryEditProvider({
  defaultOpen,
  children,
}: {
  /** True when the address or contact is missing, so there is nothing to protect. */
  defaultOpen: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <DeliveryEditContext.Provider
      value={{ open, toggle: () => setOpen((current) => !current) }}
    >
      {children}
    </DeliveryEditContext.Provider>
  );
}

export function DeliveryEditToggle() {
  const { open, toggle } = useDeliveryEdit();
  return (
    <Button
      intent="ghost"
      size="sm"
      onClick={toggle}
      aria-expanded={open}
      aria-controls="delivery-edit"
      className="-my-1 px-1.5 py-0.5"
    >
      {open ? "Close" : "Edit"}
    </Button>
  );
}

/**
 * Hidden rather than unmounted, so closing it does not discard edits that have
 * not been saved yet.
 */
export function DeliveryEditPanel({ children }: { children: ReactNode }) {
  const { open } = useDeliveryEdit();
  return (
    <div id="delivery-edit" hidden={!open}>
      {children}
    </div>
  );
}
