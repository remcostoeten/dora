import { Sparkles, User } from 'lucide-react'
import { cn } from '@studio/shared/utils/cn'
import { MessageContent } from './message-content'
import type { ChatMessage } from './types'

type Props = {
	message: ChatMessage
	activeConnectionId: string | null
	onEditorInsert?: (sql: string) => void
}

export function MessageBubble({ message, activeConnectionId, onEditorInsert }: Props) {
	const isUser = message.role === 'user'

	return (
		<div className={cn('flex gap-2 px-3 py-2', isUser ? 'bg-sidebar-accent/30' : '')}>
			<div className='mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sidebar-border'>
				{isUser ? (
					<User className='h-3 w-3 text-muted-foreground' />
				) : (
					<Sparkles className='h-3 w-3 text-primary' />
				)}
			</div>

			<div className='min-w-0 flex-1'>
				{isUser ? (
					<div className='whitespace-pre-wrap text-sm leading-relaxed text-foreground'>
						{message.content}
					</div>
				) : (
					<div className='prose prose-invert max-w-none text-sm'>
						<MessageContent
							content={message.content || (message.streaming ? '…' : '')}
							activeConnectionId={activeConnectionId}
							onEditorInsert={onEditorInsert}
						/>
					</div>
				)}
				{message.error && (
					<div className='mt-1 rounded border border-red-500/40 bg-red-500/10 px-2 py-1 text-[11px] text-red-400'>
						{message.error}
					</div>
				)}
				{message.streaming && !message.error && (
					<span className='ml-0.5 inline-block h-3 w-1.5 animate-pulse bg-primary align-middle' />
				)}
			</div>
		</div>
	)
}
