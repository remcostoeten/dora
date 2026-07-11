"use client";

import { useEffect, useRef, useState } from "react";

import { CardAura } from "./card-aura";
import { useGate } from "./use-scroll-motion";
import { OrmSwapper } from "@/components/format-swapper";
import { usePrefersReducedMotion } from "@/shared/hooks/use-prefers-reduced-motion";

/* ---------------------------------------------------------------------------
 * ORM Runner — a live LSP autocomplete demo that alternates between Drizzle and
 * Prisma on each loop. The query types itself out; a completion popup floats in
 * and the selection walks to its target (the Drizzle method / the Prisma model),
 * then a column popup lands on `plan` with type hints. Each accept inserts the
 * token, then the query runs and the rows stream in. The language badge and
 * heading flip with the active runner.
 * ------------------------------------------------------------------------- */
const C = {
  punct: "var(--color-ink-700)",
  method: "var(--color-brand-300)",
  fn: "var(--color-ink-400)",
  table: "var(--color-brand-600)",
  prop: "var(--color-brand-400)",
  id: "var(--color-ink-300)",
  string: "var(--color-brand-400)",
};

type TItem = { name: string; detail: string; kind: "M" | "F" };
type TPopup = { items: TItem[]; target: number };
type TSeg = { text: string; color: string; accept?: TPopup };

const METHODS: TItem[] = [
  { name: "delete", detail: "table => ...", kind: "M" },
  { name: "insert", detail: "into(table)", kind: "M" },
  { name: "query", detail: "RelationalQuery", kind: "M" },
  { name: "select", detail: "fields? => ...", kind: "M" },
  { name: "update", detail: "set(values)", kind: "M" },
];

const MODELS: TItem[] = [
  { name: "order", detail: "OrderDelegate", kind: "M" },
  { name: "post", detail: "PostDelegate", kind: "M" },
  { name: "user", detail: "UserDelegate", kind: "M" },
  { name: "session", detail: "SessionDelegate", kind: "M" },
];

const COLUMNS: TItem[] = [
  { name: "id", detail: "number", kind: "F" },
  { name: "email", detail: "string", kind: "F" },
  { name: "name", detail: "string", kind: "F" },
  { name: "plan", detail: "'free' | 'pro'", kind: "F" },
  { name: "createdAt", detail: "Date", kind: "F" },
];

type TLang = "drizzle" | "prisma";

// Each query is authored as ordered segments. Plain segments type out char by
// char; `accept` segments first float in a completion popup, walk the selection
// to `target`, then insert the whole token at once.
const DRIZZLE_SCRIPT: TSeg[] = [
  { text: "db", color: C.id },
  { text: ".", color: C.punct },
  { text: "select", color: C.method, accept: { items: METHODS, target: 3 } },
  { text: "()", color: C.punct },
  { text: "\n  .", color: C.punct },
  { text: "from", color: C.method },
  { text: "(", color: C.punct },
  { text: "users", color: C.table },
  { text: ")", color: C.punct },
  { text: "\n  .", color: C.punct },
  { text: "where", color: C.method },
  { text: "(", color: C.punct },
  { text: "eq", color: C.fn },
  { text: "(", color: C.punct },
  { text: "users.", color: C.table },
  { text: "plan", color: C.prop, accept: { items: COLUMNS, target: 3 } },
  { text: ", ", color: C.punct },
  { text: "'pro'", color: C.string },
  { text: "))", color: C.punct },
];

const PRISMA_SCRIPT: TSeg[] = [
  { text: "prisma", color: C.id },
  { text: ".", color: C.punct },
  { text: "user", color: C.table, accept: { items: MODELS, target: 2 } },
  { text: ".", color: C.punct },
  { text: "findMany", color: C.method },
  { text: "({", color: C.punct },
  { text: "\n  ", color: C.punct },
  { text: "where", color: C.prop },
  { text: ": { ", color: C.punct },
  { text: "plan", color: C.prop, accept: { items: COLUMNS, target: 3 } },
  { text: ": ", color: C.punct },
  { text: "'pro'", color: C.string },
  { text: " },", color: C.punct },
  { text: "\n})", color: C.punct },
];

const SCRIPTS: Record<TLang, TSeg[]> = {
  drizzle: DRIZZLE_SCRIPT,
  prisma: PRISMA_SCRIPT,
};

function charsFor(script: TSeg[]) {
  return script.flatMap((seg) =>
    [...seg.text].map((ch) => ({ ch, color: seg.color })),
  );
}

const CHARS: Record<TLang, { ch: string; color: string }[]> = {
  drizzle: charsFor(DRIZZLE_SCRIPT),
  prisma: charsFor(PRISMA_SCRIPT),
};

const ROWS = [
  { id: "42", email: "maya@dora.dev", plan: "pro" },
  { id: "57", email: "ravi@dora.dev", plan: "pro" },
  { id: "83", email: "lina@dora.dev", plan: "pro" },
];

