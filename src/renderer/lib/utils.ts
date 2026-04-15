import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

export function filterResources<
  T extends { name: string; namespace?: string | null },
>(resources: T[], nameFilter: string, namespace?: string | null): T[] {
  return resources
    .filter((r) => !namespace || r.namespace === namespace)
    .filter(
      (r) =>
        !nameFilter || r.name.toLowerCase().includes(nameFilter.toLowerCase()),
    )
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
