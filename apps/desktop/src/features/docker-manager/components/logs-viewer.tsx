import { RefreshCw } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "@/shared/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { LOG_TAIL_OPTIONS, DEFAULT_LOG_TAIL } from "../constants";

type Props = {
	logs: string
	isLoading: boolean
	tailLines: number
	onTailLinesChange: (lines: number) => void
	tailLines: number
	onTailLinesChange: (lines: number) => void
}

export function LogsViewer({ logs, isLoading, tailLines, onTailLinesChange }: Props) {
	const logsContainerRef = useRef<HTMLPreElement>(null)

	useEffect(
		function scrollToBottom() {
			if (logsContainerRef.current) {
				logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight
			}
		},
		[logs]
	)

	function handleTailChange(value: string) {
		onTailLinesChange(parseInt(value, 10))
	}

	return (
		<div className='flex flex-col h-full'>
			<div className='flex items-center justify-between gap-2 pb-2 border-b border-border'>
				<div className='flex items-center gap-2'>
					<span className='text-xs text-muted-foreground'>Show last</span>
					<Select value={String(tailLines)} onValueChange={handleTailChange}>
						<SelectTrigger className='h-7 w-20 text-xs'>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{LOG_TAIL_OPTIONS.map(function (option) {
								return (
									<SelectItem key={option} value={String(option)}>
										{option} lines
									</SelectItem>
								)
							})}
						</SelectContent>
					</Select>
				</div>

				</div>
			</div>

			<pre
				ref={logsContainerRef}
				className='flex-1 mt-2 p-3 rounded bg-zinc-950 text-xs font-mono text-zinc-300 overflow-auto whitespace-pre-wrap break-all'
			>
				{logs || <span className='text-zinc-500'>No logs available</span>}
			</pre>
		</div >
	)
}
