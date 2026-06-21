export function MetaEntry({
  label,
  value,
}: {
  label: string
  value: string
}): JSX.Element {
  return (
    <div className="flex gap-2 text-sm">
      <span className="shrink-0 font-medium text-muted-foreground w-32">
        {label}
      </span>
      <span className="break-all">{value}</span>
    </div>
  )
}
