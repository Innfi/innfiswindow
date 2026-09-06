import type { AccessSubjectKind, RbacSubject } from "../../../shared/k8s"
import { cn } from "../../lib/utils"
import { useAppStore } from "../../store/app.store"

/** Kinds the access review has a form for. A binding may name another kind
 *  (a ServiceAccount group, say), which then renders as plain text. */
const INSPECTABLE: string[] = ["User", "Group", "ServiceAccount"]

/**
 * A binding subject that opens the access review pointed at it — the "what can
 * this actually do" jump from wherever the subject is listed.
 */
export function SubjectLink({
  subject,
  className,
  children,
}: {
  subject: RbacSubject
  className?: string
  /** Defaults to the subject's name; pass a cell's own content instead. */
  children?: React.ReactNode
}): JSX.Element {
  const inspectSubject = useAppStore((s) => s.inspectSubject)
  const label = children ?? subject.name

  if (!INSPECTABLE.includes(subject.kind)) {
    return <span className={className}>{label}</span>
  }

  return (
    <button
      onClick={() =>
        inspectSubject({
          kind: subject.kind as AccessSubjectKind,
          name: subject.name,
          namespace: subject.namespace ?? "",
        })
      }
      title="Show everything this subject can do"
      className={cn(
        "text-left underline decoration-dotted underline-offset-2 hover:text-foreground",
        className,
      )}
    >
      {label}
    </button>
  )
}
