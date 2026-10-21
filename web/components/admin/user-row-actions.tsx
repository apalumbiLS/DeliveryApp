"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";

import { setUserActive, updateUser } from "@/app/(console)/admin/actions";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { USER_ROLES, userRoleLabel, type UserRole } from "@/lib/tokens";

function SaveButton({ disabled }: { disabled?: boolean }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" size="sm" disabled={pending || disabled}>
      {pending ? "Saving…" : "Save"}
    </Button>
  );
}

function ToggleButton({ active }: { active: boolean }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" intent="secondary" size="sm" disabled={pending}>
      {pending ? "…" : active ? "Deactivate" : "Reactivate"}
    </Button>
  );
}

export function UserRowActions({
  userId,
  role,
  companyId,
  active,
  companies,
}: {
  userId: string;
  role: UserRole | null;
  companyId: string | null;
  active: boolean;
  companies: { id: string; name: string }[];
}) {
  const [selectedRole, setSelectedRole] = useState<UserRole>(
    role ?? "customer",
  );
  const [selectedCompany, setSelectedCompany] = useState(companyId ?? "");

  const needsCompany = selectedRole === "customer" && !selectedCompany;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-hairline-soft pt-3">
      <form action={updateUser} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="userId" value={userId} />

        <Select
          name="role"
          aria-label="Role"
          className="w-36"
          value={selectedRole}
          onChange={(event) => setSelectedRole(event.target.value as UserRole)}
        >
          {USER_ROLES.map((value) => (
            <option key={value} value={value}>
              {userRoleLabel[value]}
            </option>
          ))}
        </Select>

        <Select
          name="companyId"
          aria-label="Company"
          className="w-48"
          value={selectedCompany}
          disabled={selectedRole !== "customer"}
          onChange={(event) => setSelectedCompany(event.target.value)}
        >
          <option value="">No company</option>
          {companies.map((company) => (
            <option key={company.id} value={company.id}>
              {company.name}
            </option>
          ))}
        </Select>

        <SaveButton disabled={needsCompany} />
      </form>

      <form action={setUserActive}>
        <input type="hidden" name="userId" value={userId} />
        <input type="hidden" name="active" value={active ? "false" : "true"} />
        <ToggleButton active={active} />
      </form>
    </div>
  );
}
