type Segment =
	| { type: 'text'; content: string; key: string }
	| { type: 'code'; language: string; content: string; incomplete: boolean; key: string }

function splitStreamingMarkdown(content: string): Segment[] {
	const segments: Segment[] = []
	let index = 0
	let segmentIndex = 0

	while (index < content.length) {
		const fenceStart = content.indexOf('```', index)
		if (fenceStart === -1) {
			const text = content.slice(index)
			if (text) {
				segments.push({ type: 'text', content: text, key: `text-${segmentIndex}` })
				segmentIndex += 1
			}
			break
		}

		if (fenceStart > index) {
			segments.push({
				type: 'text',
				content: content.slice(index, fenceStart),
				key: `text-${segmentIndex}`
			})
			segmentIndex += 1
		}

		const languageEnd = content.indexOf('\n', fenceStart + 3)
		if (languageEnd === -1) {
			segments.push({
				type: 'code',
				language: '',
				content: content.slice(fenceStart + 3),
				incomplete: true,
				key: `code-${segmentIndex}`
			})
			break
		}

		const language = content.slice(fenceStart + 3, languageEnd).trim()
		const codeStart = languageEnd + 1
		const fenceEnd = content.indexOf('```', codeStart)

		if (fenceEnd === -1) {
			segments.push({
				type: 'code',
				language,
				content: content.slice(codeStart),
				incomplete: true,
				key: `code-${segmentIndex}`
			})
			break
		}

		segments.push({
			type: 'code',
			language,
			content: content.slice(codeStart, fenceEnd),
			incomplete: false,
			key: `code-${segmentIndex}`
		})
		segmentIndex += 1
		index = fenceEnd + 3
	}

	return segments
}

type Props = {
	content: string
}

export function StreamingMessageContent({ content }: Props) {
	if (!content) {
		return <span className='text-muted-foreground'>…</span>
	}

	const segments = splitStreamingMarkdown(content)

	return (
		<div className='space-y-2'>
			{segments.map(function (segment) {
				if (segment.type === 'text') {
					const trimmed = segment.content.trim()
					if (!trimmed) return null
					return (
						<div
							key={segment.key}
							className='whitespace-pre-wrap text-sm leading-relaxed text-foreground'
						>
							{segment.content}
						</div>
					)
				}

				return (
					<div
						key={segment.key}
						className='my-2 overflow-hidden rounded-md border border-sidebar-border bg-zinc-900/60'
					>
						<div className='border-b border-sidebar-border px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground'>
							<span className='font-semibold text-zinc-300'>
								{segment.language || 'code'}
							</span>
							{segment.incomplete && (
								<span className='ml-2 normal-case tracking-normal text-primary/80'>
									writing…
								</span>
							)}
						</div>
						<pre className='m-0 max-h-64 overflow-auto p-3 text-xs leading-relaxed text-zinc-100'>
							<code>{segment.content}</code>
						</pre>
					</div>
				)
			})}
		</div>
	)
}
