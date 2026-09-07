import { Sparkles, User } from 'lucide-react'
import { memo } from 'react'
import { cn } from '@studio/shared/utils/cn'
import { MessageContent } from './message-content'
import type { ChatMessage } from './types'

type Props = {
	message: ChatMessage
	activeConnectionId: string | null
	onEditorInsert?: (sql: string) => void
	onRunInConsole?: (sql: string) => void
}

export const MessageBubble = memo(function MessageBubble({
	message,
	activeConnectionId,
	onEditorInsert,
	onRunInConsole
}: Props) {
	const isUser = message.role === 'user'

	return (
		<div className={cn('flex px-4 py-3.5', isUser ? 'justify-end' : 'gap-3')}>
			{!isUser && (
				<div className='mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary'>
					<Sparkles className='h-3.5 w-3.5' />
				</div>
			)}

			<div
				className={cn(
					'min-w-0',
					isUser
						? 'max-w-[88%] rounded-lg border border-sidebar-border bg-sidebar-accent/60 px-3 py-2'
						: 'flex-1'
				)}
			>
				{isUser ? (
					<div className='flex gap-2'>
						<User className='mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground' />
						<div className='whitespace-pre-wrap text-sm leading-relaxed text-foreground'>
							{message.content}
						</div>
					</div>
				) : (
					<div className='prose max-w-none text-sm dark:prose-invert'>
						<MessageContent
							content={message.content || (message.streaming ? '' : '')}
							isStreaming={message.streaming}
							activeConnectionId={activeConnectionId}
							onEditorInsert={onEditorInsert}
							onRunInConsole={onRunInConsole}
						/>
					</div>
				)}
				{message.error && (
					<div className='mt-1 rounded border border-red-500/40 bg-red-500/10 px-2 py-1 text-[11px] text-red-400'>
						{message.error}
					</div>
				)}
				{message.streaming && !message.error && message.content.trim().length > 0 && (
					<span
						aria-hidden
						className='ml-0.5 inline-block h-3.5 w-[2px] animate-pulse rounded-full bg-primary/80 align-middle'
					/>
				)}
			</div>
		</div>
	)
})
