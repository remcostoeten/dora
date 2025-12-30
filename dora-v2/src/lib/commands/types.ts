import type { LucideIcon } from 'lucide-react'

export interface AppCommand {
  id: string
  /** Display label for the command */
  label: string
  /** Optional description for the command */
  description?: string
  /** Icon to display with the command */
  icon?: LucideIcon
  /** Group/category for the command */
  group?: string
  /** Keywords for search */
  keywords?: string[]
  /** Function to execute when command is selected */
  execute: (context: CommandContext) => void | Promise<void>
  /** Optional function to determine if command is available */
  isAvailable?: (context: CommandContext) => boolean
  /** Keyboard shortcut */
  shortcut?: string

}

export interface CommandGroup {
  id: string
  label: string
  commands: AppCommand[]
}

export interface CommandContext {
  // Preferences
  openPreferences: () => void

  // Notifications
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void
}
