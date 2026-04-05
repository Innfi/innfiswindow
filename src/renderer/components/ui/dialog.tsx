import * as React from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"
import { cn } from "../../lib/utils"

interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}

function Dialog({
  open,
  onOpenChange,
  children,
}: DialogProps): JSX.Element | null {
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
      <div
        className="fixed inset-0 bg-black/50"
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />
      {children}
    </div>,
    document.body,
  )
}

interface DialogContentProps {
  className?: string
  children: React.ReactNode
  onClose?: () => void
}

function DialogContent({
  className,
  children,
  onClose,
}: DialogContentProps): JSX.Element {
  return (
    <div
      className={cn(
        "relative z-50 bg-background border rounded-lg shadow-lg w-full max-w-md p-6 space-y-4",
        className,
      )}
      onClick={(e) => e.stopPropagation()}
    >
      {onClose && (
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100 focus:outline-none"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      )}
      {children}
    </div>
  )
}

function DialogHeader({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}): JSX.Element {
  return <div className={cn("space-y-1.5", className)}>{children}</div>
}

function DialogTitle({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}): JSX.Element {
  return <h2 className={cn("text-lg font-semibold", className)}>{children}</h2>
}

function DialogDescription({
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

function DialogFooter({
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
}
