import { cn } from "../../lib/utils"
import { resourceTypeForKind } from "../../src/types/resource"
import { useAppStore } from "../../store/app.store"

/**
 * A click-through to another object: switches to that kind's view and selects
 * the named row once the list has loaded. A kind with no view of its own — a
 * custom resource, a kind this app doesn't list — renders as plain text rather
 * than a link that would go nowhere.
 */
export function ResourceLink({
  kind,
  name,
  namespace,
  className,
  children,
}: {
  kind: string
  name: string
  /** Omit or pass `""` for a cluster-scoped kind. */
  namespace?: string
  className?: string
  /** Defaults to the object's name; pass a cell's own content instead. */
  children?: React.ReactNode
}): JSX.Element {
  const navigateToResourceRef = useAppStore((s) => s.navigateToResourceRef)
  const type = resourceTypeForKind(kind)
  const label = children ?? name

  if (!type || !name) return <span className={className}>{label}</span>

  return (
    <button
      onClick={(e) => {
        // A link inside a table row must navigate instead of selecting the row
        // it sits in.
        e.stopPropagation()
        navigateToResourceRef(type, name, namespace ?? "")
      }}
      title={`Go to ${kind} ${namespace ? `${namespace}/${name}` : name}`}
      className={cn(
        "text-left underline decoration-dotted underline-offset-2 hover:text-foreground",
        className,
      )}
    >
      {label}
    </button>
  )
}
