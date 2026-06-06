import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { parseAssistantSqlResponse } from './assistant-response-parser'
import { CodeBlock } from './code-block'
import { StreamingMessageContent } from './streaming-message-content'

type Props = {
	content: string
	isStreaming?: boolean
	activeConnectionId: string | null
	onEditorInsert?: (sql: string) => void
}

export function MessageContent({
	content,
	isStreaming = false,
	activeConnectionId,
	onEditorInsert
}: Props) {
	if (isStreaming) {
		return <StreamingMessageContent content={content} />
	}

	const parsed = parseAssistantSqlResponse(content)

	if (parsed) {
		return (
			<div className='space-y-2'>
				{parsed.explanation && (
					<p className='my-1.5 text-sm leading-relaxed'>{parsed.explanation}</p>
				)}
				<CodeBlock
					language='sql'
					code={parsed.sql}
					activeConnectionId={activeConnectionId}
					onEditorInsert={onEditorInsert}
				/>
				{parsed.examples.map(function (example) {
					return (
						<CodeBlock
							key={example}
							language='sql'
							code={example}
							activeConnectionId={activeConnectionId}
							onEditorInsert={onEditorInsert}
						/>
					)
				})}
				{parsed.warnings.length > 0 && (
					<ul className='my-1.5 list-disc space-y-1 pl-5 text-sm text-amber-400'>
						{parsed.warnings.map(function (warning) {
							return <li key={warning}>{warning}</li>
						})}
					</ul>
				)}
			</div>
		)
	}

	return (
		<ReactMarkdown
			remarkPlugins={[remarkGfm]}
			components={{
				code(props) {
					const { className, children } = props as {
						className?: string
						children?: React.ReactNode
					}
					const isBlock = typeof className === 'string' && className.includes('language-')
					if (!isBlock) {
						return (
							<code className='rounded bg-zinc-800/70 px-1 py-0.5 font-mono text-[12px]'>
								{children}
							</code>
						)
					}
					const language = className?.replace('language-', '')
					const text = String(children ?? '').replace(/\n$/, '')
					return (
						<CodeBlock
							language={language}
							code={text}
							activeConnectionId={activeConnectionId}
							onEditorInsert={onEditorInsert}
						/>
					)
				},
				p(props) {
					return <p className='my-1.5 text-sm leading-relaxed'>{props.children}</p>
				},
				ul(props) {
					return <ul className='my-1.5 list-disc space-y-1 pl-5 text-sm'>{props.children}</ul>
				},
				ol(props) {
					return <ol className='my-1.5 list-decimal space-y-1 pl-5 text-sm'>{props.children}</ol>
				},
				a(props) {
					return (
						<a
							{...props}
							target='_blank'
							rel='noreferrer'
							className='text-primary underline-offset-2 hover:underline'
						/>
					)
				}
			}}
		>
			{content}
		</ReactMarkdown>
	)
}
