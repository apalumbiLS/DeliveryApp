"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useTransition,
  type FormEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";

import { Button } from "@/components/ui/button";
import { CheckIcon } from "@/components/ui/icons";
import { useFormStatus } from "react-dom";
import type { DraftResult } from "@/lib/dispatch/draft-input";
import { cn } from "@/lib/utils";

type DraftAction = (
  previous: DraftResult,
  formData: FormData,
) => Promise<DraftResult>;

type Draft = {
  save: () => Promise<DraftResult>;
  /** Opens and scrolls to the form, so a rejected save shows its reason. */
  reveal: () => void;
};

/** Forms are keyed by their label, which is unique on the page. */
type DraftsState = {
  dirtyIds: ReadonlySet<string>;
  saving: boolean;
  /** Labels of the forms the last save could not save. */
  failed: string[];
  /** True after a save that saved everything, until the next edit. */
  saved: boolean;
  register: (id: string, draft: Draft) => () => void;
  setDirty: (id: string, dirty: boolean) => void;
  saveAll: () => void;
  /** Turns on the highlight for fields that still block sending. */
  showMissing: () => void;
  /** Opens and scrolls to a form by label; false when there is none. */
  reveal: (id: string) => boolean;
};

const DraftsContext = createContext<DraftsState | null>(null);

function useDrafts(): DraftsState {
  const state = useContext(DraftsContext);
  if (!state) throw new Error("Draft parts must be inside DraftsProvider");
  return state;
}

const LEAVE_WARNING = "You have unsaved changes. Leave without saving?";

/**
 * Leaving the page drops unsaved edits, so warn first: `beforeunload` for
 * reloads and other sites, and a confirm on in-app links, which navigate
 * without unloading.
 */
function useLeaveWarning(active: boolean) {
  useEffect(() => {
    if (!active) return;

    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
    }

    function onClick(event: MouseEvent) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      const link =
        event.target instanceof Element
          ? event.target.closest("a[href]")
          : null;
      if (
        !(link instanceof HTMLAnchorElement) ||
        link.target === "_blank" ||
        link.hasAttribute("download") ||
        link.origin !== window.location.origin
      ) {
        return;
      }
      if (!window.confirm(LEAVE_WARNING)) {
        event.preventDefault();
        event.stopPropagation();
      }
    }

    window.addEventListener("beforeunload", onBeforeUnload);
    // Capture phase, so the confirm runs before Next's `<Link>` navigates.
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [active]);
}

/**
 * Every dispatcher draft form on the page, saved together by one button.
 *
 * Each form keeps its own server action and validation; this only tracks which
 * have unsaved edits and saves those in turn.
 */
