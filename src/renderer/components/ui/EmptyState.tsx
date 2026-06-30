export function EmptyState({ message }: { message: string }): JSX.Element {
  return (
    <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
      {message}
    </div>
  )
}
