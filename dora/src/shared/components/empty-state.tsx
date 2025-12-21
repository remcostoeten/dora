"use client"

import { ReactNode, useId } from "react"
import type { LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"

type props = {
  icon: LucideIcon
  title: string
  desc: string
  act?: {
    label: string
    onPress: () => void
  }
  act2?: {
    label: string
    onPress: () => void
  }
  children?: ReactNode
}

export function EmptyState({ icon: Icon, title, desc, act, act2, children }: props) {
  const titleId = useId()
  const descId = useId()

  return (
    <section
      role="region"
      aria-labelledby={titleId}
      aria-describedby={descId}
      className="flex h-full w-full items-center justify-center"
    >
      <div className="flex max-w-sm flex-col items-center gap-4 px-6 py-10 text-center">
        <div
          aria-hidden="true"
          className="flex h-20 w-20 items-center justify-center rounded-xl bg-muted"
        >
          <Icon strokeWidth={1.5} className="h-10 w-10 text-muted-foreground" />
        </div>

        <h2 id={titleId} className="text-xl font-semibold text-foreground">
          {title}
        </h2>

        <p id={descId} className="text-sm text-muted-foreground">
          {desc}
        </p>

        {(act || act2) && (
          <div className="flex gap-3">
            {act && (
              <Button
                type="button"
                autoFocus
                onClick={act.onPress}
                className="focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                {act.label}
              </Button>
            )}
            {act2 && (
              <Button
                type="button"
                variant="outline"
                onClick={act2.onPress}
                className="focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                {act2.label}
              </Button>
            )}
          </div>
        )}

        {children}
      </div>
    </section>
  )
}
