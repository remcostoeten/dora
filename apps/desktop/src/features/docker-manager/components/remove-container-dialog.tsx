import { AlertTriangle, Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Label } from "@/shared/ui/label";
import { RemoveContainerOptions } from "../types";

type Props = {
    containerName: string
    open: boolean
    onOpenChange: (open: boolean) => void
    onConfirm: (options: RemoveContainerOptions) => void
    isRemoving: boolean
}

export function RemoveContainerDialog({
    containerName,
    open,
    onOpenChange,
    onConfirm,
    isRemoving
}: Props) {
    const [removeVolumes, setRemoveVolumes] = useState(false)

    function handleConfirm() {
        onConfirm({
            force: true,
            removeVolumes
        })
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className='sm:max-w-md'>
                <DialogHeader>
                    <DialogTitle className='flex items-center gap-2 text-destructive'>
                        <AlertTriangle className='h-5 w-5' />
                        Remove Container
                    </DialogTitle>
                    <DialogDescription>
                        Are you sure you want to remove <strong>{containerName}</strong>?
                        <br />
                        This action cannot be undone.
                    </DialogDescription>
                </DialogHeader>

                <div className='py-4'>
                    <div className="flex items-start space-x-2">
                        <Checkbox
                            id="remove-volumes"
                            checked={removeVolumes}
                            onCheckedChange={(checked) => setRemoveVolumes(checked === true)}
                        />
                        <div className="grid gap-1.5 leading-none">
                            <Label
                                htmlFor="remove-volumes"
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                                Also remove associated data volume
                            </Label>
                            <p className="text-xs text-muted-foreground">
                                e.g. {containerName}_data
                            </p>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        variant='outline'
                        onClick={() => onOpenChange(false)}
                        disabled={isRemoving}
                    >
                        Cancel
                    </Button>
                    <Button
                        variant='destructive'
                        onClick={handleConfirm}
                        disabled={isRemoving}
                    >
                        {isRemoving ? (
                            <>
                                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                                Removing...
                            </>
                        ) : (
                            'Remove Container'
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
