/**
 * Watch events arrive as raw JSON, where a timestamp is still a string, while
 * the typed list client deserializes the same field into a `Date`. Mappers fed
 * by both go through here instead of calling `.toISOString()` on a value that
 * may not be a `Date`.
 */
export function toIso(value: Date | string | null | undefined): string {
  if (!value) return ""
  if (value instanceof Date) return value.toISOString()
  const parsed = new Date(value)
  return isNaN(parsed.getTime()) ? "" : parsed.toISOString()
}
