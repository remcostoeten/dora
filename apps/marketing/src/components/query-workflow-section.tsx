"use client";

import { useEffect, useRef, useState } from "react";

import { CornerTick } from "@/components/corner-tick";
import { AIAssistantCard } from "@/components/features/ai-assistant-card";
import { DrizzleRunnerCard } from "@/components/features/drizzle-runner-card";
import { ScrollReveal } from "@/components/scroll-reveal";
import { usePageVisible } from "@/shared/hooks/use-page-visible";
import { usePrefersReducedMotion } from "@/shared/hooks/use-prefers-reduced-motion";

const CELL_CLASS =
  "min-h-[340px] border-r border-b border-[#2b252c] overflow-hidden transition-colors duration-[450ms] ease-out hover:bg-[rgba(245,192,192,0.06)]";
const REVEAL_CLASS = "flex h-full w-full";

/* ---------------------------------------------------------------------------
 * Query Workflow — a standalone row sitting above the feature grid. Where the
 * grid below answers "what can it browse", this answers "how you write the
 * query": describe it in English or run type-safe Drizzle, live.
 * ------------------------------------------------------------------------- */
export function QueryWorkflowSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const [isInView, setIsInView] = useState(false);
  const pageVisible = usePageVisible();
  const reducedMotion = usePrefersReducedMotion();
  const animate = isInView && pageVisible && !reducedMotion;

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setIsInView(entry.isIntersecting),
      { rootMargin: "160px 0px", threshold: 0.1 },
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative w-full border-l border-t border-[#3a3138]"
    >
      <CornerTick className="-left-px -top-px -translate-x-1/2 -translate-y-1/2" />
      <CornerTick className="-right-px -top-px translate-x-1/2 -translate-y-1/2" />
      <CornerTick className="-bottom-px -left-px -translate-x-1/2 translate-y-1/2" />
      <CornerTick className="-bottom-px -right-px translate-x-1/2 translate-y-1/2" />

      <div className="px-6 sm:px-8 py-12 border-b border-r border-[#2b252c]">
        <ScrollReveal delay={40}>
          <h2 className="text-2xl text-[#7a7a7a] font-light italic mb-1 font-[family-name:var(--font-pixel)]">
            Aww, is SQL to hard for you?
          </h2>
          <h3 className="text-balance text-3xl text-[#f0f0f0] font-semibold font-[family-name:var(--font-pixel)]">
            Run queries via Drizzle
            <br /> or context aware LLM
          </h3>
        </ScrollReveal>
      </div>

      {/* Two authoring cards — full-width row */}
      <div className="relative grid grid-cols-1 md:grid-cols-2">
        {/* divider square between the two cards */}
        <CornerTick className="hidden md:block left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" />
        <CornerTick className="hidden md:block left-1/2 top-0 -translate-x-1/2 -translate-y-1/2" />
        <CornerTick className="hidden md:block left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2" />
        <div className={CELL_CLASS}>
          <ScrollReveal className={REVEAL_CLASS} delay={0}>
            <AIAssistantCard animate={animate} />
          </ScrollReveal>
        </div>
        <div className={CELL_CLASS}>
          <ScrollReveal className={REVEAL_CLASS} delay={90}>
            <DrizzleRunnerCard animate={animate} />
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
