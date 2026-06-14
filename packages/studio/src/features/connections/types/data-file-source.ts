export type {
	DataFileSourceEntry,
	DataFileSourceStatus,
	DatabaseConnectResult,
} from '@studio/lib/bindings'

export function isActiveDataFileSource(
	entry: { status: string }
): entry is { status: 'active' } {
	return entry.status === 'active'
}

export function dataFileSourceStatusLabel(status: string): string {
	switch (status) {
		case 'active':
			return 'Active'
		case 'missing':
			return 'Missing'
		case 'failed':
			return 'Failed'
		default:
			return status
	}
}

export function hasActiveDataFileSources(
	entries: { status: string }[] | null | undefined
): boolean {
	return (entries ?? []).some(isActiveDataFileSource)
}
