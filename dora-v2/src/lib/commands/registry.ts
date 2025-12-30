import type { AppCommand, CommandContext } from './types'

const commandRegistry = new Map<string, AppCommand>()

export function registerCommands(commands: AppCommand[]): void {
  commands.forEach(cmd => commandRegistry.set(cmd.id, cmd))
}

export function getAllCommands(
  context: CommandContext,
  searchValue = ''
): AppCommand[] {
  const allCommands = Array.from(commandRegistry.values())
    .filter(command => !command.isAvailable || command.isAvailable(context))
    .map(cmd => {
      // For backward compatibility with commands that still use labelKey/descriptionKey
      const label = cmd.label || (cmd.labelKey ? cmd.labelKey.split('.').pop() : cmd.id) || cmd.id
      const description = cmd.description || (cmd.descriptionKey ? cmd.descriptionKey.split('.').pop() : undefined)
      
      // Create a new command object with the resolved values
      const resolvedCmd: AppCommand = {
        ...cmd,
        label,
        description
      }
      
      return resolvedCmd
    })

  if (searchValue.trim()) {
    const search = searchValue.toLowerCase()
    return allCommands.filter(cmd => {
      const label = cmd.label.toLowerCase()
      const description = cmd.description?.toLowerCase() || ''
      const keywords = cmd.keywords?.join(' ').toLowerCase() || ''
      
      return (
        label.includes(search) ||
        description.includes(search) ||
        keywords.includes(search) ||
        cmd.id.toLowerCase().includes(search)
      )
    })
  }

  return allCommands
}
export async function executeCommand(
  commandId: string,
  context: CommandContext
): Promise<{ success: boolean; error?: string }> {
  try {
    const command = commandRegistry.get(commandId)

    if (!command) {
      return {
        success: false,
        error: `Command '${commandId}' not found`,
      }
    }

    if (command.isAvailable && !command.isAvailable(context)) {
      return {
        success: false,
        error: `Command '${commandId}' is not available`,
      }
    }

    await command.execute(context)

    return { success: true }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'

    return {
      success: false,
      error: `Failed to execute command '${commandId}': ${errorMessage}`,
    }
  }
}
