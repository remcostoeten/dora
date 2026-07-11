"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { usePrefersReducedMotion } from "@/shared/hooks/use-prefers-reduced-motion";

/* ---------------------------------------------------------------------------
 * ProviderInfoPopover — the gooey card that rises out of a provider tile on
 * hover. It is portaled to <body> so the row's overflow-hidden frames can't
 * clip it, and positioned fixed over the hovered button.
 *
 * Motion follows the popover rules: it scales up from the trigger
 * (transform-origin: bottom center), uses a strong ease-out, enters in ~200ms
 * and exits faster, and never starts from scale(0). Sweeping across tiles
 * glides the card sideways instead of popping it in and out. The "goo" is an
 * SVG filter on a dark blob that drips out of the icon and melts into the card,
 * so the panel itself stays crisp and readable. Reduced motion keeps the fade
 * but drops the travel, scale, and drip.
 * ------------------------------------------------------------------------- */
const EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)";
const EASE_BACK = "cubic-bezier(0.34, 1.56, 0.64, 1)";
const ACCENT = "var(--color-brand-200)";
const GOO_ID = "provider-popover-goo";

export type TProviderInfo = {
  name: string;
  tag: string;
  blurb: string;
};

type TProps = {
  info: TProviderInfo | null;
  anchor: HTMLElement | null;
  open: boolean;
};

export function ProviderInfoPopover({ info, anchor, open }: TProps) {
  const reduced = usePrefersReducedMotion();
  const [mounted, setMounted] = useState(false);

  // `shown` lags behind so the card can play its exit before unmounting.
  const [shown, setShown] = useState<TProviderInfo | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [visible, setVisible] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setMounted(true), []);

  function place() {
    if (!anchor) return;
    const r = anchor.getBoundingClientRect();
    setPos({ x: r.left + r.width / 2, y: r.top });
  }

  useLayoutEffect(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    if (dropTimer.current) clearTimeout(dropTimer.current);

    if (open && info && anchor) {
      place();
      setShown(info);
      setVisible(true);
    } else {
      // Small grace period so sweeping between adjacent tiles glides instead
      // of flickering closed for a frame.
      closeTimer.current = setTimeout(() => {
        setVisible(false);
        dropTimer.current = setTimeout(() => setShown(null), 180);
      }, 70);
    }
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
      if (dropTimer.current) clearTimeout(dropTimer.current);
    };
  }, [open, info, anchor]);

  // Keep the card glued to the tile if the page scrolls or resizes while open.
  useEffect(() => {
    if (!visible || !anchor) return;
    const update = () => place();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, anchor]);

  if (!mounted || !shown || !pos) return null;

  const move = !reduced;

  return createPortal(
    <div
      aria-hidden
      className="pointer-events-none fixed z-[60]"
      style={{
        left: pos.x,
        top: pos.y,
        transform: "translate(-50%, -100%)",
        transition: move
          ? `left 300ms ${EASE_OUT}, top 300ms ${EASE_OUT}`
          : "none",
      }}
    >
      <div
        className="relative w-[232px] pb-[18px]"
        style={{
          transformOrigin: "bottom center",
          opacity: visible ? 1 : 0,
          filter: !move ? "none" : visible ? "blur(0px)" : "blur(6px)",
          transform: !move
            ? "none"
            : visible
              ? "translateY(0) scale(1)"
              : "translateY(10px) scale(0.86)",
          transition: visible
            ? `opacity 210ms ${EASE_OUT}, transform 290ms ${EASE_BACK}, filter 230ms ${EASE_OUT}`
            : `opacity 170ms ${EASE_OUT}, transform 190ms ${EASE_OUT}, filter 180ms ${EASE_OUT}`,
        }}
      >
        {/* gooey connector — dark blobs that drip out of the icon and melt
            into the card. Sits behind the crisp panel. */}
        {move ? (
          <div
            aria-hidden
            className="absolute inset-x-0 bottom-0 h-12"
            style={{ filter: `url(#${GOO_ID})` }}
          >
            {/* base puddle under the card — swells as it opens */}
            <span
              className="absolute bottom-[12px] left-1/2 h-5 w-10 -translate-x-1/2 rounded-full bg-surface"
              style={{
                transformOrigin: "center bottom",
                transform: visible ? "scaleY(1) scaleX(1)" : "scaleY(0.4) scaleX(0.8)",
                transition: `transform 280ms ${EASE_BACK}`,
              }}
            />
            {/* primary drip toward the icon */}
            <span
              className="absolute left-1/2 h-4 w-4 -translate-x-1/2 rounded-full bg-surface"
              style={{
                bottom: visible ? "-3px" : "14px",
                opacity: visible ? 1 : 0,
                transition: `bottom 300ms ${EASE_BACK}, opacity 160ms ${EASE_OUT}`,
              }}
            />
            {/* trailing droplet — lags so the goo reads as stretching */}
            <span
              className="absolute left-1/2 h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-surface"
              style={{
                bottom: visible ? "-9px" : "12px",
                opacity: visible ? 1 : 0,
                transition: `bottom 360ms ${EASE_BACK} 40ms, opacity 200ms ${EASE_OUT}`,
              }}
            />
          </div>
        ) : null}

        {/* crisp card */}
        <div className="relative overflow-hidden rounded-[12px] border border-line bg-surface/95 px-3.5 py-3 shadow-[0_12px_40px_-8px_rgba(0,0,0,0.7)] backdrop-blur-sm">
          {/* soft pink wash up top */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-12"
            style={{
              background:
                "radial-gradient(120% 100% at 50% 0%, color-mix(in srgb, var(--color-brand-200) 12%, transparent), transparent 70%)",
            }}
          />
          <div className="relative flex items-center gap-2">
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: ACCENT, boxShadow: `0 0 8px ${ACCENT}` }}
            />
            <span className="font-[family-name:var(--font-pixel)] text-[13px] font-semibold text-ink-100">
              {shown.name}
            </span>
            <span className="ml-auto font-mono text-[8.5px] uppercase tracking-[0.1em] text-ink-400 [font-family:var(--font-geist-mono),ui-monospace,monospace]">
              {shown.tag}
            </span>
          </div>
          <p className="relative mt-1.5 text-[11.5px] leading-relaxed text-ink-400">
            {shown.blurb}
          </p>
        </div>
      </div>

      {/* goo filter — defined once with the portal */}
      {move ? (
        <svg
          aria-hidden
          width="0"
          height="0"
          className="absolute"
          style={{ position: "absolute" }}
        >
          <defs>
            <filter id={GOO_ID}>
              <feGaussianBlur
                in="SourceGraphic"
                stdDeviation="6"
                result="blur"
              />
              <feColorMatrix
                in="blur"
                mode="matrix"
                values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -8"
                result="goo"
              />
              <feComposite in="SourceGraphic" in2="goo" operator="atop" />
            </filter>
          </defs>
        </svg>
      ) : null}
    </div>,
    document.body,
  );
}
