"use client"

import type React from "react"

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react"
import type { EditorRef } from "./text-editor"

type Props = {
  value: string
  min?: number
  max?: number
  onComplete: (value: string) => void
  onCancel: () => void
}

export const NumberEditor = forwardRef<EditorRef, Props>(function NumberEditor(
  { value, min, max, onComplete, onCancel },
  ref,
) {
  const [text, setText] = useState(value === "NULL" ? "" : value)
  const inputRef = useRef<HTMLInputElement>(null)

  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
  }))

  useEffect(() => {
    inputRef.current?.select()
  }, [])

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault()
      const num = Number.parseFloat(text)
      if (!text || isNaN(num)) {
        onComplete("NULL")
      } else {
        const clamped = Math.max(min ?? Number.NEGATIVE_INFINITY, Math.min(max ?? Number.POSITIVE_INFINITY, num))
        onComplete(String(clamped))
      }
    } else if (e.key === "Escape") {
      e.preventDefault()
      onCancel()
    } else if (e.key === "Tab") {
      e.preventDefault()
      onComplete(text || "NULL")
    }
  }

  const handleChange = (val: string) => {
    if (val === "" || val === "-" || !isNaN(Number(val))) {
      setText(val)
    }
  }

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="numeric"
      value={text}
      onChange={(e) => handleChange(e.target.value)}
      onBlur={() => onComplete(text || "NULL")}
      onKeyDown={handleKey}
      className="w-full bg-transparent outline-none tabular-nums"
    />
  )
})
