/** User-facing copy for local-file save/import flows (Phase 7). */

export const LOCAL_FILE_ERRORS = {
	noActiveFilesToSave:
		'No active data files to save. Fix or remove unavailable files, then try again.',
	destinationExists:
		'A DuckDB file already exists at that path. Choose a different path or confirm overwrite.',
	destinationParentMissing:
		'The destination folder does not exist. Create the folder or choose another path.',
	fileImportFailed: (path: string, reason: string) =>
		`Could not import ${path}: ${reason}`,
	partialImportCompleted: (imported: number, failed: number) =>
		`Imported ${imported} file${imported === 1 ? '' : 's'}. ${failed} failed — see details below.`,
	schemaRefreshFailed:
		'Files were imported, but the table list could not be refreshed. Reload the connection or switch away and back.',
	saveFailed: (reason: string) => `Could not save as DuckDB: ${reason}`,
	importFailed: (reason: string) => `Could not import files: ${reason}`,
} as const

export function mapSaveDataFileSessionError(raw: string): string {
	const message = raw.trim()
	if (!message) {
		return LOCAL_FILE_ERRORS.saveFailed('Unknown error')
	}
	if (message.includes('No active data files')) {
		return LOCAL_FILE_ERRORS.noActiveFilesToSave
	}
	if (message.includes('Destination already exists')) {
		return LOCAL_FILE_ERRORS.destinationExists
	}
	if (message.includes('Destination directory does not exist')) {
		return LOCAL_FILE_ERRORS.destinationParentMissing
	}
	return LOCAL_FILE_ERRORS.saveFailed(message)
}

export function mapImportFilesIntoDuckDbError(raw: string): string {
	const message = raw.trim()
	if (!message) {
		return LOCAL_FILE_ERRORS.importFailed('Unknown error')
	}
	return LOCAL_FILE_ERRORS.importFailed(message)
}
