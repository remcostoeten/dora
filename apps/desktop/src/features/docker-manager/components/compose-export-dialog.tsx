import { Copy, Download, FileCode } from "lucide-react";
import { useState } from "react";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import type { DockerContainer } from "../types";
import { generateDockerCompose } from "../utilities/docker-compose-generator";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";

type Props = {
    container: DockerContainer
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function ComposeExportDialog({ container, open, onOpenChange }: Props) {
    const { toast } = useToast()
    const [yamlContent] = useState(() => generateDockerCompose(container))

    async function handleCopy() {
        try {
            await navigator.clipboard.writeText(yamlContent)
            toast({
                title: 'Copied to clipboard',
                description: 'Docker Compose configuration copied.'
            })
        } catch {
            toast({
                title: 'Failed to copy',
                variant: 'destructive'
            })
        }
    }

    async function handleDownload() {
        try {
            // Save dialog using Tauri API
            const savePath = await save({
                filters: [{
                    name: 'YAML',
                    extensions: ['yml', 'yaml']
                }],
                defaultPath: 'docker-compose.yml'
            });

            if (savePath) {
                await writeTextFile(savePath, yamlContent);
                toast({
                    title: 'File Saved',
                    description: `Saved to ${savePath}`
                });
            }
        } catch (error) {
            console.error('Failed to save file:', error);
            toast({
                title: 'Failed to save file',
                description: String(error),
                variant: 'destructive'
            })
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className='sm:max-w-2xl'>
                <DialogHeader>
                    <DialogTitle className='flex items-center gap-2'>
                        <FileCode className='h-5 w-5 text-primary' />
                        Export Docker Compose
                    </DialogTitle>
                    <DialogDescription>
                        Generated configuration for <strong>{container.name}</strong>.
                    </DialogDescription>
                </DialogHeader>

                <div className='mt-4 relative'>
                    <pre className='p-4 rounded-lg bg-zinc-950 text-xs font-mono text-zinc-300 overflow-auto max-h-[400px] whitespace-pre-wrap border border-border'>
                        {yamlContent}
                    </pre>
                </div>

                <div className='flex justify-end gap-2 mt-4'>
                    <Button variant='outline' onClick={() => onOpenChange(false)}>
                        Close
                    </Button>
                    <Button variant='secondary' onClick={handleCopy} className='gap-2'>
                        <Copy className='h-4 w-4' />
                        Copy
                    </Button>
                    <Button variant='default' onClick={handleDownload} className='gap-2'>
                        <Download className='h-4 w-4' />
                        Save as File
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
