import { useEffect, useRef, useState } from "react"

import { parseLabelSelector } from "../../../shared/label-selector"
import { cn } from "../../lib/utils"
import { useAppStore } from "../../store/app.store"

const DEBOUNCE_MS = 300

/**
 * The `-l` box. Like `NameFilterInput` it debounces, but what it pushes is the
 * canonical selector `parseLabelSelector` produces, and only when the input
 * parses: every list re-fetches from the API server when this changes, and a
 * half-typed `app in (` would just be a 400 per poll. An input that does not
 * parse leaves the last valid selector in place and says what is wrong.
 */
export function LabelSelectorInput(): JSX.Element {
  const labelSelector = useAppStore((s) => s.labelSelector)
  const setLabelSelector = useAppStore((s) => s.setLabelSelector)
  const [value, setValue] = useState(labelSelector)
  const [error, setError] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastPushedRef = useRef(labelSelector)

  // The store value also changes without typing (a context switch restores it,
  // a cross-reference jump clears it). Adopt it only when it diverges from what
  // this input last pushed.
  useEffect(() => {
    if (labelSelector !== lastPushedRef.current) {
      lastPushedRef.current = labelSelector
      setValue(labelSelector)
      setError(null)
    }
  }, [labelSelector])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  function handleChange(next: string): void {
    setValue(next)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      const { selector, error: problem } = parseLabelSelector(next)
      setError(problem)
      if (problem) return
      lastPushedRef.current = selector
      setLabelSelector(selector)
    }, DEBOUNCE_MS)
  }

  return (
    <input
      type="text"
      value={value}
      onChange={(e) => handleChange(e.target.value)}
      placeholder="Label selector..."
      aria-label="Label selector"
      aria-invalid={error !== null}
      title={
        error ??
        "Filter by labels: app=nginx, tier in (web,cache), !canary — comma-separated"
      }
      className={cn(
        "rounded border px-2 py-0.5 text-xs mr-2 bg-background text-foreground w-48",
        error && "border-red-500 text-red-500",
      )}
    />
  )
}
