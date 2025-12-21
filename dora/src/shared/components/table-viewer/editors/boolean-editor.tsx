"use client"

import { useEffect } from "react"
import { Check, X } from "lucide-react"
import { cn } from "@/shared/utils"

type Props = {
  value: string
  onComplete: (value: string) => void
  onCancel: () => void
}

export function BooleanEditor({ value, onComplete, onCancel }: Props) {
  const cycle = () => {
    if (value === "NULL") {
      onComplete("true")
    } else if (value === "true") {
      onComplete("false")
    } else {
      onComplete("NULL")
    }
  }

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault()
        cycle()
      } else if (e.key === "Escape") {
        e.preventDefault()
        onCancel()
      }
    }

    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [value])

  return (
    <button
      onClick={cycle}
      className={cn(
        "flex w-full items-center gap-1.5 outline-none",
        value === "true" && "text-emerald-400",
        value === "false" && "text-red-400",
        value === "NULL" && "text-muted-foreground/40",
      )}
    >
      {value === "true" && <Check className="h-3.5 w-3.5" />}
      {value === "false" && <X className="h-3.5 w-3.5" />}
      <span>{value === "NULL" ? "NULL" : value}</span>
    </button>
  )
}