const POPUP_WIDTH = 208;

type TPopupState = {
  items: TItem[];
  selected: number;
  top: number;
  left: number;
};
type TStage = "type" | "run" | "rows";

// Group a run of colored chars into the fewest possible spans.
function toSpans(slice: { ch: string; color: string }[]) {
  const spans: { text: string; color: string }[] = [];
  for (const c of slice) {
    const last = spans[spans.length - 1];
    if (last && last.color === c.color) last.text += c.ch;
    else spans.push({ text: c.ch, color: c.color });
  }
  return spans;
}

export function DrizzleRunnerCard({ animate }: { animate: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const caretRef = useRef<HTMLSpanElement>(null);
  const gate = useGate(ref);
  const reduced = usePrefersReducedMotion();
  const running = animate && gate.active;

  const [revealed, setRevealed] = useState(0);
  const [popup, setPopup] = useState<TPopupState | null>(null);
  const [stage, setStage] = useState<TStage>("type");
  const [rows, setRows] = useState(0);
  const [lang, setLang] = useState<TLang>("drizzle");

  useEffect(() => {
    if (!running) return;
    let cancelled = false;
    const sleep = (ms: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, ms));
    const frame = () =>
      new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    // Anchor the popup just under the caret, clamped inside the editor.
    function anchor(): { top: number; left: number } {
      const caret = caretRef.current;
      const editor = editorRef.current;
      if (!caret || !editor) return { top: 26, left: 14 };
      const max = editor.clientWidth - POPUP_WIDTH - 8;
      return {
        top: caret.offsetTop + caret.offsetHeight + 5,
        left: Math.max(8, Math.min(caret.offsetLeft, max)),
      };
    }

    async function play() {
      let mode: TLang = "drizzle";
      while (!cancelled) {
        setLang(mode);
        setStage("type");
        setRows(0);
        setPopup(null);
        setRevealed(0);
        await sleep(220);

        let pos = 0;
        for (const seg of SCRIPTS[mode]) {
          if (cancelled) return;
          if (seg.accept) {
            await frame();
            const at = anchor();
            for (let s = 0; s <= seg.accept.target; s++) {
              if (cancelled) return;
              setPopup({
                items: seg.accept.items,
                selected: s,
                top: at.top,
                left: at.left,
              });
              await sleep(s === 0 ? 150 : 70);
            }
            await sleep(210);
            if (cancelled) return;
            setPopup(null);
            pos += seg.text.length;
            setRevealed(pos);
            await sleep(100);
          } else {
            for (const ch of seg.text) {
              if (cancelled) return;
              pos += 1;
              setRevealed(pos);
              await sleep(ch === "\n" ? 46 : 15);
            }
          }
        }

        if (cancelled) return;
        setStage("run");
        await sleep(340);
        if (cancelled) return;
        setStage("rows");
        for (let r = 1; r <= ROWS.length; r++) {
          if (cancelled) return;
          setRows(r);
          await sleep(120);
        }
        await sleep(1400);
        mode = mode === "drizzle" ? "prisma" : "drizzle";
      }
    }

    play();
    return () => {
      cancelled = true;
    };
  }, [running]);

  const activeLang: TLang = running ? lang : "drizzle";
  const langChars = CHARS[activeLang];
  // Reduced-motion users see the finished query statically. Motion users get a
  // clean type-in from empty the moment the card scrolls into view — no flash
  // of a completed query that then wipes itself, which is what made the entrance
  // feel janky on first load.
  const shownChars = running ? revealed : reduced ? langChars.length : 0;
  const shownRows = running ? rows : reduced ? ROWS.length : 0;
  const langAccent = activeLang === "prisma" ? "var(--color-vendor-prisma)" : "var(--color-brand-300)";
  const isType = running && stage === "type";
  const isRun = running && stage === "run";
  const spans = toSpans(langChars.slice(0, shownChars));

  function status(): { color: string; label: string } {
    if (isRun) return { color: "var(--color-brand-300)", label: "running…" };
    if (isType) return { color: "var(--color-ink-600)", label: "autocomplete" };
    return { color: "var(--color-status-ok-dim)", label: `${shownRows} rows · 3 ms` };
  }
  const { color: statusColor, label: statusLabel } = status();

  return (
    <div ref={ref} className="relative h-full flex flex-col overflow-hidden">
      <CardAura active={running} />
      <div className="relative px-4 pt-5 pb-4">
        {/* editor — relative anchor for the caret + floating popup */}
        <div
          ref={editorRef}
          className="relative border border-line bg-surface-deeper/80 px-3 py-2.5"
        >
          {/* run flash */}
          {isRun ? (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "linear-gradient(90deg, color-mix(in srgb, var(--color-brand-300) 4%, transparent), color-mix(in srgb, var(--color-brand-300) 12%, transparent), color-mix(in srgb, var(--color-brand-300) 4%, transparent))",
                animation: "lspFlash 0.7s ease-out",
              }}
            />
          ) : null}

          <pre className="relative min-h-[49px] whitespace-pre font-mono text-[10.5px] leading-[1.55] [font-family:var(--font-geist-mono),ui-monospace,monospace]">
            {spans.map((s, i) => (
              <span key={i} style={{ color: s.color }}>
                {s.text}
              </span>
            ))}
            <span
              ref={caretRef}
              aria-hidden
              className="ml-px inline-block w-[1.5px] h-[1.05em] -mb-[0.18em] bg-brand-300"
              style={{
                opacity: isType ? 1 : 0,
                animation: isType ? "lspCaret 1s steps(1) infinite" : "none",
              }}
            />
          </pre>

          {/* LSP completion popup */}
          {running && popup ? (
            <div
              className="absolute z-20 overflow-hidden border border-line-strong bg-surface py-1 shadow-[0_10px_28px_rgba(0,0,0,0.55)]"
              style={{
                top: popup.top,
                left: popup.left,
                width: POPUP_WIDTH,
                animation: "lspPop 150ms ease-out",
              }}
            >
              {popup.items.map((item, i) => {
                const on = i === popup.selected;
                const badge =
                  item.kind === "M"
                    ? {
                        bg: "color-mix(in srgb, var(--color-brand-300) 16%, transparent)",
                        fg: "var(--color-brand-300)",
                      }
                    : {
                        bg: "color-mix(in srgb, var(--color-brand-600) 16%, transparent)",
                        fg: "var(--color-brand-600)",
                      };
                return (
                  <div
                    key={item.name}
                    className="flex items-center gap-2 px-2 py-[3px] font-mono text-[10px] [font-family:var(--font-geist-mono),ui-monospace,monospace]"
                    style={{
                      backgroundColor: on
                        ? "color-mix(in srgb, var(--color-brand-300) 12%, transparent)"
                        : "transparent",
                    }}
                  >
                    <span
                      className="flex h-3 w-3 shrink-0 items-center justify-center rounded-[2px] text-[7px] font-bold"
                      style={{
                        backgroundColor: badge.bg,
                        color: badge.fg,
                      }}
                    >
                      {item.kind}
                    </span>
                    <span
                      style={{
                        color: on ? "var(--color-brand-50)" : "var(--color-ink-300)",
                      }}
                    >
                      {item.name}
                    </span>
                    <span className="ml-auto truncate text-ink-700">
                      {item.detail}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>

        {/* run status */}
        <div className="mt-2 flex items-center gap-2 px-0.5">
          <span
            className="h-1.5 w-1.5 rounded-full transition-colors duration-300"
            style={{
              backgroundColor: statusColor,
              boxShadow: `0 0 8px ${statusColor}99`,
            }}
          />
          <span className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-ink-600 [font-family:var(--font-geist-mono),ui-monospace,monospace]">
            {statusLabel}
          </span>
          <span
            className="ml-auto rounded-[2px] border px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.12em] transition-colors duration-300 [font-family:var(--font-geist-mono),ui-monospace,monospace]"
            style={{
              color: langAccent,
              borderColor: `${langAccent}55`,
              backgroundColor: `${langAccent}14`,
            }}
          >
            {activeLang}
          </span>
        </div>

        {/* results */}
        <div className="mt-1.5 overflow-hidden border border-line bg-surface-deep/70">
          <div className="grid grid-cols-[2rem_minmax(0,1fr)_2.6rem] gap-1 border-b border-line px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.1em] text-ink-700 [font-family:var(--font-geist-mono),ui-monospace,monospace]">
            <span>id</span>
            <span>email</span>
            <span className="text-right">plan</span>
          </div>
          {ROWS.map((row, i) => {
            const shown = shownRows > i;
            return (
              <div
                key={row.id}
                className="grid grid-cols-[2rem_minmax(0,1fr)_2.6rem] items-center gap-1 px-2.5 py-1 font-mono text-[10px] [font-family:var(--font-geist-mono),ui-monospace,monospace]"
                style={{
                  opacity: shown ? 1 : 0,
                  transform: shown ? "translateY(0)" : "translateY(4px)",
                  transition:
                    "opacity 320ms ease, transform 360ms cubic-bezier(0.34,1.56,0.64,1)",
                }}
              >
                <span className="text-ink-600 tabular-nums">{row.id}</span>
                <span className="truncate text-ink-300">{row.email}</span>
                <span className="text-right text-brand-300">{row.plan}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="relative px-5 pt-3 pb-10">
        <h3 className="mb-1 font-pixel text-sm font-[500] text-ink-200">
          <OrmSwapper /> support
        </h3>
        <p className="text-xs text-ink-500 leading-relaxed">
          Prefer an ORM over raw SQL? Run type-safe Drizzle or Prisma Client
          queries — context-aware autocomplete and a live SQL preview, right in
          the query builder.
        </p>
      </div>
    </div>
  );
}