export function DraftsProvider({ children }: { children: ReactNode }) {
  const drafts = useRef(new Map<string, Draft>());
  const [dirtyIds, setDirtyIds] = useState<ReadonlySet<string>>(new Set());
  const [failed, setFailed] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [saving, startSaving] = useTransition();
  const [missingShown, setMissingShown] = useState(false);

  const setDirty = useCallback((id: string, dirty: boolean) => {
    if (dirty) setSaved(false);
    setDirtyIds((current) => {
      if (current.has(id) === dirty) return current;
      const next = new Set(current);
      if (dirty) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const register = useCallback(
    (id: string, draft: Draft) => {
      drafts.current.set(id, draft);
      return () => {
        drafts.current.delete(id);
        setDirty(id, false);
      };
    },
    [setDirty],
  );

  function saveAll() {
    setFailed([]);
    startSaving(async () => {
      const rejected: string[] = [];
      for (const id of dirtyIds) {
        const draft = drafts.current.get(id);
        if (!draft) continue;
        const result = await draft.save();
        if (result.outcome !== "saved") rejected.push(id);
      }
      setFailed(rejected);
      if (rejected.length > 0) drafts.current.get(rejected[0])?.reveal();
      setSaved(rejected.length === 0);
    });
  }

  useLeaveWarning(dirtyIds.size > 0);

  return (
    <DraftsContext.Provider
      value={{
        dirtyIds,
        saving,
        failed,
        saved,
        register,
        setDirty,
        saveAll,
        showMissing: () => setMissingShown(true),
        reveal: (id) => {
          const draft = drafts.current.get(id);
          draft?.reveal();
          return Boolean(draft);
        },
      }}
    >
      {/* Fields style themselves with `in-data-show-missing:` while empty, so
          a highlight clears as soon as the field is filled in. */}
      <div className="contents" data-show-missing={missingShown || undefined}>
        {children}
      </div>
    </DraftsContext.Provider>
  );
}

type DraftFormState = {
  dirty: boolean;
  saving: boolean;
  message: string | null;
};

const DraftFormContext = createContext<DraftFormState | null>(null);

const DraftRevealContext = createContext<(() => void) | null>(null);

/**
 * Around draft forms that can be hidden, such as a collapsed panel: `reveal`
 * shows them when their save is rejected.
 */
export function DraftRevealProvider({
  reveal,
  children,
}: {
  reveal: () => void;
  children: ReactNode;
}) {
  return (
    <DraftRevealContext.Provider value={reveal}>
      {children}
    </DraftRevealContext.Provider>
  );
}

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
 * It has no save button of its own: `DraftSaveBar` saves every edited form on
 * the page. The action is called directly rather than through `<form action>`,
 * because React resets a form after an action and a rejected save must keep
 * what the dispatcher typed.
 */
export function DraftForm({
  label,
  action,
  savedKey,
  messages,
  className,
  children,
}: {
  /**
   * Names the form in the save bar when it could not be saved, and keys it for
   * `DraftMarker`. Unique on the page.
   */
  label: string;
  action: DraftAction;
  /**
   * Changes whenever the saved values do. The fields remount on it, so after a
   * save they show what the server now holds — an uncontrolled `<select>` would
   * otherwise keep its first default.
   */
  savedKey: string;
  /** Shown in the form when the server rejects the save. */
  messages: { invalid: string; error: string };
  className?: string;
  children: ReactNode;
}) {
  const { dirtyIds, saving, register, setDirty, saveAll } = useDrafts();
  const showParent = useContext(DraftRevealContext);
  const formRef = useRef<HTMLFormElement>(null);
  const [result, setResult] = useState<DraftResult>({ outcome: "idle" });
  const [reveals, setReveals] = useState(0);

  useEffect(
    () =>
      register(label, {
        save: async () => {
          const form = formRef.current;
          if (!form) return { outcome: "error" };
          const next = await action({ outcome: "idle" }, new FormData(form));
          setResult(next);
          if (next.outcome === "saved") setDirty(label, false);
          return next;
        },
        reveal: () => {
          showParent?.();
          setReveals((count) => count + 1);
        },
      }),
    [register, setDirty, label, action, showParent],
  );

  // Scrolls after the commit that un-hides a collapsed parent, so the form has
  // a position to scroll to. Centered, to clear the sticky gate bar.
  useEffect(() => {
    if (reveals === 0) return;
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [reveals]);

  // Enter in a field saves the page, as the save bar would.
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!saving) saveAll();
  }

  const dirty = dirtyIds.has(label);
  const message =
    result.outcome === "invalid"
      ? messages.invalid
      : result.outcome === "error"
        ? messages.error
        : null;

  return (
    <DraftFormContext.Provider value={{ dirty, saving, message }}>
      <form
        ref={formRef}
        key={savedKey}
        onSubmit={onSubmit}
        onChange={(event) => setDirty(label, hasChanges(event.currentTarget))}
        className={className}
      >
        {children}
      </form>
    </DraftFormContext.Provider>
  );
}

/** Where the enclosing `DraftForm` says it has unsaved edits, or why a save failed. */
export function DraftStatus({ className }: { className?: string }) {
  const state = useContext(DraftFormContext);
  if (!state) throw new Error("DraftStatus must be inside a DraftForm");
  const { dirty, saving, message } = state;

  if (message && dirty) {
    return (
      <p
        role="alert"
        className={cn(
          "rounded-control bg-danger-bg px-2 py-1.5 text-[10.5px] leading-relaxed text-danger-ink",
          className,
        )}
      >
        {message}
      </p>
    );
  }

  if (!dirty) return null;

  return (
    <p
      className={cn(
        "flex items-center gap-1.5 text-[10.5px] font-medium text-warning-ink",
        className,
      )}
    >
      <span
        aria-hidden
        className="h-1.5 w-1.5 shrink-0 rounded-full bg-warning"
      />
      {saving ? "Saving…" : "Unsaved"}
    </p>
  );
}

/**
 * A form's unsaved or rejected state, shown away from the form itself — on a
 * summary that stays visible while the form is collapsed.
 */
export function DraftMarker({ form }: { form: string }) {
  const { dirtyIds, failed } = useDrafts();
  if (!dirtyIds.has(form)) return null;

  const rejected = failed.includes(form);
  return (
    <span
      className={cn(
        "flex shrink-0 items-center gap-1 text-[10.5px] font-medium whitespace-nowrap",
        rejected ? "text-danger-ink" : "text-warning-ink",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          rejected ? "bg-danger" : "bg-warning",
        )}
      />
      {rejected ? "Not saved" : "Unsaved"}
    </span>
  );
}

/** The page's one save: shown in the gate bar while any form has unsaved edits. */
export function DraftSaveBar() {
  const { dirtyIds, saving, failed, saved, saveAll } = useDrafts();

  if (dirtyIds.size === 0) {
    return saved ? (
      <span className="flex items-center gap-1 text-[11.5px] font-medium text-success-ink">
        <CheckIcon className="h-3.5 w-3.5" />
        Changes saved
      </span>
    ) : null;
  }

  return (
    <div className="flex items-center gap-2.5">
      <span
        className={cn(
          "max-w-56 text-right text-[11.5px] leading-snug font-medium",
          failed.length > 0 ? "text-danger-ink" : "text-warning-ink",
        )}
      >
        {failed.length > 0
          ? `Not saved: ${failed.join(", ")}`
          : "Unsaved changes"}
      </span>
      <Button size="sm" onClick={saveAll} disabled={saving}>
        {saving ? "Saving…" : "Save changes"}
      </Button>
    </div>
  );
}

/**
 * A submit button that stays disabled while the page has unsaved edits, and
 * while its own form is submitting, so it cannot be sent twice.
 *
 * While something else blocks it, it stays clickable: a click scrolls to the
 * first unfinished section and highlights what is missing, instead of sending.
 */
export function SubmitWhenSaved({
  blockedTarget,
  pendingLabel,
  children,
}: {
  /**
   * Set while the form cannot be sent: a draft form's label, or else the
   * `data-gate` of a section, to scroll to.
   */
  blockedTarget?: string | null;
  /** Shown while the form submits. */
  pendingLabel: ReactNode;
  children: ReactNode;
}) {
  const { dirtyIds, saving, showMissing, reveal } = useDrafts();
  const { pending } = useFormStatus();
  const unsaved = dirtyIds.size > 0 || saving;

  function onClick(event: ReactMouseEvent<HTMLButtonElement>) {
    if (!blockedTarget) return;
    event.preventDefault();
    showMissing();
    if (!reveal(blockedTarget)) {
      // Centered, to clear the sticky gate bar.
      document
        .querySelector(`[data-gate="${blockedTarget}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  return (
    <Button
      type="submit"
      size="sm"
      onClick={onClick}
      disabled={unsaved || pending}
      aria-disabled={blockedTarget ? true : undefined}
      title={
        unsaved
          ? "Save your changes first"
          : blockedTarget
            ? "Fill in what's highlighted first"
            : undefined
      }
    >
      {pending ? pendingLabel : children}
    </Button>
  );
}
