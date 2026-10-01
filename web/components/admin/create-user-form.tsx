"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { createUser, type CreateUserState } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { USER_ROLES, userRoleLabel, type UserRole } from "@/lib/tokens";

export function CreateUserForm({
  companies,
}: {
  companies: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState<CreateUserState, FormData>(
    createUser,
    undefined,
  );
  const [role, setRole] = useState<UserRole>("customer");

  return (
    <form action={action} className="max-w-sm space-y-4">
      <Field id="fullName" label="Full name" hint="Optional.">
        {(control) => (
          <Input {...control} name="fullName" autoComplete="name" />
        )}
      </Field>

      <Field id="email" label="Email">
        {(control) => (
          <Input
            {...control}
            name="email"
            type="email"
            autoComplete="off"
            placeholder="you@company.com"
            required
          />
        )}
      </Field>

      <Field
        id="password"
        label="Password"
        hint="At least 8 characters. Hand it over out of band."
      >
        {(control) => (
          <Input
            {...control}
            name="password"
            type="password"
            autoComplete="new-password"
            required
          />
        )}
      </Field>

      <Field id="role" label="Role">
        {(control) => (
          <Select
            {...control}
            name="role"
            value={role}
            onChange={(event) => setRole(event.target.value as UserRole)}
          >
            {USER_ROLES.map((value) => (
              <option key={value} value={value}>
                {userRoleLabel[value]}
              </option>
            ))}
          </Select>
        )}
      </Field>

      {role === "customer" ? (
        <Field
          id="companyId"
          label="Company"
          hint="A customer must belong to a company."
        >
          {(control) => (
            <Select {...control} name="companyId" defaultValue="">
              <option value="" disabled>
                Choose a company
              </option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
      ) : null}

      {state?.error ? (
        <p
          role="alert"
          className="rounded-field bg-danger-bg px-3 py-2 text-[12.5px] leading-relaxed text-danger-ink"
        >
          {state.error}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <Button type="submit" size="md" disabled={pending}>
          {pending ? "Creating…" : "Create user"}
        </Button>
        <Link
          href="/admin"
          className="text-[12.5px] font-medium text-ink-muted transition-colors hover:text-ink"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
