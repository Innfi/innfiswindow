import { ChevronRight } from "lucide-react"
import { type ReactNode } from "react"

import { cn } from "../../lib/utils"
import { useAppStore } from "../../store/app.store"

/**
 * Whether the section with this id is folded away, and the toggle for it. The
 * state lives in the store rather than the panel so it survives re-selecting a
 * row, switching views and restarting the app: which sections someone cares
 * about is a preference, not something to re-set on every pod.
 *
 * Exported so a section that fetches on a timer can stop while it is folded.
 */
export function useSectionCollapsed(id: string): [boolean, () => void] {
  const collapsed = useAppStore((s) => s.collapsedSections[id] ?? false)
  const toggle = useAppStore((s) => s.toggleSectionCollapsed)
  return [collapsed, () => toggle(id)]
}

/**
 * A detail-panel section whose body folds away, so a long panel can be cut
 * down to whatever is being looked at right now. Open until someone says
 * otherwise, and the body is not rendered while folded — a section that polls
 * therefore stops polling, since it is unmounted.
 */
export function CollapsibleSection({
  id,
  title,
  count,
  right,
  subtle,
  className,
  children,
}: {
  /** Stable across renders and panels, e.g. `pod.containers`; it is the key
   *  the folded state is remembered under. */
  id: string
  title: string
  /** Shown beside the title — how much is in there while it is folded. */
  count?: number
  /** Section-level controls (a Refresh button), kept out of the fold toggle. */
  right?: ReactNode
  /** The smaller uppercase heading the events/related/metrics sections use,
   *  rather than the panel's own section heading. */
  subtle?: boolean
  /** Wrapper classes, for a section that was a card (`rounded border p-3`)
   *  before it folded. */
  className?: string
  children: ReactNode
}): JSX.Element {
  const [collapsed, toggle] = useSectionCollapsed(id)

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center justify-between gap-2">
        <h3
          className={cn(
            "min-w-0",
            subtle
              ? "text-xs font-semibold uppercase text-muted-foreground tracking-wide"
              : "text-sm font-semibold text-muted-foreground",
          )}
        >
          <button
            type="button"
            onClick={toggle}
            aria-expanded={!collapsed}
            title={collapsed ? `Show ${title}` : `Hide ${title}`}
            className="flex items-center gap-1 text-left hover:text-foreground"
          >
            <ChevronRight
              className={cn(
                "h-3.5 w-3.5 shrink-0 transition-transform",
                !collapsed && "rotate-90",
              )}
            />
            <span className="truncate">{title}</span>
            {count !== undefined && (
              <span className="font-normal opacity-70">({count})</span>
            )}
          </button>
        </h3>
        {right}
      </div>
      {!collapsed && children}
    </div>
  )
}
