'use client'

import { ThemeProvider, TabsProvider } from '@/core/state'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <TabsProvider>{children}</TabsProvider>
    </ThemeProvider>
  )
}
