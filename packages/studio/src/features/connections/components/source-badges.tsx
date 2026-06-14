import { Badge } from '@studio/shared/ui/badge'
import { cn } from '@studio/shared/utils/cn'
import { describeConnectionSource, type ConnectionSourceInput } from '../resolve-source'
import { getSourceCaps } from '../source-caps'
import {
	resolveProviderLabel,
	resolveSourceKindBadge,
	shouldShowSourceKindBadge,
} from '../source-labels'

type Props = {
	connection: ConnectionSourceInput
	className?: string
	compact?: boolean
	showReadonly?: boolean
}

export function SourceBadges({
	connection,
	className,
	compact = false,
	showReadonly = true,
}: Props) {
	const meta = describeConnectionSource(connection)
	const caps = getSourceCaps(connection, meta)
	const providerLabel = resolveProviderLabel(meta)
	const sourceBadge = resolveSourceKindBadge(meta)

	return (
		<span className={cn('inline-flex items-center gap-1 flex-wrap', className)}>
			<Badge
				variant='outline'
				className={cn(
					'font-normal',
					compact && 'rounded-sm px-1.5 py-0 text-[10px] leading-4 h-4 border-border/70'
				)}
			>
				{providerLabel}
			</Badge>
			{shouldShowSourceKindBadge(meta) && (
				<Badge
					variant='secondary'
					className={cn(
						'font-normal',
						compact && 'rounded-sm px-1.5 py-0 text-[10px] leading-4 h-4'
					)}
				>
					{sourceBadge}
				</Badge>
			)}
			{showReadonly && caps.isReadonly && meta.kind !== 'data-file' && (
				<Badge
					variant='outline'
					className={cn(
						'font-normal text-muted-foreground',
						compact && 'rounded-sm px-1.5 py-0 text-[10px] leading-4 h-4 border-border/70'
					)}
				>
					Readonly
				</Badge>
			)}
		</span>
	)
}
