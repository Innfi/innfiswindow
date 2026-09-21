import { useEffect, useRef, useState } from "react"

import {
  fieldSelectorFields,
  parseFieldSelector,
} from "../../../shared/field-selector"
import { cn } from "../../lib/utils"
import { useAppStore } from "../../store/app.store"

const DEBOUNCE_MS = 300

/**
 * The `--field-selector` box, next to the label one and debounced the same
 * way. It differs in being per-kind: a field selector is answered out of the
 * API server's own index, so only the fields a kind declares selectable can be
 * asked about, and the box is not rendered at all for a view that indexes
 * nothing beyond its name. What a kind does index is in the tooltip, and
 * typing anything else is refused here rather than becoming a 400 per poll.
 */
export function FieldSelectorInput(): JSX.Element | null {
  const selectedResourceType = useAppStore((s) => s.selectedResourceType)
  const fieldSelector = useAppStore((s) => s.fieldSelector)
  const setFieldSelector = useAppStore((s) => s.setFieldSelector)
  const [value, setValue] = useState(fieldSelector)
  const [error, setError] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastPushedRef = useRef(fieldSelector)

  const fields = fieldSelectorFields(selectedResourceType)

  // The store value also changes without typing: switching to a kind that
  // indexes different fields clears it, as does a cross-reference jump.
  useEffect(() => {
    if (fieldSelector !== lastPushedRef.current) {
      lastPushedRef.current = fieldSelector
      setValue(fieldSelector)
      setError(null)
    }
  }, [fieldSelector])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  if (fields.length === 0) return null

  function handleChange(next: string): void {
    setValue(next)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      const { selector, error: problem } = parseFieldSelector(next, fields)
      setError(problem)
      if (problem) return
      lastPushedRef.current = selector
      setFieldSelector(selector)
    }, DEBOUNCE_MS)
  }

  return (
    <input
      type="text"
      value={value}
      onChange={(e) => handleChange(e.target.value)}
      placeholder="Field selector..."
      aria-label="Field selector"
      aria-invalid={error !== null}
      title={
        error ??
        `Filter by indexed fields, comma-separated: ${fields[fields.length - 1]}=value, key!=value — this kind indexes ${fields.join(", ")}`
      }
      className={cn(
        "rounded border px-2 py-0.5 text-xs mr-2 bg-background text-foreground w-48",
        error && "border-red-500 text-red-500",
      )}
    />
  )
}
