import type { ReactNode } from "react"

import { cn } from "../../lib/utils"

/**
 * Resource name heading for detail panels. The name renders in monospace so
 * it stands out from surrounding prose; `children` (badges etc.) follow it in
 * the regular font.
 */
export function ResourceTitle({
  name,
  className,
  children,
}: {
  name: ReactNode
  className?: string
  children?: ReactNode
}): JSX.Element {
  return (
    <h2 className={cn("mb-1 break-all text-base font-semibold", className)}>
      <span className="font-mono">{name}</span>
      {children}
    </h2>
  )
}
