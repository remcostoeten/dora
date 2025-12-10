'use client'

import { useEffect } from 'react'
import { ThemeProvider, TabsProvider } from '@/core/state'
import { isTauri } from '@/core/tauri'

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (isTauri()) {
      document.body.classList.add('is-tauri')
    }
  }, [])

  return (
    <ThemeProvider>
      <TabsProvider>{children}</TabsProvider>
    </ThemeProvider>
  )
}
