"use client";

import { useEffect, useRef, useState } from "react";

import { CardAura } from "./card-aura";
import { useGate } from "./use-scroll-motion";

/* ---------------------------------------------------------------------------
 * File Query — drop a CSV and a Parquet file, and they become tables you can
 * JOIN. Two file chips drop in, the query types out, then aggregated rows
 * stream from the join. Mirrors the Drizzle card's staged-loop choreography.
 * ------------------------------------------------------------------------- */
const C = {
  punct: "var(--color-ink-700)",
  kw: "var(--color-brand-300)",
  fn: "var(--color-ink-400)",
  table: "var(--color-brand-600)",
  col: "var(--color-brand-400)",
  id: "var(--color-ink-300)",
};

type TSeg = { text: string; color: string };

const SCRIPT: TSeg[] = [
  { text: "SELECT", color: C.kw },
  { text: " s.region, ", color: C.col },
  { text: "SUM", color: C.fn },
  { text: "(s.revenue)", color: C.col },
  { text: "\nFROM ", color: C.kw },
  { text: "sales", color: C.table },
  { text: " s\nJOIN ", color: C.kw },
  { text: "customers", color: C.table },
  { text: " c ", color: C.id },
  { text: "USING", color: C.kw },
  { text: " (id)\n", color: C.punct },
  { text: "GROUP BY", color: C.kw },
  { text: " s.region", color: C.col },
];

const CHARS = SCRIPT.flatMap((seg) =>
  [...seg.text].map((ch) => ({ ch, color: seg.color })),
);

const FILES = [
  { name: "sales.csv", kind: "CSV", rows: "1.2M" },
  { name: "customers.parquet", kind: "PARQUET", rows: "84K" },
];

const ROWS = [
  { region: "EMEA", revenue: "$4.18M" },
  { region: "AMER", revenue: "$3.92M" },
  { region: "APAC", revenue: "$2.55M" },
];

type TStage = "drop" | "type" | "run" | "rows";

function toSpans(slice: { ch: string; color: string }[]) {
  const spans: { text: string; color: string }[] = [];
  for (const c of slice) {
    const last = spans[spans.length - 1];
    if (last && last.color === c.color) last.text += c.ch;
    else spans.push({ text: c.ch, color: c.color });
  }
  return spans;
}

export function FileQueryCard({ animate }: { animate: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const gate = useGate(ref);
  const running = animate && gate.active;

  const [stage, setStage] = useState<TStage>("drop");
  const [dropped, setDropped] = useState(0);
  const [revealed, setRevealed] = useState(0);
  const [rows, setRows] = useState(0);

  useEffect(() => {
    if (!running) return;
    let cancelled = false;
    const sleep = (ms: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, ms));

    async function play() {
      while (!cancelled) {
        setStage("drop");
        setDropped(0);
        setRevealed(0);
        setRows(0);
        await sleep(420);

        for (let f = 1; f <= FILES.length; f++) {
          if (cancelled) return;
          setDropped(f);
          await sleep(360);
        }
        await sleep(360);

        if (cancelled) return;
        setStage("type");
        for (let i = 1; i <= CHARS.length; i++) {
          if (cancelled) return;
          setRevealed(i);
          await sleep(CHARS[i - 1]?.ch === "\n" ? 90 : 26);
        }

        if (cancelled) return;
        setStage("run");
        await sleep(720);

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

  const shownFiles = running ? dropped : FILES.length;
  const shownChars = running ? revealed : CHARS.length;
  const shownRows = running ? rows : ROWS.length;
  const isRun = running && stage === "run";
  const spans = toSpans(CHARS.slice(0, shownChars));

  function status(): { color: string; label: string } {
    if (isRun) return { color: "var(--color-brand-300)", label: "scanning files…" };
    if (running && stage === "type")
      return { color: "var(--color-ink-600)", label: "in-memory · DuckDB" };
    if (running && stage === "drop")
      return { color: "var(--color-ink-600)", label: "reading schema…" };
    return { color: "var(--color-status-ok-dim)", label: `${shownRows} rows · 11 ms` };
  }
  const { color: statusColor, label: statusLabel } = status();

  return (
    <div ref={ref} className="relative flex h-full flex-col overflow-hidden">
      <CardAura active={running} />
      <div className="relative px-4 pb-4 pt-5">
        {/* file dropzone */}
        <div className="flex flex-col gap-1.5 border border-dashed border-line-strong bg-surface-deeper/70 px-2.5 py-2.5">
          {FILES.map((file, i) => {
            const shown = shownFiles > i;
            return (
              <div
                key={file.name}
                className="flex items-center gap-2 font-mono text-[10px] [font-family:var(--font-geist-mono),ui-monospace,monospace]"
                style={{
                  opacity: shown ? 1 : 0,
                  transform: shown ? "translateY(0)" : "translateY(-6px)",
                  transition:
                    "opacity 300ms ease, transform 340ms cubic-bezier(0.34,1.56,0.64,1)",
                }}
              >
                <span
                  className="flex h-3.5 shrink-0 items-center rounded-[2px] px-1 text-[7px] font-bold tracking-[0.06em]"
                  style={{
                    backgroundColor: "color-mix(in srgb, var(--color-syntax-number) 14%, transparent)",
                    color: "var(--color-syntax-number)",
                  }}
                >
                  {file.kind}
                </span>
                <span className="text-ink-300">{file.name}</span>
                <span className="ml-auto text-ink-700">{file.rows} rows</span>
              </div>
            );
          })}
        </div>

        {/* query */}
        <div className="relative mt-2 border border-line bg-surface-deeper/80 px-3 py-2.5">
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
          <pre className="relative min-h-[58px] whitespace-pre font-mono text-[10.5px] leading-[1.55] [font-family:var(--font-geist-mono),ui-monospace,monospace]">
            {spans.map((s, i) => (
              <span key={i} style={{ color: s.color }}>
                {s.text}
              </span>
            ))}
          </pre>
        </div>

        {/* status */}
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
        </div>

        {/* results */}
        <div className="mt-1.5 overflow-hidden border border-line bg-surface-deep/70">
          <div className="grid grid-cols-[minmax(0,1fr)_4.5rem] gap-1 border-b border-line px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.1em] text-ink-700 [font-family:var(--font-geist-mono),ui-monospace,monospace]">
            <span>region</span>
            <span className="text-right">revenue</span>
          </div>
          {ROWS.map((row, i) => {
            const shown = shownRows > i;
            return (
              <div
                key={row.region}
                className="grid grid-cols-[minmax(0,1fr)_4.5rem] items-center gap-1 px-2.5 py-1 font-mono text-[10px] [font-family:var(--font-geist-mono),ui-monospace,monospace]"
                style={{
                  opacity: shown ? 1 : 0,
                  transform: shown ? "translateY(0)" : "translateY(4px)",
                  transition:
                    "opacity 320ms ease, transform 360ms cubic-bezier(0.34,1.56,0.64,1)",
                }}
              >
                <span className="truncate text-ink-300">{row.region}</span>
                <span className="text-right text-brand-300">{row.revenue}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="relative px-5 pb-10 pt-3">
        <h3 className="mb-1 font-pixel text-sm font-[500] text-ink-200">
          Query files like tables
        </h3>
        <p className="text-xs leading-relaxed text-ink-500">
          Drop a CSV, Parquet, or JSON file and Dora opens it as a table. Run
          SQL, even JOIN across files, powered by an embedded DuckDB engine.
        </p>
      </div>
    </div>
  );
}
