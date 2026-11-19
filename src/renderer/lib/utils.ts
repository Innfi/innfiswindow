import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

export function filterResources<
  T extends { name: string; namespace?: string | null },
>(resources: T[], nameFilter: string, namespace?: string | null): T[] {
  if (!namespace && !nameFilter) return resources
  const needle = nameFilter.toLowerCase()
  return resources.filter(
    (r) =>
      (!namespace || r.namespace === namespace) &&
      (!needle || r.name.toLowerCase().includes(needle)),
  )
}

const MEM_SUFFIXES: [string, number][] = [
  ["Ki", 1024],
  ["Mi", 1024 ** 2],
  ["Gi", 1024 ** 3],
  ["Ti", 1024 ** 4],
  ["K", 1000],
  ["M", 1000 ** 2],
  ["G", 1000 ** 3],
  ["T", 1000 ** 4],
]

export function parseResourceValue(value: string): number {
  if (!value) return 0
  if (value.endsWith("m")) return parseFloat(value)
  for (const [suffix, mult] of MEM_SUFFIXES) {
    if (value.endsWith(suffix)) return parseFloat(value) * mult
  }
  return parseFloat(value) || 0
}

/** A byte count in binary units, for transfer sizes (a copy, a saved log). */
export function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GiB`
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MiB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KiB`
  return `${bytes} B`
}

export function formatAge(isoTimestamp: string): string {
  if (!isoTimestamp) return "-"
  const diffMs = Date.now() - new Date(isoTimestamp).getTime()
  const diffSecs = Math.floor(diffMs / 1000)
  if (diffSecs < 60) return `${diffSecs}s`
  const diffMins = Math.floor(diffSecs / 60)
  if (diffMins < 60) return `${diffMins}m`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d`
}

/** kubectl's copy of the whole object, which detail panels never show. */
const LAST_APPLIED = "kubectl.kubernetes.io/last-applied-configuration"

/** Detail-panel search: `needle` is already lower-cased; "" matches all. */
export function matchesSearch(text: string, needle: string): boolean {
  return !needle || text.toLowerCase().includes(needle)
}

/** A label-style map's entries whose key or value matches the search. */
export function filterEntries(
  record: Record<string, string> | null | undefined,
  needle: string,
): [string, string][] {
  const entries = Object.entries(record ?? {})
  if (!needle) return entries
  return entries.filter(
    ([k, v]) => matchesSearch(k, needle) || matchesSearch(v, needle),
  )
}

/** Like `filterEntries`, minus kubectl's last-applied-configuration. */
export function filterAnnotations(
  record: Record<string, string> | null | undefined,
  needle: string,
): [string, string][] {
  return filterEntries(record, needle).filter(
    ([k]) => !k.startsWith(LAST_APPLIED),
  )
}
