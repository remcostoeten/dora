import { useEffect, useState } from 'react'
import { useUIStore } from '@/store/ui-store'
import { useCommandContext } from '@/hooks/use-command-context'
import { getAllCommands, executeCommand } from '@/lib/commands'
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
} from '@/components/ui/command'

export function CommandPalette() {
  const commandPaletteOpen = useUIStore(state => state.commandPaletteOpen)
  const setCommandPaletteOpen = useUIStore(state => state.setCommandPaletteOpen)
  const toggleCommandPalette = useUIStore(state => state.toggleCommandPalette)
  const commandContext = useCommandContext()
  const [search, setSearch] = useState('')

  // Get all available commands grouped by category
  const commands = getAllCommands(commandContext, search)
  const commandGroups = commands.reduce<Record<string, typeof commands>>(
    (groups, command) => {
      const group = command.group || 'other'
      if (!groups[group]) {
        groups[group] = []
      }
      groups[group].push(command)
      return groups
    },
    {}
  )

  // Handle command execution
  const handleCommandSelect = async (commandId: string) => {
    setCommandPaletteOpen(false)
    setSearch('') // Clear search when closing

    const result = await executeCommand(commandId, commandContext)

    if (!result.success && result.error) {
      commandContext.showToast(result.error, 'error')
    }
  }

  // Handle dialog open/close with search clearing
  const handleOpenChange = (open: boolean) => {
    setCommandPaletteOpen(open)
    if (!open) {
      setSearch('') // Clear search when closing
    }
  }

  // Keyboard shortcut handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        toggleCommandPalette()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [toggleCommandPalette])

  // Helper function to get group label
  const getGroupLabel = (group: string) => {
    // Convert group name to title case for display
    return group.charAt(0).toUpperCase() + group.slice(1)
  }

  return (
    <CommandDialog
      open={commandPaletteOpen}
      onOpenChange={handleOpenChange}
      title="Command Palette"
      description="Quickly find and run commands"
    >
      <CommandInput
        placeholder="Type a command or search..."
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        <CommandEmpty>No commands found</CommandEmpty>

        {Object.entries(commandGroups).map(([groupName, groupCommands]) => (
          <CommandGroup key={groupName} heading={getGroupLabel(groupName)}>
            {groupCommands.map(command => (
              <CommandItem
                key={command.id}
                value={command.id}
                onSelect={() => handleCommandSelect(command.id)}
              >
                {command.icon && <command.icon className="mr-2 h-4 w-4" />}
                <span>{command.label || command.id}</span>
                {command.description && (
                  <span className="ml-auto text-xs text-muted-foreground">
                    {command.description}
                  </span>
                )}
                {command.shortcut && (
                  <CommandShortcut>{command.shortcut}</CommandShortcut>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  )
}

export default CommandPalette
