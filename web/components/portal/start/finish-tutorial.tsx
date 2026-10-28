"use client";

import {
  Check,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Mail,
  Pause,
  Play,
  X,
} from "lucide-react";
import {
  AnimatePresence,
  LayoutGroup,
  MotionConfig,
  motion,
} from "motion/react";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { button } from "@/components/ui/button";
import { RETAILERS, type RetailerId } from "@/lib/retailers";
import { cn } from "@/lib/utils";

import {
  LowesCartIconShot,
  LowesCheckoutShot,
  LowesEmailFormShot,
  LowesPickupTodayShot,
  LowesSetStoreDemo,
  LowesShareButtonShot,
} from "./lowes-how-to";

/** "Tap" on a phone, "Click" on a computer, by screen width. */
function TapOrClick() {
  return (
    <>
      <span className="md:hidden">Tap</span>
      <span className="hidden md:inline">Click</span>
    </>
  );
}

function EnvelopeIcon() {
  return (
    <Mail
      className="inline h-[1.05em] w-[1.05em] align-[-0.15em]"
      aria-label="the envelope"
    />
  );
}

type Item = {
  title: string;
  caption: ReactNode;
  /** How long the item plays before the next one takes the stage. */
  ms: number;
  visual: (paused: boolean) => ReactNode;
};

/** Phases: the intro, then one per item, then the end card. */
const INTRO = 0;
const INTRO_MS = 3000;
/**
 * Item 3's beats, in seconds from when it takes the stage: a window per line
 * (open the cart, tap ✉, fill in the form), then "Don't check out".
 */
type Window = { start: number; length: number };
const EMAIL_WINDOWS: Window[] = [
  { start: 0, length: 2.5 },
  { start: 2.5, length: 2.5 },
  { start: 5, length: 3.5 },
];
const EMAIL_CHECKOUT_AT = 8.5;

/** A CSS animation delay for a beat, so it starts when its moment comes. */
function beat(seconds: number) {
  return { animationDelay: `${seconds}s` };
}

/**
 * Each item's number and title, in the three places they appear: the centred
 * list (intro and end), the top of the screen while it plays, and the stack at
 * the bottom while another plays. They share a layoutId per item, so moving
 * between places is one element gliding and resizing, not a cut.
 */
const SIZES = {
  list: {
    row: "gap-3.5",
    badge: "h-8 w-8 text-[14px]",
    check: "h-4 w-4",
    title: "text-[17px] font-medium text-ink",
  },
  stage: {
    row: "gap-3.5",
    badge: "h-10 w-10 text-[17px]",
    check: "h-5 w-5",
    title: "text-[22px] leading-tight font-semibold tracking-tight text-ink",
  },
  stack: {
    row: "gap-2.5",
    badge: "h-5 w-5 text-[10.5px]",
    check: "h-3 w-3",
    title: "text-[13px] text-ink-muted",
  },
};

function ItemLabel({
  index,
  title,
  done,
  size,
}: {
  index: number;
  title: string;
  done: boolean;
  size: keyof typeof SIZES;
}) {
  const s = SIZES[size];
  return (
    <span className={cn("flex items-center", s.row)}>
      <motion.span
        layoutId={`tutorial-badge-${index}`}
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full font-semibold",
          s.badge,
          done
            ? "bg-success text-card"
            : size === "stack"
              ? "bg-sunken text-ink-muted"
              : "bg-accent text-accent-ink",
        )}
      >
        {done ? <Check className={s.check} strokeWidth={3} /> : index + 1}
      </motion.span>
      <motion.span layoutId={`tutorial-title-${index}`} className={s.title}>
        {title}
      </motion.span>
    </span>
  );
}

/**
 * What happens on the retailer's site, played like a short explainer video.
 * It opens on the three things to do as a list. Then each takes the stage in
 * turn: its number and title rise to the top and grow while the others shrink
 * into a stack at the bottom, and its picture plays beneath. At the end all
 * three come back to the list, ticked. Pause, back, next and skip are below,
 * and any item can be tapped to jump to it.
 *
 * Mounting it opens it; the parent unmounts it to close, so every opening
 * starts from the top.
 *
 * The visuals are Lowe's captures; other retailers get the words alone until
 * they're live.
 */
