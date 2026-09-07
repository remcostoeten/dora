import { lazy, Suspense, useCallback } from 'react'
import {
	setActiveNav,
	useActiveConnectionId,
	useActiveNavId,
	useActiveTab
} from '@studio/core/workspace-store'
import { useAiAssistantStore } from '@studio/features/ai-assistant/store'
import { useAiEditorContext } from '@studio/features/ai-assistant/editor-context'
import { scheduleSqlConsoleCommand } from '@studio/features/command-palette/events'
import { Button } from '@studio/shared/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@studio/shared/ui/tooltip'
import { cn } from '@studio/shared/utils/cn'
import { Sparkles } from 'lucide-react'

const AiAssistantPanel = lazy(function () {
	return import('@studio/features/ai-assistant/ai-assistant-panel').then(function (m) {
		return { default: m.AiAssistantPanel }
	})
})

export function AiAssistantToggle() {
	const open = useAiAssistantStore(function (s) {
		return s.open
	})
	const toggleOpen = useAiAssistantStore(function (s) {
		return s.toggleOpen
	})
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Button
					variant='ghost'
					size='icon'
					onClick={toggleOpen}
					aria-label={open ? 'Close AI assistant' : 'Open AI assistant'}
					aria-expanded={open}
					aria-controls='ai-assistant-panel'
					role='menuitem'
					className={cn(
						'h-10 w-10 rounded-md text-sidebar-foreground transition-[background-color,color] duration-150 ease-[var(--ease-out)]',
						open
							? 'bg-sidebar-accent text-sidebar-accent-foreground'
							: 'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
					)}
				>
					<Sparkles className='h-5 w-5' />
				</Button>
			</TooltipTrigger>
			<TooltipContent side='right'>
				{open ? 'Close AI assistant' : 'Open AI assistant'}
			</TooltipContent>
		</Tooltip>
	)
}

/**
 * The assistant reads what it needs from the store rather than being handed it
 * by the shell. Its editor context updates on every keystroke, so keeping that
 * subscription here — in a leaf mounted only while the panel is open — is what
 * keeps typing out of the shell's render path.
 */
export function AiAssistantPanelHost() {
	const open = useAiAssistantStore(function (s) {
		return s.open
	})
	const activeConnectionId = useActiveConnectionId()
	const activeNavId = useActiveNavId()
	const activeTab = useActiveTab()
	const editorContext = useAiEditorContext()

	const handleInsertSql = useCallback(function (sql: string) {
		scheduleSqlConsoleCommand(
			{ type: 'load-query', query: sql, mode: 'sql', execute: false },
			{
				navigate: navigateToSqlConsole
			}
		)
	}, [])

	const handleRunSql = useCallback(function (sql: string) {
		scheduleSqlConsoleCommand(
			{ type: 'load-query', query: sql, mode: 'sql', execute: true },
			{
				navigate: navigateToSqlConsole
			}
		)
	}, [])

	if (!open) return null

	return (
		<Suspense fallback={null}>
			<AiAssistantPanel
				activeConnectionId={activeConnectionId || null}
				activeView={activeNavId}
				selectedTableId={activeTab?.tableId || null}
				selectedTableName={activeTab?.tableName || null}
				editorContext={activeNavId === 'sql-console' ? editorContext : null}
				onEditorInsert={handleInsertSql}
				onRunInConsole={handleRunSql}
			/>
		</Suspense>
	)
}

function navigateToSqlConsole() {
	setActiveNav('sql-console')
}
