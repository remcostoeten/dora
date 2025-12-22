'use client'

import { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'light' | 'dark'

type ThemeContext = {
  theme: Theme
  toggleTheme: () => void
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContext | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark')

  useEffect(() => {
    // 1. Initial optimistic load (fast path)
    const storedLocal = localStorage.getItem('theme') as Theme | null
    if (storedLocal) {
      applyTheme(storedLocal)
    } else {
      // Default to dark as requested
      setThemeState('dark')
      document.documentElement.classList.toggle('dark', true)
    }

    // 2. Fetch from DB (source of truth)
    import('@/lib/tauri-commands').then(({ getSetting }) => {
      getSetting<Theme>('theme')
        .then(storedDb => {
          if (storedDb && (storedDb === 'light' || storedDb === 'dark')) {
            applyTheme(storedDb)
            // Sync local storage if drifted
            if (localStorage.getItem('theme') !== storedDb) {
              localStorage.setItem('theme', storedDb)
            }
          }
        })
        .catch(console.error)
    })
  }, [])

  function applyTheme(newTheme: Theme) {
    setThemeState(newTheme)
    document.documentElement.classList.toggle('dark', newTheme === 'dark')
  }

  function setTheme(newTheme: Theme) {
    applyTheme(newTheme)
    localStorage.setItem('theme', newTheme)

    // Persist to DB asynchronously
    import('@/lib/tauri-commands').then(({ setSetting }) => {
      setSetting('theme', newTheme).catch(console.error)
    })
  }

  function toggleTheme() {
    setTheme(theme === 'light' ? 'dark' : 'light')
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return context
}
