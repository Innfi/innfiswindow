import { useCallback, useEffect, useState } from "react"

import { formatSubject } from "../../../shared/access"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/Table"
import { normalizeIpcError } from "../../lib/ipc-error"
import { useAppStore } from "../../store/app.store"
import { AccessSubject, K8sSubjectPermissions } from "../types/k8s"

/** `*` is what the handler uses for a cluster-wide grant; spell it out. */
function scopeLabel(scope: string): string {
  return scope === "*" ? "all namespaces" : scope
}

function listOrDash(values: string[], wildcard = "*"): string {
  if (values.length === 0) return "—"
  return values.map((v) => (v === "" ? '""' : v)).join(", ") || wildcard
}

/**
 * The reverse lookup: every rule RBAC grants a subject, and the bindings they
 * arrive through. Used both in the access review view and in the detail panel
 * of a ServiceAccount.
 *
 * It reads the bindings itself rather than asking the API server, because
 * SelfSubjectRulesReview only answers for the caller. That means it shows what
 * RBAC grants — a webhook authorizer can allow more, which is what the can-i
 * check is for.
 */
export function SubjectPermissionsSection({
  subject,
  search = "",
}: {
  subject: AccessSubject
  search?: string
}): JSX.Element {
  const selectedContext = useAppStore((s) => s.selectedContext)
  const [data, setData] = useState<K8sSubjectPermissions | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Split out so a parent that builds the subject inline — a new object on
  // every render — doesn't re-fetch on each one.
  const { kind, name, namespace } = subject

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    window.api.k8s
      .getSubjectPermissions({
        contextName: selectedContext ?? undefined,
        subject: { kind, name, namespace },
      })
      .then((result) => {
        setData(result)
        setLoading(false)
      })
      .catch((err) => {
        setError(normalizeIpcError(err))
        setData(null)
        setLoading(false)
      })
  }, [selectedContext, kind, name, namespace])

  useEffect(() => {
    load()
  }, [load])

  const sl = search.toLowerCase()
  const matches = (values: string[]): boolean =>
    !sl || values.some((v) => v.toLowerCase().includes(sl))

  const rules = (data?.effectiveRules ?? []).filter(
    (rule) =>
      !sl ||
      matches(rule.resources) ||
      matches(rule.verbs) ||
      matches(rule.apiGroups) ||
      matches(rule.nonResourceURLs) ||
      matches([rule.scope]),
  )
  const bindings = (data?.bindings ?? []).filter(
    (binding) =>
      !sl ||
      matches([
        binding.bindingName,
        binding.roleName,
        binding.via,
        binding.scope,
      ]),
  )

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
          Permissions — {formatSubject(subject)}
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

      {!loading && !error && data && (
        <>
          {data.incomplete && (
            <p className="text-xs rounded border border-yellow-400 bg-yellow-50 p-2 dark:bg-yellow-950/20">
              A role behind one of the bindings could not be read, so the rules
              below are a floor, not the whole grant.
            </p>
          )}

          <div className="space-y-1">
            <h4 className="text-xs font-medium">
              Effective rules ({rules.length})
            </h4>
            {rules.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No RBAC rules reach this subject.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap">Scope</TableHead>
                      <TableHead className="whitespace-nowrap">
                        API groups
                      </TableHead>
                      <TableHead className="whitespace-nowrap">
                        Resources
                      </TableHead>
                      <TableHead className="whitespace-nowrap">Names</TableHead>
                      <TableHead className="whitespace-nowrap">Verbs</TableHead>
                      <TableHead className="whitespace-nowrap">From</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rules.map((rule, i) => (
                      <TableRow key={i}>
                        <TableCell className="whitespace-nowrap text-xs">
                          {scopeLabel(rule.scope)}
                        </TableCell>
                        <TableCell className="text-xs font-mono">
                          {rule.apiGroups.length === 0
                            ? "—"
                            : listOrDash(rule.apiGroups)}
                        </TableCell>
                        <TableCell className="text-xs">
                          {rule.nonResourceURLs.length > 0
                            ? rule.nonResourceURLs.join(", ")
                            : listOrDash(rule.resources)}
                        </TableCell>
                        <TableCell className="text-xs">
                          {listOrDash(rule.resourceNames)}
                        </TableCell>
                        <TableCell className="text-xs">
                          {rule.verbs.join(", ")}
                        </TableCell>
                        <TableCell
                          className="text-xs text-muted-foreground"
                          title={rule.sources.join("\n")}
                        >
                          {rule.sources.length === 1
                            ? rule.sources[0]
                            : `${rule.sources.length} bindings`}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          <div className="space-y-1">
            <h4 className="text-xs font-medium">
              Bindings ({bindings.length})
            </h4>
            {bindings.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No binding names this subject.
              </p>
            ) : (
              bindings.map((binding, i) => (
                <div
                  key={`${binding.bindingKind}/${binding.bindingNamespace}/${binding.bindingName}/${i}`}
                  className="rounded border p-2 text-xs space-y-0.5"
                >
                  <div className="font-mono">
                    {binding.bindingKind}{" "}
                    {binding.bindingNamespace
                      ? `${binding.bindingNamespace}/${binding.bindingName}`
                      : binding.bindingName}{" "}
                    → {binding.roleKind} {binding.roleName}
                  </div>
                  <div className="text-muted-foreground">
                    applies in {scopeLabel(binding.scope)} · via {binding.via} ·{" "}
                    {binding.rules.length} rule
                    {binding.rules.length === 1 ? "" : "s"}
                  </div>
                  {binding.error && (
                    <div className="text-destructive">{binding.error}</div>
                  )}
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}
