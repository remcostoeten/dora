'use client'

import { Minus, Square, X, Play, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ThemeSwitcher } from '@/components/shared/theme-switcher'
import { minimizeWindow, maximizeWindow, closeWindow } from '@/core/tauri'
import { isTauri } from '@/core/tauri'

type Props = {
  connectionName?: string
  connected?: boolean
  isConnecting?: boolean
  hasUnsavedChanges?: boolean
  onRunQuery?: () => void
  onSaveScript?: () => void
}

export function TitleBar({
  connectionName,
  connected = false,
  isConnecting = false,
  hasUnsavedChanges = false,
  onRunQuery,
  onSaveScript,
}: Props) {
  async function handleMinimize() {
    try {
      await minimizeWindow()
    } catch (error) {
      console.error('Failed to minimize window:', error)
    }
  }

  async function handleMaximize() {
    try {
      await maximizeWindow()
    } catch (error) {
      console.error('Failed to maximize window:', error)
    }
  }

  async function handleClose() {
    try {
      await closeWindow()
    } catch (error) {
      console.error('Failed to close window:', error)
    }
  }

  return (
    <div
      className="flex h-12 items-center justify-between border-b border-border bg-background px-4"
      data-tauri-drag-region
    >
      <div className="flex items-center gap-4">
        <div className="text-sm font-semibold">Dora</div>
        {connectionName && (
          <>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div
                className={`h-2 w-2 rounded-full ${isConnecting
                  ? 'bg-warning animate-pulse'
                  : connected
                    ? 'bg-success'
                    : 'bg-error'
                  }`}
              />
              {connectionName}
            </div>
          </>
        )}
        {hasUnsavedChanges && (
          <div className="text-xs text-warning">Unsaved changes</div>
        )}
      </div>

      <div className="flex items-center gap-2">
        {onRunQuery && (
          <Button size="sm" onClick={onRunQuery} className="gap-1">
            <Play className="h-4 w-4" />
            Run
          </Button>
        )}
        {onSaveScript && (
          <Button
            size="sm"
            variant="secondary"
            onClick={onSaveScript}
            className="gap-1"
          >
            <Save className="h-4 w-4" />
            Save
          </Button>
        )}
        <ThemeSwitcher />
        {isTauri() && (
          <div className="ml-2 flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              onClick={handleMinimize}
              className="h-8 w-8"
            >
              <Minus className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={handleMaximize}
              className="h-8 w-8"
            >
              <Square className="h-3 w-3" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={handleClose}
              className="h-8 w-8 hover:bg-error hover:text-error-foreground"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
