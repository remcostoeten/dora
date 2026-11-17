import type { StatusTone } from '../utilities/container-status'

type Props = {
	tone: StatusTone
	label?: string
}

export function StatusDot({ tone, label }: Props) {
	return (
		<span
			className='dk-dot'
			data-tone={tone}
			role={label ? 'img' : undefined}
			aria-label={label}
			aria-hidden={label ? undefined : true}
		/>
	)
}
