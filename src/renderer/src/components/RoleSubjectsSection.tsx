import { useCallback, useEffect, useState } from "react"

import { SubjectLink } from "../../components/ui/SubjectLink"
import { normalizeIpcError } from "../../lib/ipc-error"
import { useAppStore } from "../../store/app.store"
import { K8sRoleSubjectBinding } from "../types/k8s"

/**
 * Who holds a Role or ClusterRole: the bindings referencing it and the
 * subjects each one names. A ClusterRole is also counted where a RoleBinding
 * references it, which grants the same rules inside that one namespace.
 */
export function RoleSubjectsSection({
  kind,
  name,
  namespace,
  search = "",
}: {
  kind: "Role" | "ClusterRole"
  name: string
  /** The Role's namespace; ignored for a ClusterRole. */
  namespace?: string
  search?: string
}): JSX.Element {
  const selectedContext = useAppStore((s) => s.selectedContext)
  const [bindings, setBindings] = useState<K8sRoleSubjectBinding[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    window.api.k8s
      .getRoleSubjects({
        contextName: selectedContext ?? undefined,
        kind,
        name,
        namespace: namespace ?? "",
      })
      .then((result) => {
        setBindings(result)
        setLoading(false)
      })
      .catch((err) => {
        setError(normalizeIpcError(err))
        setBindings([])
        setLoading(false)
      })
  }, [selectedContext, kind, name, namespace])

  useEffect(() => {
    load()
  }, [load])

  const sl = search.toLowerCase()
  const visible = bindings.filter(
    (binding) =>
      !sl ||
      binding.bindingName.toLowerCase().includes(sl) ||
      binding.bindingNamespace.toLowerCase().includes(sl) ||
      binding.subjects.some((s) => s.name.toLowerCase().includes(sl)),
  )
  const subjectCount = visible.reduce((sum, b) => sum + b.subjects.length, 0)

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
          Bound to ({subjectCount})
        </h3>
        <button
          onClick={load}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Refresh
        </button>
      </div>

      {loading && <p className="text-xs text-muted-foreground">Loading…</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
      {!loading && !error && visible.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No binding references this {kind}.
        </p>
      )}

      {!loading &&
        !error &&
        visible.map((binding, i) => (
          <div
            key={`${binding.bindingKind}/${binding.bindingNamespace}/${binding.bindingName}/${i}`}
            className="rounded border p-2 text-xs space-y-1"
          >
            <div className="font-mono">
              {binding.bindingKind}{" "}
              {binding.bindingNamespace
                ? `${binding.bindingNamespace}/${binding.bindingName}`
                : binding.bindingName}
            </div>
            {binding.subjects.length === 0 ? (
              <p className="text-muted-foreground">No subjects</p>
            ) : (
              <div className="flex flex-wrap gap-1">
                {binding.subjects.map((subject, j) => (
                  <SubjectLink
                    key={`${subject.kind}/${subject.namespace}/${subject.name}/${j}`}
                    subject={subject}
                    className="rounded border px-1.5 py-0.5 no-underline hover:bg-accent"
                  >
                    {subject.kind}{" "}
                    {subject.namespace
                      ? `${subject.namespace}/${subject.name}`
                      : subject.name}
                  </SubjectLink>
                ))}
              </div>
            )}
          </div>
        ))}
    </div>
  )
}
