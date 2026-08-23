import { WindowControls } from '@studio/components/window-controls'
import { formatShortcut } from '@studio/core/shortcuts'
import { TabBar } from '@studio/features/tab-bar'

type StartScreenProps = {
	newConnectionShortcut: string
	canDropFiles: boolean
	onAddConnection: () => void
}

function WorkspaceStartScreen({
	newConnectionShortcut,
	canDropFiles,
	onAddConnection
}: StartScreenProps) {
	return (
		<div className='flex flex-1 flex-col items-center justify-center px-6 select-none'>
			<span className='text-sm font-medium lowercase tracking-[0.2em] text-muted-foreground/70'>
				dora
			</span>
			<p className='mt-3 text-sm text-muted-foreground/60'>
				{canDropFiles ? 'Drop a database file, or ' : 'Press '}
				<kbd className='rounded border border-border/70 bg-muted/40 px-1.5 py-0.5 font-mono text-[11px] text-foreground/80'>
					{newConnectionShortcut}
				</kbd>
				{' to connect'}
			</p>
			<button
				onClick={onAddConnection}
				className='mt-6 rounded-md border border-border/70 px-3 py-1.5 text-sm text-foreground/80 transition-colors hover:border-border hover:text-foreground'
			>
				New connection
			</button>
		</div>
	)
}

type Props = {
	shortcut: string | string[]
	canDropFiles: boolean
	onAddConnection: () => void
}

export function WorkspaceStartScreenWithTabs({ shortcut, canDropFiles, onAddConnection }: Props) {
	return (
		<div className='flex flex-col flex-1 min-h-0'>
			<TabBar
				tabs={[]}
				activeTabId={null}
				onTabClick={function () {}}
				onTabClose={function () {}}
				rightSlot={<WindowControls />}
			/>
			<WorkspaceStartScreen
				newConnectionShortcut={formatShortcut(
					Array.isArray(shortcut) ? shortcut[0] : shortcut
				)}
				canDropFiles={canDropFiles}
				onAddConnection={onAddConnection}
			/>
		</div>
	)
}
