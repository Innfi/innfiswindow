import { type ReactNode } from "react"

export function MetaEntry({
  label,
  value,
  mono,
}: {
  label: string
  /** A node rather than a string so an entry can be a link — see
   *  `ResourceLink` — without every caller changing. */
  value: ReactNode
  mono?: boolean
}): JSX.Element {
  return (
    <div className="grid grid-cols-[minmax(8rem,40%)_1fr] gap-x-2 text-sm items-baseline">
      <span className="font-medium text-muted-foreground break-all">
        {label}
      </span>
      <span className={`break-all${mono ? " font-mono text-xs" : ""}`}>
        {value}
      </span>
    </div>
  )
}
