import { X } from "lucide-react"

import { cn } from "../../lib/utils"

interface ClosePanelButtonProps {
  onClose: () => void
  className?: string
}

export function ClosePanelButton({
  onClose,
  className,
}: ClosePanelButtonProps): JSX.Element {
  return (
    <button
      onClick={onClose}
      className={cn(
        "rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        className,
      )}
      aria-label="Close panel"
    >
      <X className="h-4 w-4" />
    </button>
  )
}
