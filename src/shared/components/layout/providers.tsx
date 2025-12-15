'use client'

import { useEffect } from 'react'
import { ThemeProvider, TabsProvider } from '@/core/state'
import { AccentProvider } from '@/core/state/accent-provider'
import { ThemeConfigProvider } from '@/core/state/theme-config-provider'
import { isTauri } from '@/core/tauri'

import { useRouter } from 'next/navigation'
import { CommandPalette } from '@/components/ui/command-palette'
import { useCommands } from '@/core/hooks/use-commands'
import { useTabs } from '@/core/state/tabs-store'
import { COMMAND_IDS } from '@/core/commands/constants'
import { ToastProvider } from '@/components/ui/toast'

function CommandSystem() {
  const { registerHandler } = useCommands()
  const router = useRouter()
  const { tabs, activeTabId, closeTab, switchToTab } = useTabs()

  useEffect(() => {
    const unregister = [
      registerHandler(COMMAND_IDS.NAV_HOME, () => router.push('/')),
      registerHandler(COMMAND_IDS.NAV_SETTINGS, () => router.push('/settings')),
      registerHandler(COMMAND_IDS.APP_RELOAD, () => window.location.reload()),
      registerHandler(COMMAND_IDS.DATA_REFRESH, () => router.refresh()),

      registerHandler(COMMAND_IDS.TABS_CLOSE, () => {
        if (activeTabId) closeTab(activeTabId)
      }),

      registerHandler(COMMAND_IDS.TABS_NEXT, () => {
        if (!activeTabId || tabs.length <= 1) return
        const currentIndex = tabs.findIndex(t => t.id === activeTabId)
        if (currentIndex === -1) return

        const nextIndex = (currentIndex + 1) % tabs.length
        switchToTab(tabs[nextIndex].id)
      })
    ]

    return () => unregister.forEach(u => u())
  }, [registerHandler, router, tabs, activeTabId, closeTab, switchToTab])

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
      <AccentProvider>
        <ThemeConfigProvider>
          <TabsProvider>
            <ToastProvider>
              {children}
              <CommandSystem />
            </ToastProvider>
          </TabsProvider>
        </ThemeConfigProvider>
      </AccentProvider>
    </ThemeProvider>
  )
}
