"use client"

import type { ReactNode } from "react"
import { useState } from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/ui/alert-dialog"
import { AlertTriangle, Trash2, Info, CopyPlus } from "lucide-react"
import { cn } from "@/shared/utils"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void | Promise<void>
  title: string
  desc: string
  variant?: "danger" | "warning" | "info" | "default"
  confirmText?: string
  cancelText?: string
  children?: ReactNode
}

export function ConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  title,
  desc,
  variant = "danger",
  confirmText = "Confirm",
  cancelText = "Cancel",
  children,
}: Props) {
  const [loading, setLoading] = useState(false)

  const handleConfirm = async () => {
    setLoading(true)
    try {
      await onConfirm()
      onOpenChange(false)
    } finally {
      setLoading(false)
    }
  }

  const variantStyles = {
    danger: {
      icon: Trash2,
      color: "text-destructive",
      bg: "bg-destructive/10",
      button: "bg-destructive hover:bg-destructive/90",
    },
    warning: {
      icon: AlertTriangle,
      color: "text-amber-500",
      bg: "bg-amber-500/10",
      button: "bg-amber-500 hover:bg-amber-500/90",
    },
    info: {
      icon: Info,
      color: "text-primary",
      bg: "bg-primary/10",
      button: "bg-primary hover:bg-primary/90",
    },
    default: {
      icon: CopyPlus,
      color: "text-primary",
      bg: "bg-primary/10",
      button: "bg-primary hover:bg-primary/90",
    },
  }

  const style = variantStyles[variant]
  const Icon = style.icon

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-start gap-3">
            <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", style.bg)}>
              <Icon className={cn("h-5 w-5", style.color)} />
            </div>
            <div className="flex-1">
              <AlertDialogTitle>{title}</AlertDialogTitle>
              <AlertDialogDescription className="mt-2">{desc}</AlertDialogDescription>
              {children}
            </div>
          </div>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>{cancelText}</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} disabled={loading} className={style.button}>
            {loading ? "Processing..." : confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
