"use client";

import type { ComponentProps, ReactNode } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";

/**
 * A form's submit button that disables itself while the form's action runs,
 * so a second click cannot send it twice.
 */
export function SubmitButton({
  pendingLabel,
  disabled,
  children,
  ...props
}: Omit<ComponentProps<typeof Button>, "type"> & {
  /** Shown while the action runs. */
  pendingLabel: ReactNode;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={disabled || pending} {...props}>
      {pending ? pendingLabel : children}
    </Button>
  );
}
