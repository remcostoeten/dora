import { Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { StudioDialog } from "./studio-dialog";

type Props = {
	open: boolean
	onOpenChange: (open: boolean) => void
	tableName: string
	onSubmit: (columnDef: ColumnFormData) => void
	isLoading?: boolean
}

export type ColumnFormData = {
	name: string
	type: string
	nullable: boolean
	defaultValue: string
}

const COLUMN_TYPES = [
	{ value: 'TEXT', label: 'TEXT' },
	{ value: 'INTEGER', label: 'INTEGER' },
	{ value: 'REAL', label: 'REAL' },
	{ value: 'BLOB', label: 'BLOB' },
	{ value: 'VARCHAR(255)', label: 'VARCHAR(255)' },
	{ value: 'BOOLEAN', label: 'BOOLEAN' },
	{ value: 'TIMESTAMP', label: 'TIMESTAMP' },
	{ value: 'DATE', label: 'DATE' },
	{ value: 'BIGINT', label: 'BIGINT' },
	{ value: 'DECIMAL(10,2)', label: 'DECIMAL(10,2)' }
]

export function AddColumnDialog({ open, onOpenChange, tableName, onSubmit, isLoading }: Props) {
	const [formData, setFormData] = useState<ColumnFormData>({
		name: '',
		type: 'TEXT',
		nullable: true,
		defaultValue: ''
	})

	function resetForm() {
		setFormData({
			name: '',
			type: 'TEXT',
			nullable: true,
			defaultValue: ''
		})
	}

	function handleOpenChange(newOpen: boolean) {
		if (!newOpen) {
			resetForm()
		}
		onOpenChange(newOpen)
	}

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault()
		if (!formData.name.trim()) return
		onSubmit(formData)
	}

	function updateField<K extends keyof ColumnFormData>(field: K, value: ColumnFormData[K]) {
		setFormData(function (prev) {
			return { ...prev, [field]: value }
		})
	}

	return (
		<StudioDialog
			open={open}
			onOpenChange={handleOpenChange}
			title='Add Column'
			description={
				<>
					Add a new column to <span className='font-mono text-primary'>{tableName}</span>
				</>
			}
			contentClassName='space-y-4'
			footer={
				<>
					<Button
						type='button'
						variant='outline'
						onClick={function () {
							handleOpenChange(false)
						}}
					>
						Cancel
					</Button>
					<Button
						type='button' // Change to button to trigger form submit remotely or keep form wrapping?
						// Actually better to keep form wrapping. StudioDialog children renders inside DialogContent.
						// But DialogFooter is outside. We need to trigger form submit.
						// The cleanest way with shadcn dialog is to have the button inside the form or use form id.
						// Let's use form id.
						onClick={function (e) {
							// We will make the form submit via ID or just put buttons inside form if we change StudioDialog?
							// StudioDialog puts footer in DialogFooter.
							// Let's use the 'form' attribute on the submit button.
						}}
						form='add-column-form'
						disabled={isLoading || !formData.name.trim()}
					>
						{isLoading && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
						Add Column
					</Button>
				</>
			}
		>
			<form id='add-column-form' onSubmit={handleSubmit} className='space-y-4'>
				<div className='space-y-2'>
					<Label htmlFor='column-name'>Column Name</Label>
					<Input
						id='column-name'
						value={formData.name}
						onChange={function (e) {
							updateField('name', e.target.value)
						}}
						placeholder='new_column'
						className='font-mono'
						autoFocus
					/>
				</div>

				<div className='space-y-2'>
					<Label htmlFor='column-type'>Data Type</Label>
					<Select
						value={formData.type}
						onValueChange={function (value) {
							updateField('type', value)
						}}
					>
						<SelectTrigger id='column-type'>
							<SelectValue placeholder='Select type' />
						</SelectTrigger>
						<SelectContent>
							{COLUMN_TYPES.map(function (type) {
								return (
									<SelectItem key={type.value} value={type.value}>
										{type.label}
									</SelectItem>
								)
							})}
						</SelectContent>
					</Select>
				</div>

				<div className='flex items-center space-x-2'>
					<Checkbox
						id='nullable'
						checked={formData.nullable}
						onCheckedChange={function (checked) {
							updateField('nullable', !!checked)
						}}
					/>
					<Label htmlFor='nullable' className='text-sm cursor-pointer'>
						Allow NULL values
					</Label>
				</div>

				<div className='space-y-2'>
					<Label htmlFor='default-value'>Default Value (optional)</Label>
					<Input
						id='default-value'
						value={formData.defaultValue}
						onChange={function (e) {
							updateField('defaultValue', e.target.value)
						}}
						placeholder='NULL'
						className='font-mono'
					/>
					<p className='text-xs text-muted-foreground'>
						Leave empty for no default. Use single quotes for strings.
					</p>
				</div>
			</form>
		</StudioDialog>
	)
}
