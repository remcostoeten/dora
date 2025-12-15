'use client'

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Clock,
  Database,
  Loader2,
  Upload,
  XCircle,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  analyzeConnectionString,
  formatCorrectionMessage,
  suggestConnectionName,
  validateConnectionString,
} from '@/core/database'
import { pickSqliteDbDialog, testConnection } from '@/core/tauri'
import { cn } from '@/core/utilities/cn'
import type { ConnectionInfo, DatabaseInfo } from '@/types/database'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}

function Dialog({ open, onOpenChange, children }: Props) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />
      <div className="relative z-10 w-full max-w-4xl px-4">{children}</div>
    </div>
  )
}

function DialogContent({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'max-h-[90vh] overflow-hidden rounded-xl border border-border bg-card shadow-xl',
        className
      )}
    >
      {children}
    </div>
  )
}

function DialogHeader({ children }: { children: React.ReactNode }) {
  return <div className="border-b border-border px-6 py-4">{children}</div>
}

function DialogTitle({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'text-lg font-semibold leading-none tracking-tight',
        className
      )}
    >
      {children}
    </div>
  )
}

function DialogDescription({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>
}

function DialogFooter({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-end gap-2 border-t border-border px-6 py-4',
        className
      )}
    >
      {children}
    </div>
  )
}

type TabsContextValue = {
  value: string
  onValueChange?: (value: string) => void
}

const TabsContext = React.createContext<TabsContextValue | null>(null)

function useTabsContext() {
  const ctx = React.useContext(TabsContext)
  if (!ctx) throw new Error('Tabs components must be used within Tabs')
  return ctx
}

function Tabs({
  value,
  onValueChange,
  children,
  className,
}: {
  value: string
  onValueChange?: (value: string) => void
  children: React.ReactNode
  className?: string
}) {
  return (
    <TabsContext.Provider value={{ value, onValueChange }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  )
}

function TabsList({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('inline-flex items-center rounded-md bg-muted p-1', className)}>
      {children}
    </div>
  )
}

function TabsTrigger({
  value,
  children,
  className,
}: {
  value: string
  children: React.ReactNode
  className?: string
}) {
  const ctx = useTabsContext()
  const active = ctx.value === value
  return (
    <button
      type="button"
      onClick={() => ctx.onValueChange?.(value)}
      data-state={active ? 'active' : 'inactive'}
      className={cn(
        'flex items-center gap-2 rounded-sm px-3 py-2 text-sm transition-colors',
        active ? 'bg-card shadow-sm' : 'text-muted-foreground hover:bg-card/70',
        className
      )}
    >
      {children}
    </button>
  )
}

function TabsContent({
  value,
  children,
  className,
}: {
  value: string
  children: React.ReactNode
  className?: string
}) {
  const ctx = useTabsContext()
  if (ctx.value !== value) return null
  return <div className={className}>{children}</div>
}

function Alert({
  variant = 'default',
  children,
  className,
}: {
  variant?: 'default' | 'destructive'
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex items-start gap-2 rounded-md border px-3 py-2 text-sm',
        variant === 'destructive'
          ? 'border-destructive/50 bg-destructive/10 text-destructive'
          : 'border-border bg-muted/50 text-foreground',
        className
      )}
    >
      {children}
    </div>
  )
}

function AlertDescription({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return <div className={cn('flex-1 text-sm', className)}>{children}</div>
}

function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full bg-muted px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground',
        className
      )}
    >
      {children}
    </span>
  )
}

function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        'rounded-sm border border-border bg-background px-1.5 py-0.5 text-[11px] font-medium',
        className
      )}
    >
      {children}
    </kbd>
  )
}

function Separator({ className }: { className?: string }) {
  return <div className={cn('h-px w-full bg-border', className)} />
}

function ScrollArea({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('overflow-y-auto', className)}>{children}</div>
}

type ConnectionHistory = {
  id: string
  type: 'postgresql' | 'libsql'
  url?: string
  name?: string
  timestamp: number
}

type TestResult = {
  status: 'success' | 'error' | 'testing' | null
  message?: string
}

type ValidationResult = {
  isValid: boolean
  hint?: string
  corrected?: string
}

type DatabaseConnectionModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (name: string, databaseInfo: DatabaseInfo) => Promise<void> | void
  editingConnection?: ConnectionInfo | null
}

function extractPostgresUrl(text: string): string | null {
  const patterns = [
    /postgres(?:ql)?:\/\/[^\s"']+/gi,
    /DATABASE_URL\s*[=:]\s*["']?(postgres(?:ql)?:\/\/[^\s"']+)["']?/i,
    /DB_URL\s*[=:]\s*["']?(postgres(?:ql)?:\/\/[^\s"']+)["']?/i,
    /CONNECTION_STRING\s*[=:]\s*["']?(postgres(?:ql)?:\/\/[^\s"']+)["']?/i,
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) {
      const url = (match as RegExpMatchArray)[1] || match[0]
      return url.replace(/["']/g, '').trim()
    }
  }

  return null
}

function extractLibsqlCredentials(text: string): { url?: string; token?: string } {
  const result: { url?: string; token?: string } = {}

  const urlPatterns = [
    /libsql:\/\/[^\s"']+/gi,
    /DATABASE_URL\s*[=:]\s*["']?(libsql:\/\/[^\s"']+)["']?/i,
    /DB_URL\s*[=:]\s*["']?(libsql:\/\/[^\s"']+)["']?/i,
    /TURSO_URL\s*[=:]\s*["']?(libsql:\/\/[^\s"']+)["']?/i,
    /LIBSQL_URL\s*[=:]\s*["']?(libsql:\/\/[^\s"']+)["']?/i,
  ]

  for (const pattern of urlPatterns) {
    const match = text.match(pattern)
    if (match) {
      const url = (match as RegExpMatchArray)[1] || match[0]
      result.url = url.replace(/["']/g, '').trim()
      break
    }
  }

  const tokenPatterns = [
    /TURSO_AUTH_TOKEN\s*[=:]\s*["']?([A-Za-z0-9_\-\.]{100,})["']?/i,
    /AUTH_TOKEN\s*[=:]\s*["']?([A-Za-z0-9_\-\.]{100,})["']?/i,
    /TURSO_TOKEN\s*[=:]\s*["']?([A-Za-z0-9_\-\.]{100,})["']?/i,
    /LIBSQL_TOKEN\s*[=:]\s*["']?([A-Za-z0-9_\-\.]{100,})["']?/i,
    /TOKEN\s*[=:]\s*["']?([A-Za-z0-9_\-\.]{100,})["']?/i,
    /eyJ[A-Za-z0-9_\-\.]{100,}/g,
  ]

  for (const pattern of tokenPatterns) {
    const match = text.match(pattern)
    if (match) {
      const token = (match as RegExpMatchArray)[1] || match[0]
      result.token = token.replace(/["']/g, '').trim()
      break
    }
  }

  return result
}

function validateLibsqlUrl(url: string, setState: (result: ValidationResult) => void): ValidationResult {
  if (!url) {
    const res = { isValid: true }
    setState(res)
    return res
  }

  const commonTypos: Record<string, string> = {
    'libsq://': 'libsql://',
    'libsql//': 'libsql://',
    'turso://': 'libsql://',
  }

  let correctedUrl = url
  let hint = ''

  for (const [typo, correction] of Object.entries(commonTypos)) {
    if (url.startsWith(typo)) {
      correctedUrl = url.replace(typo, correction)
      hint = `Did you mean "${correction}"?`
      break
    }
  }

  const validPattern = /^libsql:\/\/.+/
  const isValid = validPattern.test(correctedUrl)

  if (!isValid && (url.includes('.turso.io') || url.includes('turso'))) {
    hint = 'URL should start with "libsql://"'
  }

  const result: ValidationResult = {
    isValid: isValid || correctedUrl !== url,
    hint,
    corrected: correctedUrl !== url ? correctedUrl : undefined,
  }

  setState(result)
  return result
}

function validatePostgresUrl(url: string, setState: (result: ValidationResult) => void): ValidationResult {
  if (!url) {
    const res = { isValid: true }
    setState(res)
    return res
  }

  const commonTypos: Record<string, string> = {
    'postgre://': 'postgresql://',
    'postgres//': 'postgres://',
    'postgresql//': 'postgresql://',
    'postgress://': 'postgres://',
    'postgresq://': 'postgresql://',
  }

  let correctedUrl = url
  let hint = ''

  for (const [typo, correction] of Object.entries(commonTypos)) {
    if (url.startsWith(typo)) {
      correctedUrl = url.replace(typo, correction)
      hint = `Did you mean "${correction}"?`
      break
    }
  }

  const validPatterns = [/^postgres:\/\/.+/, /^postgresql:\/\/.+/]
  const isValid = validPatterns.some((pattern) => pattern.test(correctedUrl))

  if (!isValid && url.includes('@') && url.includes(':')) {
    hint = 'URL should start with "postgresql://" or "postgres://"'
  }

  const result: ValidationResult = {
    isValid: isValid || correctedUrl !== url,
    hint,
    corrected: correctedUrl !== url ? correctedUrl : undefined,
  }

  setState(result)
  return result
}

function formatHistoryEntry(url: string, type: ConnectionHistory['type']): ConnectionHistory {
  return {
    id: Date.now().toString(),
    type,
    url,
    name:
      url.split('@')[1]?.split('/')[0] ||
      (type === 'postgresql' ? 'PostgreSQL' : 'LibSQL'),
    timestamp: Date.now(),
  }
}

export function DatabaseConnectionModal({
  open,
  onOpenChange,
  onSubmit,
  editingConnection,
}: DatabaseConnectionModalProps) {
  const [activeTab, setActiveTab] = useState<'postgresql' | 'libsql' | 'sqlite'>(
    'postgresql'
  )
  const [name, setName] = useState('')
  const [postgresUrl, setPostgresUrl] = useState('')
  const [postgresManual, setPostgresManual] = useState({
    host: '',
    port: '5432',
    database: '',
    username: '',
    password: '',
  })
  const [useManualPostgres, setUseManualPostgres] = useState(false)
  const [libsqlUrl, setLibsqlUrl] = useState('')
  const [libsqlToken, setLibsqlToken] = useState('')
  const [sqlitePath, setSqlitePath] = useState('')
  const [testResult, setTestResult] = useState<TestResult>({ status: null })
  const [connectionHistory, setConnectionHistory] = useState<ConnectionHistory[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [showHistoryDropdown, setShowHistoryDropdown] = useState(false)
  const [filteredHistory, setFilteredHistory] = useState<ConnectionHistory[]>([])
  const [selectedHistoryIndex, setSelectedHistoryIndex] = useState(-1)
  const [urlValidation, setUrlValidation] = useState<ValidationResult>({
    isValid: true,
  })
  const [libsqlValidation, setLibsqlValidation] = useState<ValidationResult>({
    isValid: true,
  })
  const [sqliteValidation, setSqliteValidation] = useState<ValidationResult>({
    isValid: true,
  })
  const [correctionInfo, setCorrectionInfo] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const urlInputRef = useRef<HTMLInputElement>(null)
  const historyButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const stored = localStorage.getItem('db_connection_history')
    if (stored) {
      try {
        setConnectionHistory(JSON.parse(stored) as ConnectionHistory[])
      } catch (e) {
        console.error('Failed to parse connection history', e)
      }
    }
  }, [])

  useEffect(() => {
    const currentUrl =
      activeTab === 'postgresql' ? postgresUrl : activeTab === 'libsql' ? libsqlUrl : ''
    const filtered = connectionHistory
      .filter((h) =>
        h.type === activeTab && currentUrl
          ? h.url?.toLowerCase().includes(currentUrl.toLowerCase())
          : h.type === activeTab
      )
      .slice(0, 5)
    setFilteredHistory(filtered)
  }, [postgresUrl, libsqlUrl, activeTab, connectionHistory])

  useEffect(() => {
    if (editingConnection) {
      setName(editingConnection.name)
      const dbType = editingConnection.database_type
      if ('Postgres' in dbType) {
        setActiveTab('postgresql')
        setPostgresUrl(dbType.Postgres.connection_string)
      } else if ('SQLite' in dbType) {
        setActiveTab('sqlite')
        setSqlitePath(dbType.SQLite.db_path)
      }
    } else if (!open) {
      setName('')
      setPostgresUrl('')
      setSqlitePath('')
      setLibsqlUrl('')
      setLibsqlToken('')
      setUseManualPostgres(false)
      setPostgresManual({ host: '', port: '5432', database: '', username: '', password: '' })
      setTestResult({ status: null })
    }
  }, [editingConnection, open])

  useEffect(() => {
    if (activeTab === 'postgresql') {
      validatePostgresUrl(postgresUrl, setUrlValidation)
    } else if (activeTab === 'libsql') {
      validateLibsqlUrl(libsqlUrl, setLibsqlValidation)
    } else if (activeTab === 'sqlite') {
      const validation = validateConnectionString(sqlitePath, 'sqlite')
      setSqliteValidation({ isValid: validation.valid, hint: validation.error })
    }
  }, [postgresUrl, libsqlUrl, sqlitePath, activeTab])

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!open) return
      const target = e.target as HTMLElement
      if (['INPUT', 'TEXTAREA', 'BUTTON'].includes(target.tagName)) return

      if (e.key === '1') {
        e.preventDefault()
        setActiveTab('postgresql')
      } else if (e.key === '2') {
        e.preventDefault()
        setActiveTab('libsql')
      } else if (e.key === '3') {
        e.preventDefault()
        setActiveTab('sqlite')
      }
    }

    const handleGlobalPaste = (e: ClipboardEvent) => {
      if (!open) return
      const target = e.target as HTMLElement
      if (['INPUT', 'TEXTAREA'].includes(target.tagName)) return
      const text = e.clipboardData?.getData('text')
      if (!text) return

      if (activeTab === 'postgresql') {
        const extracted = extractPostgresUrl(text) || text
        applyPostgresUrl(extracted)
        urlInputRef.current?.focus()
      } else if (activeTab === 'libsql') {
        const extracted = extractLibsqlCredentials(text)
        if (extracted.url) {
          applyLibsqlUrl(extracted.url)
        }
        if (extracted.token) {
          setLibsqlToken(extracted.token)
        }
        urlInputRef.current?.focus()
      }
    }

    if (open) {
      document.addEventListener('paste', handleGlobalPaste)
      document.addEventListener('keydown', handleKeyPress)
    }
    return () => {
      document.removeEventListener('paste', handleGlobalPaste)
      document.removeEventListener('keydown', handleKeyPress)
    }
  }, [open, activeTab])

  const buildPostgresUrlFromManual = useMemo(() => {
    if (!useManualPostgres) return ''
    const { host, port, database, username, password } = postgresManual
    if (!host || !database || !username) return ''
    const auth = password
      ? `${encodeURIComponent(username)}:${encodeURIComponent(password)}`
      : encodeURIComponent(username)
    const cleanedPort = port || '5432'
    return `postgresql://${auth}@${host}${cleanedPort ? `:${cleanedPort}` : ''}/${database}`
  }, [postgresManual, useManualPostgres])

  const finalPostgresUrl = useMemo(() => {
    if (useManualPostgres) {
      return buildPostgresUrlFromManual
    }
    return urlValidation.corrected || postgresUrl
  }, [useManualPostgres, buildPostgresUrlFromManual, urlValidation.corrected, postgresUrl])

  const isConnectionValid = useMemo(() => {
    if (!name.trim()) return false

    if (activeTab === 'postgresql') {
      const validation = validateConnectionString(finalPostgresUrl, 'postgres')
      return Boolean(finalPostgresUrl.trim()) && validation.valid && urlValidation.isValid
    }
    if (activeTab === 'libsql') {
      return Boolean(libsqlUrl.trim() && libsqlToken.trim() && libsqlValidation.isValid)
    }
    if (activeTab === 'sqlite') {
      const validation = validateConnectionString(sqlitePath, 'sqlite')
      return Boolean(sqlitePath.trim()) && validation.valid
    }
    return false
  }, [
    activeTab,
    finalPostgresUrl,
    urlValidation.isValid,
    libsqlUrl,
    libsqlToken,
    libsqlValidation.isValid,
    sqlitePath,
  ])

  const applyPostgresUrl = (text: string) => {
    const analysis = analyzeConnectionString(text)
    setPostgresUrl(analysis.cleaned)
    setCorrectionInfo(formatCorrectionMessage(analysis))
    validatePostgresUrl(analysis.cleaned, setUrlValidation)
    if (!name) {
      setName(suggestConnectionName(analysis.cleaned, 'postgres'))
    }
  }

  const applyLibsqlUrl = (text: string) => {
    setLibsqlUrl(text)
    validateLibsqlUrl(text, setLibsqlValidation)
    if (!name) {
      try {
        const url = new URL(text)
        setName(`LibSQL - ${url.hostname}`)
      } catch {
        setName('LibSQL')
      }
    }
  }

  const applySqlitePath = (text: string) => {
    const analysis = analyzeConnectionString(text)
    setSqlitePath(analysis.cleaned)
    setCorrectionInfo(formatCorrectionMessage(analysis))
    const validation = validateConnectionString(analysis.cleaned, 'sqlite')
    setSqliteValidation({ isValid: validation.valid, hint: validation.error })
    if (!name) {
      setName(suggestConnectionName(analysis.cleaned, 'sqlite'))
    }
  }

  const handlePaste = async (e: React.ClipboardEvent) => {
    e.preventDefault()
    const text = e.clipboardData.getData('text')
    if (activeTab === 'postgresql') {
      const extracted = extractPostgresUrl(text)
      applyPostgresUrl(extracted || text)
    } else if (activeTab === 'libsql') {
      const extracted = extractLibsqlCredentials(text)
      if (extracted.url) applyLibsqlUrl(extracted.url)
      if (extracted.token) setLibsqlToken(extracted.token)
      if (!extracted.url && !extracted.token) {
        const target = e.target as HTMLInputElement
        if (target.id === 'libsql-url') setLibsqlUrl(text)
        if (target.id === 'libsql-token') setLibsqlToken(text)
      }
    } else if (activeTab === 'sqlite') {
      applySqlitePath(text)
    }
  }

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    const isHistoryOpen = showHistory || showHistoryDropdown
    if (!isHistoryOpen || filteredHistory.length === 0) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedHistoryIndex((prev) =>
          prev < filteredHistory.length - 1 ? prev + 1 : prev
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedHistoryIndex((prev) => (prev > 0 ? prev - 1 : -1))
        break
      case 'Enter':
        if (selectedHistoryIndex >= 0) {
          e.preventDefault()
          selectHistoryItem(filteredHistory[selectedHistoryIndex])
        }
        break
      case 'Escape':
        e.preventDefault()
        setShowHistory(false)
        setShowHistoryDropdown(false)
        setSelectedHistoryIndex(-1)
        break
    }
  }

  const handleHistoryButtonKeyDown = (e: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'ArrowDown' && showHistoryDropdown && filteredHistory.length > 0) {
      e.preventDefault()
      setSelectedHistoryIndex(0)
      urlInputRef.current?.focus()
    }
  }

  const selectHistoryItem = (item: ConnectionHistory) => {
    if (item.type === 'postgresql' && item.url) {
      applyPostgresUrl(item.url)
    } else if (item.type === 'libsql' && item.url) {
      applyLibsqlUrl(item.url)
    }
    setShowHistory(false)
    setShowHistoryDropdown(false)
    setSelectedHistoryIndex(-1)
  }

  const toggleHistoryDropdown = () => {
    const newState = !showHistoryDropdown
    setShowHistoryDropdown(newState)
    setShowHistory(false)
    setSelectedHistoryIndex(-1)
    if (newState && filteredHistory.length > 0) {
      setShowHistoryDropdown(true)
      urlInputRef.current?.focus()
    }
  }

  const handleTestConnection = async () => {
    setFormError(null)
    if (activeTab === 'libsql') {
      setTestResult({
        status: 'error',
        message: 'LibSQL connections are not supported in the current backend.',
      })
      return
    }

    let databaseInfo: DatabaseInfo | null = null
    if (activeTab === 'postgresql') {
      databaseInfo = { Postgres: { connection_string: finalPostgresUrl } }
    } else if (activeTab === 'sqlite') {
      databaseInfo = { SQLite: { db_path: sqlitePath } }
    }

    if (!databaseInfo) return

    setTestResult({ status: 'testing', message: 'Testing connection...' })
    try {
      await testConnection(databaseInfo)
      setTestResult({ status: 'success', message: 'Connection successful!' })
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to connect. Please check your credentials.'
      setTestResult({ status: 'error', message })
    }
  }

  const handleSaveAndConnect = async () => {
    setFormError(null)
    if (!name.trim()) {
      setFormError('Connection name is required')
      return
    }

    if (activeTab === 'libsql') {
      setFormError('LibSQL connections cannot be saved yet in this build.')
      return
    }

    let databaseInfo: DatabaseInfo | null = null
    if (activeTab === 'postgresql') {
      const validation = validateConnectionString(finalPostgresUrl, 'postgres')
      if (!validation.valid) {
        setFormError(validation.error || 'Please enter a valid PostgreSQL connection string')
        return
      }
      databaseInfo = { Postgres: { connection_string: finalPostgresUrl } }
    } else if (activeTab === 'sqlite') {
      const validation = validateConnectionString(sqlitePath, 'sqlite')
      if (!validation.valid) {
        setFormError(validation.error || 'Please provide a valid SQLite path')
        return
      }
      databaseInfo = { SQLite: { db_path: sqlitePath } }
    }

    if (!databaseInfo) return

    if (!name) {
      const defaultName =
        activeTab === 'postgresql'
          ? suggestConnectionName(finalPostgresUrl, 'postgres')
          : suggestConnectionName(sqlitePath, 'sqlite')
      setName(defaultName)
    }

    if (activeTab === 'postgresql') {
      const historyEntry = formatHistoryEntry(finalPostgresUrl, 'postgresql')
      const updated = [historyEntry, ...connectionHistory].slice(0, 20)
      setConnectionHistory(updated)
      localStorage.setItem('db_connection_history', JSON.stringify(updated))
    }

    await onSubmit(name.trim(), databaseInfo)
    onOpenChange(false)
  }

  const applyCorrectedUrl = () => {
    if (urlValidation.corrected) {
      applyPostgresUrl(urlValidation.corrected)
    }
  }

  const applyCorrectedLibsqlUrl = () => {
    if (libsqlValidation.corrected) {
      applyLibsqlUrl(libsqlValidation.corrected)
    }
  }

  const handleBrowseSqlite = async () => {
    try {
      const filePath = await pickSqliteDbDialog()
      if (filePath) {
        applySqlitePath(filePath)
      }
    } catch (error) {
      console.error('Failed to open SQLite file picker', error)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              <span>{editingConnection ? 'Edit Connection' : 'Database Connection'}</span>
            </div>
            {editingConnection && <Badge>Editing</Badge>}
          </DialogTitle>
          <DialogDescription>
            Connect to your database by selecting a connection type below
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-4">
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="connection-name">Connection Name</Label>
              <Input
                id="connection-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Database"
              />
            </div>
            <div className="flex items-end justify-end gap-2 text-xs text-muted-foreground">
              <div className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-1">
                <span>Tab shortcuts:</span>
                <Kbd>1</Kbd>
                <span>/</span>
                <Kbd>2</Kbd>
                <span>/</span>
                <Kbd>3</Kbd>
              </div>
            </div>
          </div>

          <Tabs
            value={activeTab}
            onValueChange={(v) =>
              setActiveTab(v as 'postgresql' | 'libsql' | 'sqlite')
            }
            className="flex flex-col gap-4"
          >
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="postgresql">
                <span>PostgreSQL</span>
                <Kbd>1</Kbd>
              </TabsTrigger>
              <TabsTrigger value="libsql">
                <span>LibSQL/Turso</span>
                <Kbd>2</Kbd>
              </TabsTrigger>
              <TabsTrigger value="sqlite">
                <span>SQLite</span>
                <Kbd>3</Kbd>
              </TabsTrigger>
            </TabsList>

            <ScrollArea className="max-h-[55vh] pr-2">
              <TabsContent value="postgresql" className="space-y-4 pt-2">
                <div className="relative space-y-2">
                  <Label htmlFor="postgres-url">Connection URL</Label>
                  <div className="flex gap-2">
                    <Input
                      ref={urlInputRef}
                      id="postgres-url"
                      placeholder="postgresql://user:password@host:5432/database"
                      value={postgresUrl}
                      onChange={(e) => applyPostgresUrl(e.target.value)}
                      onPaste={handlePaste}
                      onKeyDown={handleKeyDown}
                      onFocus={() => {
                        if (filteredHistory.length > 0 && !showHistoryDropdown)
                          setShowHistory(true)
                      }}
                      onBlur={() => {
                        setTimeout(() => setShowHistory(false), 200)
                      }}
                      className={!urlValidation.isValid ? 'border-destructive focus-visible:ring-destructive' : ''}
                    />
                    <Button
                      ref={historyButtonRef}
                      type="button"
                      variant="outline"
                      size="icon"
                      disabled={filteredHistory.length === 0}
                      onClick={toggleHistoryDropdown}
                      onKeyDown={handleHistoryButtonKeyDown}
                      className="shrink-0"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </div>

                  {!urlValidation.isValid && urlValidation.hint && (
                    <Alert variant="destructive" className="py-2">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="flex items-center justify-between gap-2">
                        <span>{urlValidation.hint}</span>
                        {urlValidation.corrected && (
                          <Button size="sm" variant="outline" onClick={applyCorrectedUrl}>
                            Apply Fix
                          </Button>
                        )}
                      </AlertDescription>
                    </Alert>
                  )}

                  {correctionInfo && (
                    <Alert className="py-2">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{correctionInfo}</AlertDescription>
                    </Alert>
                  )}

                  {(showHistory || showHistoryDropdown) && filteredHistory.length > 0 && (
                    <div className="absolute z-50 mt-1 w-[calc(100%-3.5rem)] overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-lg">
                      <ScrollArea className="max-h-60 overflow-y-auto">
                        <div className="space-y-1 p-2">
                          {filteredHistory.map((item, index) => (
                            <button
                              key={item.id}
                              className={cn(
                                'flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm transition-colors hover:bg-accent',
                                selectedHistoryIndex === index && 'bg-accent'
                              )}
                              onClick={() => selectHistoryItem(item)}
                              onMouseEnter={() => setSelectedHistoryIndex(index)}
                            >
                              <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
                              <div className="min-w-0 flex-1">
                                <div className="truncate font-medium">{item.name}</div>
                                <div className="truncate text-xs text-muted-foreground">
                                  {item.url}
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Separator className="flex-1" />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setUseManualPostgres(!useManualPostgres)}
                  >
                    {useManualPostgres ? 'Use URL' : 'Manual Configuration'}
                  </Button>
                  <Separator className="flex-1" />
                </div>

                {useManualPostgres && (
                  <div className="space-y-4 rounded-lg border border-border p-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="pg-host">Host</Label>
                        <Input
                          id="pg-host"
                          placeholder="localhost"
                          value={postgresManual.host}
                          onChange={(e) =>
                            setPostgresManual({ ...postgresManual, host: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="pg-port">Port</Label>
                        <Input
                          id="pg-port"
                          placeholder="5432"
                          value={postgresManual.port}
                          onChange={(e) =>
                            setPostgresManual({ ...postgresManual, port: e.target.value })
                          }
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="pg-database">Database</Label>
                      <Input
                        id="pg-database"
                        placeholder="mydb"
                        value={postgresManual.database}
                        onChange={(e) =>
                          setPostgresManual({
                            ...postgresManual,
                            database: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="pg-username">Username</Label>
                      <Input
                        id="pg-username"
                        placeholder="postgres"
                        value={postgresManual.username}
                        onChange={(e) =>
                          setPostgresManual({
                            ...postgresManual,
                            username: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="pg-password">Password</Label>
                      <Input
                        id="pg-password"
                        type="password"
                        placeholder="••••••••"
                        value={postgresManual.password}
                        onChange={(e) =>
                          setPostgresManual({
                            ...postgresManual,
                            password: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="libsql" className="space-y-4 pt-2">
                <Alert className="py-2">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    LibSQL parsing and validation are available, but saving and testing are
                    disabled until backend support is added.
                  </AlertDescription>
                </Alert>

                <div className="relative space-y-2">
                  <Label htmlFor="libsql-url">Database URL</Label>
                  <div className="flex gap-2">
                    <Input
                      ref={urlInputRef}
                      id="libsql-url"
                      placeholder="libsql://your-database.turso.io"
                      value={libsqlUrl}
                      onChange={(e) => applyLibsqlUrl(e.target.value)}
                      onPaste={handlePaste}
                      onKeyDown={handleKeyDown}
                      onFocus={() => {
                        if (filteredHistory.length > 0 && !showHistoryDropdown)
                          setShowHistory(true)
                      }}
                      onBlur={() => {
                        setTimeout(() => setShowHistory(false), 200)
                      }}
                      className={!libsqlValidation.isValid ? 'border-destructive focus-visible:ring-destructive' : ''}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      disabled={filteredHistory.length === 0}
                      onClick={toggleHistoryDropdown}
                      onKeyDown={handleHistoryButtonKeyDown}
                      className="shrink-0"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </div>

                  {!libsqlValidation.isValid && libsqlValidation.hint && (
                    <Alert variant="destructive" className="py-2">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="flex items-center justify-between gap-2">
                        <span>{libsqlValidation.hint}</span>
                        {libsqlValidation.corrected && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={applyCorrectedLibsqlUrl}
                          >
                            Apply Fix
                          </Button>
                        )}
                      </AlertDescription>
                    </Alert>
                  )}

                  {(showHistory || showHistoryDropdown) && filteredHistory.length > 0 && (
                    <div className="absolute z-50 mt-1 w-[calc(100%-3.5rem)] overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-lg">
                      <ScrollArea className="max-h-60 overflow-y-auto">
                        <div className="space-y-1 p-2">
                          {filteredHistory.map((item, index) => (
                            <button
                              key={item.id}
                              className={cn(
                                'flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm transition-colors hover:bg-accent',
                                selectedHistoryIndex === index && 'bg-accent'
                              )}
                              onClick={() => selectHistoryItem(item)}
                              onMouseEnter={() => setSelectedHistoryIndex(index)}
                            >
                              <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
                              <div className="min-w-0 flex-1">
                                <div className="truncate font-medium">{item.name}</div>
                                <div className="truncate text-xs text-muted-foreground">
                                  {item.url}
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="libsql-token">Auth Token</Label>
                  <Input
                    id="libsql-token"
                    type="password"
                    placeholder="eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9..."
                    value={libsqlToken}
                    onChange={(e) => setLibsqlToken(e.target.value)}
                    onPaste={handlePaste}
                  />
                </div>
              </TabsContent>

              <TabsContent value="sqlite" className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="sqlite-file">SQLite Database Path</Label>
                  <div className="flex gap-2">
                    <Input
                      id="sqlite-file"
                      type="text"
                      placeholder="/path/to/database.db"
                      value={sqlitePath}
                      onChange={(e) => applySqlitePath(e.target.value)}
                      onPaste={handlePaste}
                      className={!sqliteValidation.isValid ? 'border-destructive focus-visible:ring-destructive' : ''}
                    />
                    <Button variant="outline" onClick={handleBrowseSqlite}>
                      <Upload className="mr-2 h-4 w-4" />
                      Browse
                    </Button>
                  </div>
                  {sqliteValidation.hint && (
                    <Alert variant="destructive" className="py-2">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="text-destructive">{sqliteValidation.hint}</AlertDescription>
                    </Alert>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Supported formats: .sqlite, .sqlite3, .db, .db3, .sdb, .sl3
                  </p>
                </div>
              </TabsContent>
            </ScrollArea>

            {testResult.status && (
              <Alert
                variant={testResult.status === 'error' ? 'destructive' : 'default'}
                className="mt-2"
              >
                {testResult.status === 'testing' && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                {testResult.status === 'success' && (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                )}
                {testResult.status === 'error' && <XCircle className="h-4 w-4" />}
                <AlertDescription>
                  {testResult.message || 'Testing connection...'}
                </AlertDescription>
              </Alert>
            )}
          </Tabs>

          {formError && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="outline"
            onClick={handleTestConnection}
            disabled={testResult.status === 'testing' || !isConnectionValid}
          >
            {testResult.status === 'testing' ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Testing...
              </>
            ) : (
              'Test Connection'
            )}
          </Button>
          <Button onClick={handleSaveAndConnect} disabled={!isConnectionValid}>
            {editingConnection ? 'Update Connection' : 'Save & Connect'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