export function FinishTutorial({
  retailerId,
  initialHide,
  onClose,
  onGotIt,
}: {
  retailerId: RetailerId;
  /** Whether "Don't show this again" starts ticked. */
  initialHide: boolean;
  onClose: () => void;
  onGotIt: (hideNextTime: boolean) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const stageBody = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState(INTRO);
  // Bumped on every jump, so replaying an item restarts its clip, its
  // animations and its timer rather than resuming the old ones.
  const [take, setTake] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hideNextTime, setHideNextTime] = useState(initialHide);
  // Only ever mounted in the browser after a click, so these can read the
  // environment directly.
  const [reducedMotion] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [desktop] = useState(
    () => window.matchMedia("(width >= 48rem)").matches,
  );

  const retailer = RETAILERS[retailerId];
  const lowes = retailerId === "lowes";

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    el.showModal();
    // The page behind shouldn't scroll under a modal.
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = previous;
      if (el.open) el.close();
    };
  }, []);

  // A keyframe that runs only for its window and falls back to the element's
  // own style either side. Inline, so it carries the pause itself: an inline
  // animation shorthand would otherwise override the paused class.
  const during = (name: string, { start, length }: Window) =>
    reducedMotion
      ? undefined
      : {
          animation: `${name} ${length}s ease ${start}s`,
          animationPlayState: paused ? "paused" : "running",
        };

  const items: Item[] = [
    {
      title: "Set your store",
      // The phone clip runs about 7s. The desktop before/after shows its
      // "after" from 2.7s to 4.6s of its cycle, so stop while it's showing.
      ms: desktop ? 4700 : 7700,
      caption: (
        <>
          {lowes ? (
            <span className="md:hidden">Scroll down and tap </span>
          ) : (
            <span className="md:hidden">Tap </span>
          )}
          <span className="hidden md:inline">Click </span>
          {retailer.storeAction}
        </>
      ),
      visual: (isPaused) =>
        lowes ? <LowesSetStoreDemo paused={isPaused} /> : null,
    },
    {
      title: "Shop Pickup Today items",
      ms: 5500,
      caption: (
        <>
          <TapOrClick /> Pickup Today when you search
        </>
      ),
      visual: () => (lowes ? <LowesPickupTodayShot /> : null),
    },
    {
      title: "Email us your cart",
      ms: 13000,
      // All three lines stay listed; the one playing is dark, and only its
      // picture shows beneath, so there's never a question of which picture
      // goes with which line. "Don't check out" then takes the picture's place.
      caption: (
        <ul className="list-disc space-y-1 pl-5 marker:text-ink-faint">
          {[
            <>Open your cart</>,
            <>
              <TapOrClick /> <EnvelopeIcon />
              <span className="hidden md:inline"> Share</span>
            </>,
            <>Paste our address as the recipient, then Send</>,
          ].map((line, i) => (
            <li
              key={i}
              className={reducedMotion ? "text-ink-muted" : "text-ink-faint"}
              style={during("tutorial-lit", EMAIL_WINDOWS[i])}
            >
              {line}
            </li>
          ))}
        </ul>
      ),
      // One picture area: each picture shows only during its line's window,
      // all stacked in one grid cell so the swap never changes the height.
      // With reduced motion they simply sit in order.
      visual: () => (
        <div className="grid items-start">
          {lowes
            ? [
                <LowesCartIconShot key="cart" />,
                <LowesShareButtonShot key="envelope" />,
                <LowesEmailFormShot key="form" />,
              ].map((shot, i) => (
                <div
                  key={i}
                  className={cn(
                    reducedMotion
                      ? "mb-3"
                      : "col-start-1 row-start-1 opacity-0",
                  )}
                  style={during("tutorial-window", EMAIL_WINDOWS[i])}
                >
                  {shot}
                </div>
              ))
            : null}
          <div
            className={cn(
              "motion-safe:animate-tutorial-in",
              reducedMotion ? "mt-2" : "col-start-1 row-start-1",
            )}
            style={lowes ? beat(EMAIL_CHECKOUT_AT) : undefined}
          >
            <p className="text-[15px] font-semibold text-ink">
              Don&apos;t check out
            </p>
            <p className="text-[14px] text-ink-muted">We buy it for you.</p>
            {lowes ? (
              <div className="mt-4 px-3 pt-3">
                <LowesCheckoutShot />
              </div>
            ) : null}
          </div>
        </div>
      ),
    },
  ];

  const END = items.length + 1;
  const atEnd = phase === END;
  const staged = phase === INTRO || atEnd ? null : phase - 1;
  const ms =
    phase === INTRO ? INTRO_MS : staged !== null ? items[staged].ms : null;
  const playing =
    ms === null
      ? undefined
      : {
          animation: `tutorial-progress ${ms}ms linear forwards`,
          animationPlayState: paused ? "paused" : "running",
        };

  function go(to: number) {
    setPhase(Math.max(INTRO, Math.min(END, to)));
    setTake((current) => current + 1);
    setPaused(false);
  }

  // Each item starts at the top of its picture, not wherever the last one was
  // scrolled to.
  useLayoutEffect(() => {
    stageBody.current?.scrollTo({ top: 0 });
  }, [take]);

  const isDone = (i: number) => atEnd || (staged !== null && i < staged);

  return (
    <dialog
      ref={dialog}
      aria-label={`How to build your cart on ${retailer.label}`}
      // Escape closes; route it through the parent so its state follows.
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className={cn(
        "m-auto flex-col overflow-hidden border-0 bg-card p-0 text-ink backdrop:bg-ink/60 open:flex",
        // Full screen on a phone; a fixed-size panel on a computer, so it
        // doesn't jump as items take the stage.
        "max-md:h-dvh max-md:max-h-none max-md:w-full max-md:max-w-none",
        "md:h-[min(50rem,calc(100dvh-3rem))] md:w-[48rem] md:max-w-[calc(100vw-4rem)] md:rounded-card md:shadow-card",
      )}
    >
      {/* The clock: when its run ends, the next phase starts. */}
      {playing && !reducedMotion ? (
        <span
          key={take}
          aria-hidden
          className="pointer-events-none absolute size-0"
          style={playing}
          onAnimationEnd={() => go(phase + 1)}
        />
      ) : null}

      <div className="flex justify-end px-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded-full p-1 text-ink-faint transition-colors hover:bg-sunken hover:text-ink"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <MotionConfig
        reducedMotion="user"
        transition={{ type: "spring", bounce: 0.12, duration: 0.6 }}
      >
        <LayoutGroup>
          {staged === null ? (
            // Intro and end: the three things as a list, centred.
            <div className="flex min-h-0 flex-1 flex-col justify-center overflow-y-auto px-7 pb-6">
              <motion.div
                key={atEnd ? "end" : "intro"}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0, transition: { delay: 0.25 } }}
                aria-live="polite"
              >
                {atEnd ? (
                  <div className="flex items-center gap-2.5">
                    <CircleCheck className="h-7 w-7 text-success" aria-hidden />
                    <h2 className="text-[24px] leading-tight font-semibold tracking-tight text-ink">
                      You&apos;re all set
                    </h2>
                  </div>
                ) : (
                  <>
                    <h2 className="text-[24px] leading-tight font-semibold tracking-tight text-ink">
                      Here&apos;s what&apos;s next
                    </h2>
                    <p className="mt-1.5 text-[15px] leading-snug text-ink-muted">
                      You&apos;ll build your cart on {retailer.label}. Three
                      quick things:
                    </p>
                  </>
                )}
              </motion.div>

              <ol className="mt-7 space-y-5">
                {items.map((item, i) => (
                  <li key={item.title}>
                    <button
                      type="button"
                      onClick={() => go(i + 1)}
                      className="text-left"
                    >
                      <ItemLabel
                        index={i}
                        title={item.title}
                        done={isDone(i)}
                        size="list"
                      />
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          ) : (
            <>
              {/* The stage: the playing item's number and title in a fixed
                  header, with its picture scrolling beneath if it's tall. */}
              <div className="px-7 pt-2" aria-live="polite">
                {/* Keyed so each item gets its own element. A layoutId can't
                    change on a mounted element: reused, it stays registered
                    as the previous item's, and is hidden the moment that
                    item's small copy appears in the stack. */}
                <ItemLabel
                  key={staged}
                  index={staged}
                  title={items[staged].title}
                  done={false}
                  size="stage"
                />

                {playing && !reducedMotion ? (
                  <span className="mt-4 block h-0.5 overflow-hidden rounded-full bg-sunken">
                    <span
                      key={take}
                      className="block h-full origin-left bg-accent"
                      style={playing}
                    />
                  </span>
                ) : null}
              </div>

              <div
                ref={stageBody}
                className={cn(
                  "min-h-0 flex-1 overflow-y-auto px-7 pb-5",
                  paused && "[&_*]:[animation-play-state:paused]",
                )}
              >
                <AnimatePresence mode="wait">
                  <motion.div
                    key={take}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{
                      opacity: 1,
                      y: 0,
                      transition: { delay: 0.3, duration: 0.35 },
                    }}
                    exit={{ opacity: 0, transition: { duration: 0.15 } }}
                  >
                    <div className="mt-4 text-[15px] leading-snug text-ink-muted">
                      {items[staged].caption}
                    </div>
                    <div className="mt-5">{items[staged].visual(paused)}</div>
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* The stack: all three, small, in order. The playing one's slot
                  stays, outlined in the accent, so the order never shifts and
                  it reads as "you are here". */}
              <ol className="space-y-2 border-t border-hairline-soft px-7 py-3.5">
                {items.map((item, i) =>
                  i === staged ? (
                    <li
                      key={item.title}
                      aria-hidden
                      className="flex items-center gap-2.5"
                    >
                      <span className="flex h-5 w-5 items-center justify-center rounded-full border border-accent text-[10.5px] font-semibold text-accent">
                        {i + 1}
                      </span>
                      <span className="text-[13px] text-ink-faint">
                        {item.title}
                      </span>
                    </li>
                  ) : (
                    <li key={item.title}>
                      <button
                        type="button"
                        onClick={() => go(i + 1)}
                        className="text-left"
                      >
                        <ItemLabel
                          index={i}
                          title={item.title}
                          done={isDone(i)}
                          size="stack"
                        />
                      </button>
                    </li>
                  ),
                )}
              </ol>
            </>
          )}
        </LayoutGroup>
      </MotionConfig>

      <div className="border-t border-hairline-soft px-5 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        {atEnd ? (
          <div className="flex flex-col gap-4">
            <label
              htmlFor="tutorial-hide"
              className="flex items-center justify-center gap-2.5 text-[13px] text-ink-muted"
            >
              <input
                id="tutorial-hide"
                type="checkbox"
                checked={hideNextTime}
                onChange={(event) => setHideNextTime(event.target.checked)}
                className="h-4 w-4 accent-accent"
              />
              Don&apos;t show this again
            </label>
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => go(INTRO)}
                className={button({ intent: "secondary", size: "lg" })}
              >
                Watch again
              </button>
              <button
                type="button"
                onClick={() => onGotIt(hideNextTime)}
                className={cn(
                  button({ intent: "primary", size: "lg" }),
                  "flex-1",
                )}
              >
                Got it
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1">
              {reducedMotion ? null : (
                <ControlButton
                  label={paused ? "Play" : "Pause"}
                  onClick={() => setPaused((current) => !current)}
                >
                  {paused ? (
                    <Play className="h-4.5 w-4.5" />
                  ) : (
                    <Pause className="h-4.5 w-4.5" />
                  )}
                </ControlButton>
              )}
              <ControlButton
                label="Previous"
                onClick={() => go(phase - 1)}
                disabled={phase === INTRO}
              >
                <ChevronLeft className="h-5 w-5" />
              </ControlButton>
              <ControlButton label="Next" onClick={() => go(phase + 1)}>
                <ChevronRight className="h-5 w-5" />
              </ControlButton>
            </div>
            <button
              type="button"
              onClick={() => go(END)}
              className="text-[13px] font-medium text-ink-muted transition-colors hover:text-ink"
            >
              Skip
            </button>
          </div>
        )}
      </div>
    </dialog>
  );
}

function ControlButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex h-9 w-9 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-sunken hover:text-ink disabled:opacity-35"
    >
      {children}
    </button>
  );
}
