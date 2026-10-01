"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

import { signIn, type LoginState } from "@/app/actions/auth";

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(
    signIn,
    undefined,
  );

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next ?? ""} />

      <Field id="email" label="Email">
        {(control) => (
          <Input
            {...control}
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            autoFocus
            required
          />
        )}
      </Field>

      <Field id="password" label="Password">
        {(control) => (
          <Input
            {...control}
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        )}
      </Field>

      {state?.error ? (
        <p
          role="alert"
          className="rounded-field bg-danger-bg px-3 py-2 text-[12.5px] leading-relaxed text-danger-ink"
        >
          {state.error}
        </p>
      ) : null}

      <Button type="submit" size="md" className="w-full" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
