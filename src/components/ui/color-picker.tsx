'use client'

import { useState } from 'react'
import { Palette } from 'lucide-react'

export const CONNECTION_COLORS = [
  { name: 'Blue', hue: 250 },
  { name: 'Purple', hue: 280 },
  { name: 'Violet', hue: 300 },
  { name: 'Rose', hue: 350 },
  { name: 'Red', hue: 25 },
  { name: 'Orange', hue: 45 },
  { name: 'Amber', hue: 65 },
  { name: 'Green', hue: 145 },
  { name: 'Teal', hue: 180 },
  { name: 'Cyan', hue: 200 },
  { name: 'Gray', hue: -1 },
  { name: 'None', hue: null },
] as const

type Props   = {
  selectedColor?: number | null
  onColorChange: (color: number | null) => void
  trigger?: React.ReactNode
  className?: string
}

export function ConnectionColorPicker({ 
  selectedColor, 
  onColorChange, 
  trigger,
  className = ""
}: Props) {
  const [isOpen, setIsOpen] = useState(false)

  const handleColorSelect = (hue: number | null) => {
    onColorChange(hue)
    setIsOpen(false)
  }

  const defaultTrigger = (
    <button
      type="button"
      className={`inline-flex items-center gap-2 px-3 py-2 text-sm border rounded-md hover:bg-accent transition-colors ${className}`}
      onClick={() => setIsOpen(!isOpen)}
    >
      <Palette className="h-4 w-4" />
      <span>Color</span>
      {selectedColor !== undefined && selectedColor !== null && (
        <div 
          className="h-3 w-3 rounded-full border border-border/50"
          style={{
            backgroundColor: selectedColor < 0 ? 'oklch(0.72 0 0)' : `oklch(0.7 0.24 ${selectedColor})`,
          }}
        />
      )}
    </button>
  )

  return (
    <div className="relative">
      {trigger || defaultTrigger}
      
      {isOpen && (
        <div className="fixed inset-0 z-50" onClick={() => setIsOpen(false)}>
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />
          <div 
            className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-card border border-border rounded-lg shadow-xl p-4 z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="grid grid-cols-6 gap-2">
              {CONNECTION_COLORS.map((color) => (
                <button
                  key={color.name}
                  onClick={() => handleColorSelect(color.hue)}
                  className={`relative h-8 w-8 rounded-full transition-all duration-200 hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                    selectedColor === color.hue ? 'ring-2 ring-offset-2 ring-foreground/50' : ''
                  }`}
                  style={{
                    backgroundColor:
                      color.hue === null
                        ? 'var(--muted)'
                        : color.hue < 0
                          ? 'oklch(0.72 0 0)'
                          : `oklch(0.7 0.24 ${color.hue})`,
                    border: color.hue === null ? '2px dashed var(--border)' : 'none'
                  }}
                  title={color.name}
                >
                  {selectedColor === color.hue && (
                    <svg className="absolute inset-0 m-auto h-4 w-4 text-white drop-shadow-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  {color.hue === null && (
                    <span className="text-xs text-muted-foreground">None</span>
                  )}
                </button>
              ))}
            </div>
            
            <div className="mt-3 text-center">
              <button
                onClick={() => setIsOpen(false)}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}