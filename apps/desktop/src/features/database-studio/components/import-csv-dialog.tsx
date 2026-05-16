import { useRef, useState, useMemo } from 'react'
import { parseCSV } from '../utils/csv-parser'
import { autoMapColumns, detectTypeMismatch, type ColumnMapping } from '../utils/csv-type-check'
import type { ColumnDefinition } from '../types'
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter
} from '@/shared/ui/dialog'
import { Button } from '@/shared/ui/button'
import { AlertTriangle, Upload } from 'lucide-react'

type Props = {
	open: boolean
	onOpenChange: (open: boolean) => void
	columns: ColumnDefinition[]
	onImport: (rows: Record<string, unknown>[]) => Promise<{ imported: number; errors: string[] }>
}

export function ImportCsvDialog({ open, onOpenChange, columns, onImport }: Props) {
	const fileInputRef = useRef<HTMLInputElement>(null)
	const [csvHeaders, setCsvHeaders] = useState<string[]>([])
	const [csvRows, setCsvRows] = useState<string[][]>([])
	const [mapping, setMapping] = useState<ColumnMapping>({})
	const [parseError, setParseError] = useState<string | null>(null)
	const [step, setStep] = useState<'pick' | 'map' | 'importing' | 'done'>('pick')
	const [progress, setProgress] = useState(0)
	const [result, setResult] = useState<{ imported: number; errors: string[] } | null>(null)
	const [skipFirstRow, setSkipFirstRow] = useState(false)
	const [stopOnError, setStopOnError] = useState(false)
	const nonPKColumns = useMemo(() => columns.filter((c) => !c.primaryKey), [columns])

	function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0]
		if (!file) return

		const MAX_FILE_SIZE_MB = 10
		if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
			setParseError(`File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum size is ${MAX_FILE_SIZE_MB} MB.`)
			if (fileInputRef.current) fileInputRef.current.value = ''
			return
		}

		const reader = new FileReader()
		reader.onload = (ev) => {
			const text = ev.target?.result as string
			const parsed = parseCSV(text)
			if (parsed.error) {
				setParseError(parsed.error)
				return
			}
			setCsvHeaders(parsed.headers)
			setCsvRows(parsed.rows)
			setMapping(autoMapColumns(parsed.headers, nonPKColumns))
			setParseError(null)
			setStep('map')
		}
		reader.readAsText(file)
	}

	async function handleImport() {
		setStep('importing')
		const rowsToProcess = skipFirstRow ? csvRows.slice(1) : csvRows
		if (rowsToProcess.length === 0) {
			setResult({ imported: 0, errors: [] })
			setStep('done')
			return
		}
		const total = rowsToProcess.length
		let done = 0
		const errors: string[] = []
		let importedCount = 0

		for (const csvRow of rowsToProcess) {
			const obj: Record<string, unknown> = {}
			csvHeaders.forEach((header, idx) => {
				const dbCol = mapping[header]
				if (!dbCol) return
				const val = csvRow[idx]
				obj[dbCol] = val === '' ? null : val
			})

			try {
				const res = await onImport([obj])
				importedCount += res.imported
				if (res.errors.length > 0) {
					const rowNum = done + (skipFirstRow ? 2 : 1)
					errors.push(...res.errors.map((e) => `Row ${rowNum}: ${e}`))
					if (stopOnError) {
						done++
						setProgress(Math.round((done / total) * 100))
						break
					}
				}
			} catch (err) {
				const rowNum = done + (skipFirstRow ? 2 : 1)
				errors.push(`Row ${rowNum}: ${err instanceof Error ? err.message : String(err)}`)
				if (stopOnError) {
					done++
					setProgress(Math.round((done / total) * 100))
					break
				}
			}
			done++
			setProgress(Math.round((done / total) * 100))
		}

		setResult({ imported: importedCount, errors })
		setStep('done')
	}

	function handleClose() {
		setStep('pick')
		setCsvHeaders([])
		setCsvRows([])
		setMapping({})
		setParseError(null)
		setProgress(0)
		setResult(null)
		setSkipFirstRow(false)
		setStopOnError(false)
		if (fileInputRef.current) fileInputRef.current.value = ''
		onOpenChange(false)
	}

	return (
		<Dialog open={open} onOpenChange={handleClose}>
			<DialogContent className='max-w-2xl'>
				<DialogHeader>
					<DialogTitle>Import CSV</DialogTitle>
				</DialogHeader>

				{step === 'pick' && (
					<div className='flex flex-col items-center gap-4 py-8'>
						{parseError && (
							<p className='text-sm text-destructive flex gap-2 items-center'>
								<AlertTriangle className='h-4 w-4' /> {parseError}
							</p>
						)}
						<Button onClick={() => fileInputRef.current?.click()} className='gap-2'>
							<Upload className='h-4 w-4' /> Select CSV file
						</Button>
						<input
							ref={fileInputRef}
							type='file'
							accept='.csv,.tsv'
							className='hidden'
							onChange={handleFileChange}
						/>
					</div>
				)}

				{step === 'map' && (
					<div className='flex flex-col gap-4'>
						{csvRows.length > 5000 && (
							<p className='text-xs text-amber-500 flex gap-1 items-center'>
								<AlertTriangle className='h-3 w-3' />
								Large file ({csvRows.length} rows). Import may take a moment.
							</p>
						)}

						{/* Preview */}
						<div className='overflow-x-auto border rounded text-xs'>
							<table className='w-full'>
								<thead className='bg-muted'>
									<tr>
										{csvHeaders.map((h) => (
											<th
												key={h}
												className='px-2 py-1 text-left font-mono'
											>
												{h}
											</th>
										))}
									</tr>
								</thead>
								<tbody>
									{csvRows.slice(skipFirstRow ? 1 : 0, skipFirstRow ? 6 : 5).map((row, i) => (
										<tr key={i} className='border-t'>
											{row.map((cell, j) => (
												<td key={j} className='px-2 py-1 font-mono'>
													{cell}
												</td>
											))}
										</tr>
									))}
								</tbody>
							</table>
						</div>

						{/* Mapping */}
						<div className='space-y-2'>
							<p className='text-sm font-medium'>Column mapping</p>
							{csvHeaders.map((header) => {
								const dbCol = mapping[header]
								const colDef = nonPKColumns.find((c) => c.name === dbCol)
								const sampleValue =
									csvRows[0]?.[csvHeaders.indexOf(header)] ?? ''
								const warning = colDef
									? detectTypeMismatch(sampleValue, colDef.type)
									: null
								return (
									<div key={header} className='flex items-center gap-3'>
										<span className='font-mono text-xs w-32 truncate'>
											{header}
										</span>
										<span className='text-muted-foreground'>→</span>
										<select
											value={dbCol ?? ''}
											onChange={(e) =>
												setMapping((prev) => ({
													...prev,
													[header]: e.target.value || null
												}))
											}
											className='flex-1 border rounded px-2 py-1 text-xs bg-background'
										>
											<option value=''>Skip</option>
											{nonPKColumns.map((c) => (
												<option key={c.name} value={c.name}>
													{c.name} ({c.type})
												</option>
											))}
										</select>
										{warning && (
											<span className='text-xs text-amber-500 flex gap-1 items-center'>
												<AlertTriangle className='h-3 w-3' />
												{warning}
											</span>
										)}
									</div>
								)
							})}

							{/* Options */}
							<div className='flex flex-col gap-2 pt-2 border-t text-sm'>
								<label className='flex items-center gap-2 cursor-pointer'>
									<input
										type='checkbox'
										checked={skipFirstRow}
										onChange={(e) => setSkipFirstRow(e.target.checked)}
										className='h-4 w-4'
									/>
									Skip first row (row 1 is data, not a header)
								</label>
								<label className='flex items-center gap-2 cursor-pointer'>
									<input
										type='checkbox'
										checked={stopOnError}
										onChange={(e) => setStopOnError(e.target.checked)}
										className='h-4 w-4'
									/>
									Stop on first error
								</label>
							</div>
						</div>

						<DialogFooter>
							<Button variant='outline' onClick={handleClose}>
								Cancel
							</Button>
							<Button onClick={handleImport}>Import {skipFirstRow ? Math.max(0, csvRows.length - 1) : csvRows.length} rows</Button>
						</DialogFooter>
					</div>
				)}

				{step === 'importing' && (
					<div className='flex flex-col gap-4 py-8'>
						<p className='text-sm text-center'>Importing {csvRows.length} rows...</p>
						<div className='w-full bg-muted rounded-full h-2'>
							<div
								className='bg-primary h-2 rounded-full transition-all'
								style={{ width: `${progress}%` }}
							/>
						</div>
						<p className='text-xs text-center text-muted-foreground'>{progress}%</p>
					</div>
				)}

				{step === 'done' && result && (
					<div className='flex flex-col gap-4 py-4'>
						<p className='text-sm font-medium'>
							Imported {result.imported} row{result.imported !== 1 ? 's' : ''}
							{result.errors.length > 0 && `, ${result.errors.length} skipped`}
						</p>
						{result.errors.length > 0 && (
							<details className='text-xs'>
								<summary className='cursor-pointer text-amber-500'>
									View {result.errors.length} errors
								</summary>
								<ul className='mt-2 space-y-1 font-mono'>
									{result.errors.map((e, i) => (
										<li key={i} className='text-destructive'>
											{e}
										</li>
									))}
								</ul>
							</details>
						)}
						<DialogFooter>
							<Button onClick={handleClose}>Done</Button>
						</DialogFooter>
					</div>
				)}
			</DialogContent>
		</Dialog>
	)
}
