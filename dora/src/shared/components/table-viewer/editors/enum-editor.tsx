"use client"

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Check } from "lucide-react"
import { cn } from "@/shared/utils"
import type { EditorRef } from "./text-editor"

type Props = {
  value: string
  options: string[]
  onComplete: (value: string) => void
  onCancel: () => void
}

export const EnumEditor = forwardRef<EditorRef, Props>(function EnumEditor(
  { value, options, onComplete, onCancel },
  ref,
) {
  const [selected, setSelected] = useState(value === "NULL" ? "" : value)
  const containerRef = useRef<HTMLDivElement>(null)

  useImperativeHandle(ref, () => ({
    focus: () => containerRef.current?.focus(),
  }))

  const handleSelect = (val: string) => {
    setSelected(val)
    onComplete(val)
  }

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        onCancel()
      }
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [onCancel])

  return (
    <div ref={containerRef} className="w-full">
      <Command className="border-0">
        <CommandInput placeholder="Search..." className="h-8" />
        <CommandList className="max-h-48">
          <CommandEmpty>No option found.</CommandEmpty>
          <CommandGroup>
            {options.map((opt) => (
              <CommandItem key={opt} value={opt} onSelect={() => handleSelect(opt)} className="text-xs">
                <Check className={cn("mr-2 h-3 w-3", selected === opt ? "opacity-100" : "opacity-0")} />
                {opt}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </div>
  )
})
