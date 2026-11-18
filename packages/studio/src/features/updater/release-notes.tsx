import { parseReleaseNotes } from './update-policy'

type Props = {
	notes?: string
}

export function ReleaseNotes({ notes }: Props) {
	const items = parseReleaseNotes(notes)
	if (items.length === 0) return null
	return (
		<ul className='flex flex-col gap-1.5'>
			{items.map((item) => (
				<li
					key={item}
					className="relative pl-3.5 text-[12.5px] leading-snug text-secondary-foreground before:absolute before:left-0.5 before:top-[7px] before:h-1 before:w-1 before:rounded-full before:bg-muted-foreground before:content-['']"
				>
					{item}
				</li>
			))}
		</ul>
	)
}
