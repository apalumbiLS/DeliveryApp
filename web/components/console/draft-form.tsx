"use client";

import {
  createContext,
  startTransition,
  useActionState,
  useContext,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

import { Button } from "@/components/ui/button";
import { CheckIcon } from "@/components/ui/icons";
import type { DraftResult } from "@/lib/dispatch/draft-input";

type DraftAction = (
  previous: DraftResult,
  formData: FormData,
) => Promise<DraftResult>;

type DraftFormState = {
  dirty: boolean;
  pending: boolean;
  message: string | null;
};

const DraftFormContext = createContext<DraftFormState | null>(null);

/**
 * Whether any field differs from what the server rendered.
 *
 * Compared against each control's own default rather than a snapshot, so
 * typing a value and then deleting it again reads as unchanged.
 */
function hasChanges(form: HTMLFormElement): boolean {
  for (const element of Array.from(form.elements)) {
    if (element instanceof HTMLInputElement) {
      if (element.type === "hidden") continue;
      if (element.type === "radio" || element.type === "checkbox") {
        if (element.checked !== element.defaultChecked) return true;
      } else if (element.value !== element.defaultValue) {
        return true;
      }
    } else if (element instanceof HTMLTextAreaElement) {
      if (element.value !== element.defaultValue) return true;
    } else if (element instanceof HTMLSelectElement) {
      for (const option of Array.from(element.options)) {
        if (option.selected !== option.defaultSelected) return true;
      }
    }
  }
  return false;
}

/**
 * A dispatcher draft form that knows whether its fields are saved.
 *
 * Submitting goes through `startTransition` rather than `<form action>`: React
 * resets a form after an action, and a rejected save must keep what the
 * dispatcher typed.
 */
export function DraftForm({
  action,
  savedKey,
  messages,
  className,
  children,
}: {
  action: DraftAction;
  /**
   * Changes whenever the saved values do. The fields remount on it, so after a
   * save they show what the server now holds — an uncontrolled `<select>` would
   * otherwise keep its first default.
   */
  savedKey: string;
  /** Shown beside the save button when the server rejects the save. */
  messages: { invalid: string; error: string };
  className?: string;
  children: ReactNode;
}) {
  const [dirty, setDirty] = useState(false);
  const [state, formAction, pending] = useActionState<DraftResult, FormData>(
    async (previous, formData) => {
      const result = await action(previous, formData);
      if (result.outcome === "saved") setDirty(false);
      return result;
    },
    { outcome: "idle" },
  );

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  const message =
    state.outcome === "invalid"
      ? messages.invalid
      : state.outcome === "error"
        ? messages.error
        : null;

  return (
    <DraftFormContext.Provider value={{ dirty, pending, message }}>
      <form
        key={savedKey}
        onSubmit={onSubmit}
        onChange={(event) => setDirty(hasChanges(event.currentTarget))}
        className={className}
      >
        {children}
      </form>
    </DraftFormContext.Provider>
  );
}

/** The save button for the enclosing `DraftForm`: Saved · Save · Saving… */
export function DraftSaveButton({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  const state = useContext(DraftFormContext);
  if (!state) throw new Error("DraftSaveButton must be inside a DraftForm");
  const { dirty, pending, message } = state;

  return (
    <div className={className}>
      <Button
        type="submit"
        intent="neutral"
        size="sm"
        disabled={!dirty || pending}
        className="w-full"
      >
        {pending ? (
          "Saving…"
        ) : dirty ? (
          label
        ) : (
          <>
            <CheckIcon className="h-3.5 w-3.5" />
            Saved
          </>
        )}
      </Button>
      {message ? (
        <p
          role="alert"
          className="mt-1.5 rounded-control bg-danger-bg px-2 py-1.5 text-[10.5px] leading-relaxed text-danger-ink"
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
