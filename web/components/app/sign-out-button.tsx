"use client";

import { useFormStatus } from "react-dom";

import { signOut } from "@/app/actions/auth";
import {
  Button,
  type ButtonIntent,
  type ButtonSize,
} from "@/components/ui/button";

function Submit({
  label,
  intent,
  size,
}: {
  label: string;
  intent: ButtonIntent;
  size: ButtonSize;
}) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" intent={intent} size={size} disabled={pending}>
      {pending ? "Signing out…" : label}
    </Button>
  );
}

/** Sign-out is a mutation, so it is a form posting to a server action. */
export function SignOutButton({
  label = "Sign out",
  intent = "ghost",
  size = "sm",
}: {
  label?: string;
  intent?: ButtonIntent;
  size?: ButtonSize;
}) {
  return (
    <form action={signOut}>
      <Submit label={label} intent={intent} size={size} />
    </form>
  );
}
