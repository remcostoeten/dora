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
import { usePresence } from '@studio/shared/hooks/use-presence'
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
	if (open) return null
	return (
		<Button
			variant='outline'
			size='icon'
			onClick={toggleOpen}
			title='Open AI assistant'
			className='fixed bottom-4 right-4 z-[70] h-10 w-10 rounded-full shadow-lg animate-in fade-in duration-150'
		>
			<Sparkles className='h-4 w-4' />
		</Button>
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
	const { present } = usePresence(open, 200)
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

	if (!present) return null

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
