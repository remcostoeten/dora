import Link from "next/link";

import { CornerTick } from "@/components/corner-tick";
import { SectionFrame } from "@/components/section-frame";
import { AIAssistantCard } from "@/components/features/ai-assistant-card";
import { DrizzleRunnerCard } from "@/components/features/drizzle-runner-card";
import { OrmSwapper } from "@/components/format-swapper";
import { getFeaturePath } from "@/core/config/features";

const CELL_CLASS =
  "relative min-h-[340px] scroll-mt-28 border-r border-b border-line overflow-hidden transition-colors duration-[450ms] ease-out hover:bg-[rgba(245,192,192,0.06)]";

export function QueryWorkflowSection() {
  return (
    <section className="relative w-full">
      <SectionFrame />

      <div className="px-6 sm:px-8 py-12 border-b border-r border-line">
        <h2 className="text-2xl text-ink-600 font-light italic mb-1 font-[family-name:var(--font-pixel)]">
          Aww, is SQL to hard for you?
        </h2>
        <h3 className="text-balance text-3xl text-ink-100 font-semibold font-[family-name:var(--font-pixel)]">
          Run queries via <OrmSwapper />
          <br /> or context aware LLM
        </h3>
      </div>

      <div className="relative grid grid-cols-1 md:grid-cols-2">
        <CornerTick className="hidden md:block left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" />
        <CornerTick className="hidden md:block left-1/2 top-0 -translate-x-1/2 -translate-y-1/2" />
        <CornerTick className="hidden md:block left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2" />
        <div id="feature-ai-assistant" className={CELL_CLASS}>
          <AIAssistantCard animate />
          <Link
            className="absolute bottom-4 right-4 z-10 text-[11px] text-accent-violet transition-colors hover:text-accent-pink"
            href={getFeaturePath("ai-assistant")}
          >
            Learn more →
          </Link>
        </div>
        <div id="feature-drizzle-runner" className={CELL_CLASS}>
          <DrizzleRunnerCard animate />
          <div className="absolute bottom-4 right-4 z-10 flex items-center gap-3 text-[11px]">
            <Link
              className="text-accent-violet transition-colors hover:text-accent-pink"
              href={getFeaturePath("drizzle-runner")}
            >
              Drizzle →
            </Link>
            <Link
              className="text-accent-violet transition-colors hover:text-accent-pink"
              href={getFeaturePath("prisma-runner")}
            >
              Prisma →
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
