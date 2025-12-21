'use client'

import { ThemeProvider } from '@/lib/theme-provider'
import { TabsProvider } from '@/lib/tabs-store-complete'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <TabsProvider>{children}</TabsProvider>
    </ThemeProvider>
  )
}
