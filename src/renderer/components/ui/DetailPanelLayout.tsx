import { type ReactNode } from "react"

export function DetailPanelLayout({
  header,
  children,
}: {
  /**
   * Pinned to the top of the panel while the body scrolls — resource name,
   * action buttons, search input.
   */
  header?: ReactNode
  children: ReactNode
}): JSX.Element {
  return (
    <div className="w-1/2 shrink-0 bg-card text-card-foreground border border-border shadow-md h-full overflow-auto">
      {header && (
        <div className="sticky top-0 z-10 space-y-3 border-b border-border bg-card px-4 py-3">
          {header}
        </div>
      )}
      <div className="p-4 space-y-4">{children}</div>
    </div>
  )
}
