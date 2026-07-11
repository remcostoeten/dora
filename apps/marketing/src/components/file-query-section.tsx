"use client";

import type { ReactNode } from "react";

import { CornerTick } from "@/components/corner-tick";
import { SectionFrame } from "@/components/section-frame";
import { FileQueryCard } from "@/components/features/file-query-card";
import { DuckMaterialize } from "@/components/duck-materialize";
import { FormatSwapper } from "@/components/format-swapper";

const CELL_CLASS =
  "relative min-h-[340px] scroll-mt-28 border-r border-b border-line overflow-hidden transition-colors duration-[450ms] ease-out hover:bg-brand-200/6";

function Ext({ children }: { children: string }) {
  return (
    <code className="rounded-[3px] border border-line bg-surface-deeper px-1 py-px font-mono text-[11px] text-brand-300 [font-family:var(--font-geist-mono),ui-monospace,monospace]">
      {children}
    </code>
  );
}

const POINTS: { head: string; body: ReactNode }[] = [
  {
    head: "No import step",
    body: (
      <>
        Point Dora at a <Ext>.csv</Ext>, <Ext>.tsv</Ext>, <Ext>.parquet</Ext>,{" "}
        <Ext>.json</Ext>, or <Ext>.ndjson</Ext> file. It reads the schema in
        place.
      </>
    ),
  },
  {
    head: "Real SQL, real joins",
    body: "Filter, aggregate, and JOIN across several dropped files in one query, with results in table or JSON view.",
  },
  {
    head: "Read-only by design",
    body: "Your source files are never modified. Materialize the result into any connected database when you're ready.",
  },
];

export function FileQuerySection() {
  return (
    <section className="relative w-full">
      <SectionFrame />

      <div className="border-b border-r border-line px-6 py-12 sm:px-8">
        <h2 className="mb-1 font-[family-name:var(--font-pixel)] text-2xl font-light italic text-ink-600">
          That <FormatSwapper /> doesn&apos;t need a database first.
        </h2>
        <h3 className="text-balance font-[family-name:var(--font-pixel)] text-3xl font-semibold text-ink-100">
          Drop a file. Query it like a table.
        </h3>
      </div>

      <div className="relative grid grid-cols-1 md:grid-cols-2">
        <CornerTick className="hidden md:block left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" />
        <CornerTick className="hidden md:block left-1/2 top-0 -translate-x-1/2 -translate-y-1/2" />
        <CornerTick className="hidden md:block left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2" />

        <div className={`${CELL_CLASS} flex`}>
          <div className="flex h-full w-full flex-col justify-center gap-5 px-6 py-10 sm:px-8">
            {POINTS.map((point) => (
              <div key={point.head} className="flex gap-3">
                <span
                  aria-hidden
                  className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: "var(--color-brand-200)" }}
                />
                <div>
                  <p className="font-[family-name:var(--font-pixel)] text-[13px] font-medium text-ink-200">
                    {point.head}
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-ink-500">
                    {point.body}
                  </p>
                </div>
              </div>
            ))}

            <div className="flex gap-3">
              <span
                aria-hidden
                className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: "var(--color-brand-200)" }}
              />
              <div className="min-w-0 flex-1">
                <p className="font-[family-name:var(--font-pixel)] text-[13px] font-medium text-ink-200">
                  Keep it as DuckDB
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-ink-500">
                  Files open as in-memory views. When one&apos;s worth
                  keeping, save the session to a real, editable{" "}
                  <Ext>.duckdb</Ext> file on disk.
                </p>
                <DuckMaterialize />
              </div>
            </div>
          </div>
        </div>

        <div className={`${CELL_CLASS} flex`}>
          <FileQueryCard animate />
        </div>
      </div>
    </section>
  );
}
