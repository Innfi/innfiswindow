import { type ReactNode } from "react"

export function DetailPanelLayout({
  children,
}: {
  children: ReactNode
}): JSX.Element {
  return (
    <div className="w-1/2 shrink-0 bg-card text-card-foreground border border-border shadow-md h-full overflow-auto p-4 space-y-4">
      {children}
    </div>
  )
}
