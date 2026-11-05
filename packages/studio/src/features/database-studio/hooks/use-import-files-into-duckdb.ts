import { useMutation } from '@tanstack/react-query'
import { useAdapter } from '@studio/core/data-provider'
import { getAdapterError } from '@studio/core/data-provider/types'

export function useImportFilesIntoDuckdb() {
	const adapter = useAdapter()

	return useMutation({
		mutationFn: async function (params: { connectionId: string; filePaths: string[] }) {
			const res = await adapter.importFilesIntoDuckdb(params.connectionId, params.filePaths)
			if (!res.ok) {
				throw new Error(getAdapterError(res))
			}
			return res.data
		}
	})
}
