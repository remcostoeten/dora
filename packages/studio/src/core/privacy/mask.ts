// Privacy mode masking helpers.
//
// When the `privacyMaskData` setting is enabled, every individual cell value in
// query/table results is replaced with a fixed mask token so the contents of
// the database cannot be read — while table names, column headers, and the
// query itself stay visible. The token is a constant run of bullets so the
// masked output never leaks the length (or even the presence) of the real
// value, and it can't be revealed by selecting the text.

export const MASK_TOKEN = '••••••'

// Replace every cell value in a result set with the mask token, preserving the
// row/column shape. Used for JSON result views, which would otherwise serialize
// the raw values verbatim.
export function maskRowsForJson(
	rows: Array<Record<string, unknown>>
): Array<Record<string, unknown>> {
	return rows.map(function maskRow(row) {
		const masked: Record<string, unknown> = {}
		for (const key of Object.keys(row)) {
			masked[key] = MASK_TOKEN
		}
		return masked
	})
}
