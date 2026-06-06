"use client";

import { useEffect, useRef, useState } from "react";

import { CardAura } from "./card-aura";
import { useGate } from "./use-scroll-motion";

/* ---------------------------------------------------------------------------
 * Drizzle Runner — a live LSP autocomplete demo. The query types itself out;
 * at `db.` a method-completion popup floats in and the selection walks down to
 * `select`, at `users.` a column popup lands on `plan` (with type hints). Each
 * accept inserts the token, then the query runs and the rows stream in. Loops.
 * ------------------------------------------------------------------------- */
const C = {
  punct: "#6a6a6a",
  method: "#e3b2b3",
  fn: "#9a9a9a",
  table: "#ad8eb6",
  prop: "#c9a3b5",
  id: "#cfcfcf",
  string: "#c9a3b5",
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

const COLUMNS: TItem[] = [
  { name: "id", detail: "number", kind: "F" },
  { name: "email", detail: "string", kind: "F" },
  { name: "name", detail: "string", kind: "F" },
  { name: "plan", detail: "'free' | 'pro'", kind: "F" },
  { name: "createdAt", detail: "Date", kind: "F" },
];

// The query is authored as ordered segments. Plain segments type out char by
// char; `accept` segments first float in a completion popup, walk the selection
// to `target`, then insert the whole token at once.
const SCRIPT: TSeg[] = [
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

const CHARS: { ch: string; color: string }[] = SCRIPT.flatMap((seg) =>
  [...seg.text].map((ch) => ({ ch, color: seg.color })),
);

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
  const running = animate && gate.active;

  const [revealed, setRevealed] = useState(0);
  const [popup, setPopup] = useState<TPopupState | null>(null);
  const [stage, setStage] = useState<TStage>("type");
  const [rows, setRows] = useState(0);

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
      while (!cancelled) {
        setStage("type");
        setRows(0);
        setPopup(null);
        setRevealed(0);
        await sleep(560);

        let pos = 0;
        for (const seg of SCRIPT) {
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
              await sleep(s === 0 ? 260 : 135);
            }
            await sleep(430);
            if (cancelled) return;
            setPopup(null);
            pos += seg.text.length;
            setRevealed(pos);
            await sleep(200);
          } else {
            for (const ch of seg.text) {
              if (cancelled) return;
              pos += 1;
              setRevealed(pos);
              await sleep(ch === "\n" ? 95 : 30);
            }
          }
        }

        if (cancelled) return;
        setStage("run");
        await sleep(700);
        if (cancelled) return;
        setStage("rows");
        for (let r = 1; r <= ROWS.length; r++) {
          if (cancelled) return;
          setRows(r);
          await sleep(240);
        }
        await sleep(2600);
      }
    }

    play();
    return () => {
      cancelled = true;
    };
  }, [running]);

  // Static fallback (off-screen / reduced motion): show the finished query.
  const shownChars = running ? revealed : CHARS.length;
  const shownRows = running ? rows : ROWS.length;
  const isType = running && stage === "type";
  const isRun = running && stage === "run";
  const spans = toSpans(CHARS.slice(0, shownChars));

  function status(): { color: string; label: string } {
    if (isRun) return { color: "#e3b2b3", label: "running…" };
    if (isType) return { color: "#7a7a7a", label: "autocomplete" };
    return { color: "#4a7a55", label: `${shownRows} rows · 3 ms` };
  }
  const { color: statusColor, label: statusLabel } = status();

  return (
    <div ref={ref} className="relative h-full flex flex-col overflow-hidden">
      <CardAura active={running} />
      <div className="relative flex-1 px-4 pt-5">
        {/* editor — relative anchor for the caret + floating popup */}
        <div
          ref={editorRef}
          className="relative border border-[#2b252c] bg-[#0d0a0f]/80 px-3 py-2.5"
        >
          {/* run flash */}
          {isRun ? (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "linear-gradient(90deg, rgba(227,178,179,0.04), rgba(227,178,179,0.12), rgba(227,178,179,0.04))",
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
              className="ml-px inline-block w-[1.5px] h-[1.05em] -mb-[0.18em] bg-[#e3b2b3]"
              style={{
                opacity: isType ? 1 : 0,
                animation: isType ? "lspCaret 1s steps(1) infinite" : "none",
              }}
            />
          </pre>

          {/* LSP completion popup */}
          {running && popup ? (
            <div
              className="absolute z-20 overflow-hidden border border-[#3a3138] bg-[#16121a] py-1 shadow-[0_10px_28px_rgba(0,0,0,0.55)]"
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
                        bg: "rgba(227,178,179,0.16)",
                        fg: "#e3b2b3",
                      }
                    : {
                        bg: "rgba(173,142,182,0.16)",
                        fg: "#ad8eb6",
                      };
                return (
                  <div
                    key={item.name}
                    className="flex items-center gap-2 px-2 py-[3px] font-mono text-[10px] [font-family:var(--font-geist-mono),ui-monospace,monospace]"
                    style={{
                      backgroundColor: on
                        ? "rgba(227,178,179,0.12)"
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
                        color: on ? "#f0e3e3" : "#cfcfcf",
                      }}
                    >
                      {item.name}
                    </span>
                    <span className="ml-auto truncate text-[#6a6a6a]">
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
          <span className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-[#7a7a7a] [font-family:var(--font-geist-mono),ui-monospace,monospace]">
            {statusLabel}
          </span>
        </div>

        {/* results */}
        <div className="mt-1.5 overflow-hidden border border-[#2b252c] bg-[#100d12]/70">
          <div className="grid grid-cols-[2rem_minmax(0,1fr)_2.6rem] gap-1 border-b border-[#2b252c] px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.1em] text-[#6a6a6a] [font-family:var(--font-geist-mono),ui-monospace,monospace]">
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
                <span className="text-[#7a7a7a] tabular-nums">{row.id}</span>
                <span className="truncate text-[#cfcfcf]">{row.email}</span>
                <span className="text-right text-[#e3b2b3]">{row.plan}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="relative px-5 pb-5 pt-3">
        <h3 className="mb-1 font-pixel text-sm font-[500] text-[#e0e0e0]">
          Drizzle support
        </h3>
        <p className="text-xs text-[#8a8a8a] leading-relaxed">
          Prefer Drizzle over raw SQL? Switch to Drizzle mode — context-aware
          autocomplete, right in the query builder.
        </p>
      </div>
    </div>
  );
}
