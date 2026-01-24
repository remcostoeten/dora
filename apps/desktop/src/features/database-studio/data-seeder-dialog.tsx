import { useState } from 'react'
import { generateData, TableColumn } from '@/core/data-generation/generator'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/shared/ui/dialog'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { Loader2, Sparkles } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'

type Props = {
    open: boolean
    onOpenChange: (open: boolean) => void
    tableName: string
    columns: TableColumn[]
    onGenerate: (data: any[]) => Promise<void>
}

export function DataSeederDialog({ open, onOpenChange, tableName, columns, onGenerate }: Props) {
    const [rowCount, setRowCount] = useState<number>(50)
    const [previewData, setPreviewData] = useState<any[]>([])
    const [isGenerating, setIsGenerating] = useState(false)
    const { toast } = useToast()

    function handlePreview() {
        const data = generateData(columns, 5)
        setPreviewData(data)
    }

    async function handleGenerate() {
        try {
            setIsGenerating(true)
            const data = generateData(columns, rowCount)
            await onGenerate(data)
            toast({
                title: 'Data Generated',
                description: `Successfully generated ${rowCount} rows for ${tableName}`
            })
            onOpenChange(false)
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to insert generated data',
                variant: 'destructive'
            })
        } finally {
            setIsGenerating(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className='max-w-3xl'>
                <DialogHeader>
                    <DialogTitle>Smart Data Seeder</DialogTitle>
                    <DialogDescription>
                        Generate realistic mock data for <span className='font-mono font-bold'>{tableName}</span> using AI-powered schema analysis.
                    </DialogDescription>
                </DialogHeader>

                <div className='grid gap-4 py-4'>
                    <div className='grid grid-cols-4 items-center gap-4'>
                        <Label htmlFor='row-count' className='text-right'>
                            Row Count
                        </Label>
                        <Input
                            id='row-count'
                            type='number'
                            value={rowCount}
                            onChange={(e) => setRowCount(Number(e.target.value))}
                            className='col-span-3'
                            min={1}
                            max={1000}
                        />
                    </div>

                    <div className='flex justify-end'>
                        <Button variant='outline' size='sm' onClick={handlePreview}>
                            <Sparkles className='mr-2 h-4 w-4' />
                            Preview Data
                        </Button>
                    </div>

                    {previewData.length > 0 && (
                        <div className='border rounded-md max-h-[300px] overflow-auto'>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        {columns.slice(0, 5).map((col) => (
                                            <TableHead key={col.name} className='whitespace-nowrap'>
                                                {col.name}
                                            </TableHead>
                                        ))}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {previewData.map((row, i) => (
                                        <TableRow key={i}>
                                            {columns.slice(0, 5).map((col) => (
                                                <TableCell key={col.name} className='font-mono text-xs truncate max-w-[150px]'>
                                                    {String(row[col.name])}
                                                </TableCell>
                                            ))}
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant='outline' onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleGenerate} disabled={isGenerating}>
                        {isGenerating && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
                        Generate {rowCount} Rows
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
