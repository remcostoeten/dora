# Commands System Implementation Prompt

## Overview

Create a performant command system for the database-palace application using Rust for core logic and TypeScript for UI/interactivity. This system will enable users to define and execute commands with optional keyboard shortcuts, similar to VSCode's command palette (Ctrl+P).

## Requirements

### Core Architecture

- **Rust Backend**: Handle command registration, execution, and shortcut processing for performance
- **TypeScript Frontend**: UI components for command palette, shortcut display, and user interaction
- **Integration**: Seamlessly integrate with existing Tauri commands and React components

### Command Definition Structure

Commands should be defined in a structured format like:

```typescript
type CommandDefinition = {
	id: string
	name: string
	description: string
	command_ref: string // Reference to actual execution function
	shortcut?: ShortcutDefinition
}

type ShortcutDefinition = {
	keys: string[] // e.g., ['LCTRL', 'N']
	max_delay?: number // milliseconds, default 500
	disable_after_executed?: {
		duration: number // milliseconds
		count?: number // optional execution count limit
	}
}
```

### Example Command Definitions

```typescript
const commands = {
	connections: {
		NEW_CONNECTION: {
			id: 'connections.new',
			name: 'New Connection',
			description: 'Creates a new database connection tab',
			command_ref: 'create_new_connection',
			shortcut: {
				keys: ['LCTRL', 'N'],
				max_delay: 500,
				disable_after_executed: {
					duration: 2000
				}
			}
		},
		EDIT_CONNECTION: {
			id: 'connections.edit',
			name: 'Edit Connection',
			description: 'Opens the connection editor for the selected connection',
			command_ref: 'edit_selected_connection',
			shortcut: {
				keys: ['LCTRL', 'E']
			}
		}
	},
	queries: {
		RUN_QUERY: {
			id: 'queries.run',
			name: 'Run Query',
			description: 'Executes the current SQL query',
			command_ref: 'execute_current_query',
			shortcut: {
				keys: ['LCTRL', 'ENTER']
			}
		}
	}
}
```

## Implementation Steps

### 1. Rust Backend (src-tauri/)

- Create a new module `commands.rs` for command management
- Implement command registry with HashMap for fast lookups
- Add shortcut processing with timing logic
- Integrate with existing Tauri commands
- Add serialization/deserialization for command definitions

### 2. TypeScript Frontend (src/)

- Create command palette component with fuzzy search
- Add keyboard event listeners for shortcuts
- Implement command execution via Tauri invoke
- Add settings UI for customizing shortcuts
- Integrate with existing theme system

### 3. Key Features

- **Command Palette**: Ctrl+P opens searchable command list
- **Shortcut Management**: Register/unregister shortcuts dynamically
- **Performance**: Rust handles all timing-critical operations
- **Extensibility**: Easy to add new commands without code changes
- **Persistence**: Save custom shortcuts to storage
- **Conflict Resolution**: Detect and handle shortcut conflicts

### 4. UI Components Needed

- CommandPalette modal with search input
- Shortcut display component (e.g., "Ctrl+N")
- Settings panel for shortcut customization
- Toast notifications for command execution feedback

### 5. Integration Points

- Hook into existing connection management
- Integrate with query editor
- Add to main app layout
- Update existing keyboard handlers

## Technical Considerations

- Use Rust's performance for real-time shortcut detection
- Implement fuzzy search in TS for command palette
- Store command definitions in JSON/YAML for easy editing
- Add proper error handling and logging
- Ensure accessibility (ARIA labels, keyboard navigation)
- Test on multiple platforms (Windows/Linux/Mac)

## Deliverables

- Complete Rust command system implementation
- TypeScript UI components
- Integration with existing codebase
- Documentation for adding new commands
- Example command definitions for database-palace features
