export function MetaEntry({
  label,
  value,
  mono,
}: {
  label: string
  value: string
  mono?: boolean
}): JSX.Element {
  return (
    <div className="flex gap-2 text-sm">
      <span className="shrink-0 font-medium text-muted-foreground w-32">{label}</span>
      <span className={`break-all${mono ? " font-mono text-xs" : ""}`}>{value}</span>
    </div>
  )
}
