"use client"

import type React from "react"

import { useState } from "react"
import { Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface RowNumberCellProps {
  rowIndex: number
  rowHeight: "compact" | "normal" | "comfortable"
  isSelected: boolean
  selectedCount: number
  onSelect: (e: React.MouseEvent) => void
  onDelete: () => void
}

const heightClasses = {
  compact: "py-1",
  normal: "py-2",
  comfortable: "py-3",
}

export function RowNumberCell({
  rowIndex,
  rowHeight,
  isSelected,
  selectedCount,
  onSelect,
  onDelete,
}: RowNumberCellProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  const deleteCount = selectedCount > 0 && isSelected ? selectedCount : 1

  const handleDelete = () => {
    setShowDeleteDialog(false)
    onDelete()
  }

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <td
            onClick={onSelect}
            className={cn(
              "cursor-pointer select-none border-r border-border/30 px-3 text-right tabular-nums transition-colors",
              heightClasses[rowHeight],
              isSelected ? "bg-primary/20 text-primary" : "bg-card/50 text-muted-foreground/50 hover:bg-accent/30",
            )}
          >
            {rowIndex + 1}
          </td>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-56">
          <ContextMenuItem
            onClick={() => setShowDeleteDialog(true)}
            className="text-destructive focus:text-destructive focus:bg-destructive/10"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            <span>Delete {deleteCount > 1 ? `${deleteCount} rows` : "row"}</span>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="border-border/50 bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">
              Delete {deleteCount > 1 ? `${deleteCount} rows` : "row"}?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              {deleteCount > 1
                ? `This will permanently delete ${deleteCount} selected rows. This action cannot be undone.`
                : `This will permanently delete row ${rowIndex + 1}. This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border/50 bg-transparent hover:bg-accent">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
