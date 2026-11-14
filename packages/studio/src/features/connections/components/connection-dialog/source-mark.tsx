import { memo } from 'react'
import { cn } from '@studio/shared/utils/cn'
import { getSource, type ListedSourceId } from './sources'

type Props = {
	id: ListedSourceId
	size?: 'sm' | 'md' | 'lg'
}

const SIZE = {
	sm: 'h-[22px] w-[22px] [&_svg]:h-3 [&_svg]:w-3',
	md: 'h-[30px] w-[30px]',
	lg: 'h-9 w-9'
} as const

function accentStyle(accent: string): React.CSSProperties {
	// CSSProperties has no custom-property keys, so the accent variable needs this assertion
	return { '--c': accent } as React.CSSProperties
}

export const SourceMark = memo(function SourceMark({ id, size = 'md' }: Props) {
	const { accent, icon } = getSource(id)

	return (
		<span
			aria-hidden='true'
			style={accent ? accentStyle(accent) : undefined}
			className={cn(
				'grid flex-none place-items-center border',
				SIZE[size],
				accent
					? 'border-[hsl(var(--c)/0.28)] bg-[hsl(var(--c)/0.09)] text-[hsl(var(--c))] [.light_&]:text-[color-mix(in_srgb,hsl(var(--c))_62%,black)]'
					: 'border-border bg-foreground/[0.06] text-foreground/75'
			)}
		>
			{icon}
		</span>
	)
})
