"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { useInView } from "@/shared/hooks/use-in-view";
import { usePageVisible } from "@/shared/hooks/use-page-visible";
import { usePrefersReducedMotion } from "@/shared/hooks/use-prefers-reduced-motion";

/* ---------------------------------------------------------------------------
 * WordSwapper — a single rotating word that cycles through a list, blur-masking
 * the swap and animating its width so the surrounding sentence reslides instead
 * of jumping. Used for the flat-file formats (".csv", ".parquet", …) and the
 * supported ORMs ("Drizzle", "Prisma", …).
 *
 * Motion follows the explanatory-animation rules: a custom ease-out curve, a
 * faster exit than enter, a touch of blur to mask the text swap, and an
 * animated width so the trailing sentence reslides instead of jumping. The
 * loop is gated on scroll/visibility/reduced-motion so it never runs unseen.
 * ------------------------------------------------------------------------- */
const HOLD_MS = 2200; // time a word stays put before swapping
const EXIT_MS = 170; // exit is snappy — the system clearing the old word
const ENTER_MS = 300; // enter is a touch slower — the new word settling in
const EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)";

type TPhase = "rest" | "exiting" | "entering";

type TWordSwapperProps = {
  words: string[];
  /** Tailwind classes for the live word — usually just its accent color. */
  wordClassName?: string;
};

export function WordSwapper({
  words,
  wordClassName = "text-accent-pink",
}: TWordSwapperProps) {
  const wordRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const [viewRef, inView] = useInView<HTMLSpanElement>({ threshold: 0 });
  const pageVisible = usePageVisible();
  const reducedMotion = usePrefersReducedMotion();

  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<TPhase>("rest");
  const [widths, setWidths] = useState<number[]>([]);

  // Measure every word once so the container can animate to an exact width
  // instead of snapping. Re-measures if fonts load in late.
  useLayoutEffect(() => {
    function measure() {
      const next = wordRefs.current.map((el) => el?.offsetWidth ?? 0);
      setWidths(next);
    }
    measure();
    if (document.fonts?.ready) document.fonts.ready.then(measure);
  }, []);

  const running = inView && pageVisible && !reducedMotion && widths.length > 0;

  // Reduced motion: a plain crossfade, no movement, no blur, no width dance.
  useEffect(() => {
    if (inView && pageVisible && reducedMotion) {
      const id = setInterval(
        () => setIndex((i) => (i + 1) % words.length),
        HOLD_MS + ENTER_MS,
      );
      return () => clearInterval(id);
    }
  }, [inView, pageVisible, reducedMotion, words.length]);

  useEffect(() => {
    if (!running) return;
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        timers.push(setTimeout(resolve, ms));
      });

    async function loop() {
      while (!cancelled) {
        await wait(HOLD_MS);
        if (cancelled) return;
        setPhase("exiting");
        await wait(EXIT_MS);
        if (cancelled) return;
        setIndex((i) => (i + 1) % words.length);
        setPhase("entering");
        // Next frame the word is mounted at its start offset; flipping to
        // "rest" lets the transition carry it home.
        await wait(20);
        if (cancelled) return;
        setPhase("rest");
        await wait(ENTER_MS);
      }
    }

    loop();
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [running]);

  const width = widths[index];
  const motion = running ? phase : "rest";

  let opacity = 1;
  let translate = "0";
  let blur = "0px";
  if (motion === "exiting") {
    opacity = 0;
    translate = "-0.45em";
    blur = "3px";
  } else if (motion === "entering") {
    opacity = 0;
    translate = "0.45em";
    blur = "3px";
  }

  return (
    <span
      ref={viewRef}
      className="relative inline-flex items-baseline overflow-hidden align-baseline"
      style={{
        width: width ? `${width}px` : undefined,
        transition: width ? `width ${ENTER_MS}ms ${EASE_OUT}` : undefined,
      }}
    >
      {/* Live word — the only thing the user sees. */}
      <span
        key={running ? "rolling" : "static"}
        className={`inline-block whitespace-nowrap not-italic ${wordClassName}`}
        style={{
          opacity,
          filter: `blur(${blur})`,
          transform: `translateY(${translate})`,
          transition:
            motion === "exiting"
              ? `opacity ${EXIT_MS}ms ${EASE_OUT}, transform ${EXIT_MS}ms ${EASE_OUT}, filter ${EXIT_MS}ms ${EASE_OUT}`
              : `opacity ${ENTER_MS}ms ${EASE_OUT}, transform ${ENTER_MS}ms ${EASE_OUT}, filter ${ENTER_MS}ms ${EASE_OUT}`,
        }}
      >
        {words[index]}
      </span>

      {/* Hidden measuring rail — same type, never painted. */}
      <span
        aria-hidden
        className="pointer-events-none invisible absolute left-0 top-0 whitespace-nowrap"
      >
        {words.map((f, i) => (
          <span
            key={f}
            ref={(el) => {
              wordRefs.current[i] = el;
            }}
            className="not-italic"
          >
            {f}
          </span>
        ))}
      </span>
    </span>
  );
}

/* The rotating word in "That .csv doesn't need a database first." — the flat
 * file formats Dora reads in place, written as the extensions you'd drop in. */
const FORMATS = [".csv", ".json", ".parquet", ".ndjson", ".tsv"];

export function FormatSwapper() {
  return <WordSwapper words={FORMATS} />;
}

/* The rotating word in the ORM runner heading — the ORMs whose client queries
 * Dora translates to SQL before they run. */
const ORMS = ["Drizzle", "Prisma"];

export function OrmSwapper() {
  return <WordSwapper words={ORMS} wordClassName="text-accent-rose" />;
}
