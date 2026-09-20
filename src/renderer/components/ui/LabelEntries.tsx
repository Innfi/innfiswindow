import {
  hasLabelEquality,
  toggleLabelEquality,
} from "../../../shared/label-selector"
import { cn } from "../../lib/utils"
import { useAppStore } from "../../store/app.store"
import { MetaEntry } from "./MetaEntry"

/**
 * A detail panel's `metadata.labels`, each one a click that adds `key=value`
 * to the app bar's label selector — the same filter typed by hand, so the list
 * behind the panel narrows to everything carrying that label. A label already
 * in the selector is marked, and clicking it again takes it back out.
 *
 * Only an object's own labels belong here: the selector filters the list being
 * viewed, so a pod template's labels or a workload's selector would filter the
 * wrong kind.
 */
export function LabelEntries({
  entries,
}: {
  /** `[key, value]` pairs, already filtered by the panel's search. */
  entries: [string, string][]
}): JSX.Element {
  const labelSelector = useAppStore((s) => s.labelSelector)
  const setLabelSelector = useAppStore((s) => s.setLabelSelector)

  return (
    <>
      {entries.map(([k, v]) => {
        const active = hasLabelEquality(labelSelector, k, v)
        return (
          <MetaEntry
            key={k}
            label={k}
            value={
              <button
                type="button"
                onClick={() =>
                  setLabelSelector(toggleLabelEquality(labelSelector, k, v))
                }
                title={
                  active
                    ? `Remove ${k}=${v} from the label filter`
                    : `Filter this list by ${k}=${v}`
                }
                className={cn(
                  "-mx-1 rounded px-1 text-left underline decoration-dotted underline-offset-2 hover:bg-muted",
                  active && "bg-primary/15 text-primary no-underline",
                )}
              >
                {v}
              </button>
            }
          />
        )
      })}
    </>
  )
}
