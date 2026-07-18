import { useEffect, useRef, useState } from "react"

import { useAppStore } from "../../store/app.store"

const DEBOUNCE_MS = 200

/**
 * Name filter box. Keeps the typed value local and pushes it to the store on a
 * debounce — every store write re-renders the active resource list and all of
 * its rows, so a keystroke-per-write makes typing janky on large clusters.
 */
export function NameFilterInput(): JSX.Element {
  const nameFilter = useAppStore((s) => s.nameFilter)
  const setNameFilter = useAppStore((s) => s.setNameFilter)
  const [value, setValue] = useState(nameFilter)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastPushedRef = useRef(nameFilter)

  // The store value also changes without typing (switching context clears it).
  // Adopt it only when it diverges from what this input last pushed.
  useEffect(() => {
    if (nameFilter !== lastPushedRef.current) {
      lastPushedRef.current = nameFilter
      setValue(nameFilter)
    }
  }, [nameFilter])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  function handleChange(next: string): void {
    setValue(next)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      lastPushedRef.current = next
      setNameFilter(next)
    }, DEBOUNCE_MS)
  }

  return (
    <input
      type="text"
      value={value}
      onChange={(e) => handleChange(e.target.value)}
      placeholder="Filter by name..."
      className="rounded border px-2 py-0.5 text-xs mr-2 bg-background text-foreground w-40"
    />
  )
}
