import * as React from "react"
import { createPortal } from "react-dom"

import { cn } from "../../lib/utils"

interface AlertDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}

function AlertDialog({
  open,
  onOpenChange,
  children,
}: AlertDialogProps): JSX.Element | null {
  React.useEffect(() => {
    const handleKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onOpenChange(false)
    }
    if (open) document.addEventListener("keydown", handleKey)
    return () => document.removeEventListener("keydown", handleKey)
  }, [open, onOpenChange])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" aria-hidden="true" />
      {children}
    </div>,
    document.body,
  )
}

function AlertDialogContent({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}): JSX.Element {
  return (
    <div
      role="alertdialog"
      aria-modal="true"
      className={cn(
        "relative z-50 bg-background border rounded-lg shadow-lg w-full max-w-md p-6 space-y-4",
        className,
      )}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  )
}

function AlertDialogHeader({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}): JSX.Element {
  return <div className={cn("space-y-1.5", className)}>{children}</div>
}

function AlertDialogTitle({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}): JSX.Element {
  return <h2 className={cn("text-lg font-semibold", className)}>{children}</h2>
}

function AlertDialogDescription({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}): JSX.Element {
  return (
    <p className={cn("text-sm text-muted-foreground", className)}>{children}</p>
  )
}

function AlertDialogFooter({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}): JSX.Element {
  return (
    <div className={cn("flex justify-end gap-2 pt-2", className)}>
      {children}
    </div>
  )
}

export {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
}
