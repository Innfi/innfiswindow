// The YAML editor's save carries the resourceVersion it loaded, so a write
// someone else made in between is refused with a 409 instead of silently
// overwritten. Errors cross IPC as bare messages, so this prefix is how the
// renderer tells that refusal apart from any other failed save.
const EDIT_CONFLICT_PREFIX = "EditConflict:"

export function editConflictMessage(
  kind: string,
  name: string,
  resourceVersion: string,
): string {
  return `${EDIT_CONFLICT_PREFIX} ${kind}/${name} was modified after resourceVersion ${resourceVersion}`
}

export function isEditConflictMessage(message: string): boolean {
  return message.includes(EDIT_CONFLICT_PREFIX)
}
