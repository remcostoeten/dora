"use client"

import type React from "react"

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react"

type Props = {
  value: string
  onComplete: (value: string) => void
  onCancel: () => void
}

export type EditorRef = {
  focus: () => void
}

export const TextEditor = forwardRef<EditorRef, Props>(function TextEditor({ value, onComplete, onCancel }, ref) {
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
      onComplete(text || "NULL")
    } else if (e.key === "Escape") {
      e.preventDefault()
      onCancel()
    } else if (e.key === "Tab") {
      e.preventDefault()
      onComplete(text || "NULL")
    }
  }

  return (
    <input
      ref={inputRef}
      type="text"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => onComplete(text || "NULL")}
      onKeyDown={handleKey}
      className="w-full bg-transparent outline-none"
    />
  )
})
