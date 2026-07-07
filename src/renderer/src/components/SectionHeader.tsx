export function SectionHeader({ title }: { title: string }): JSX.Element {
  return (
    <h3 className="text-sm font-semibold text-muted-foreground">{title}</h3>
  )
}
