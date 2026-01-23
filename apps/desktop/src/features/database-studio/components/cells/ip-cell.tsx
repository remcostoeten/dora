import React from "react";

type Props = {
	value: string
}

export function IpCell({ value }: Props) {
	if (!value) return <span className='text-muted-foreground italic'>NULL</span>

	const text = String(value)

	return (
		<div className='inline-flex items-center px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-500 dark:text-blue-400 border border-blue-500/20 font-mono text-[11px] font-medium tracking-wide'>
			{text}
		</div>
	)
}
