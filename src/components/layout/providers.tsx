'use client'

import { useEffect } from 'react'
import { ThemeProvider, TabsProvider } from '@/core/state'
import { isTauri } from '@/core/tauri'

import { CommandPalette } from '@/components/ui/command-palette'
import { useCommands } from '@/core/hooks/use-commands'

function CommandSystem() {
  useCommands()
  return <CommandPalette />
}

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (isTauri()) {
      document.body.classList.add('is-tauri')
    }
  }, [])

  return (
    <ThemeProvider>
      <TabsProvider>
        {children}
        <CommandSystem />
      </TabsProvider>
    </ThemeProvider>
  )
}
