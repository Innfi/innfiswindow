import { Check, Copy, X } from "lucide-react"
import { useEffect, useState } from "react"

import {
  ACCESS_VERBS,
  canICommand,
  COMMON_RESOURCES,
  formatSubject,
  validateAccessRequest,
  validateSubject,
} from "../../../shared/access"
import { Button } from "../../components/ui/Button"
import { Input } from "../../components/ui/Input"
import { SectionHeader } from "../../components/ui/SectionHeader"
import { handleIpcError, normalizeIpcError } from "../../lib/ipc-error"
import { cn } from "../../lib/utils"
import { useAppStore } from "../../store/app.store"
import {
  AccessSubject,
  AccessSubjectKind,
  K8sAccessReviewResult,
  K8sSelfRules,
} from "../types/k8s"
import { SubjectPermissionsSection } from "./SubjectPermissionsSection"

const SUBJECT_KINDS: { value: AccessSubjectKind; label: string }[] = [
  { value: "current-user", label: "Current user (kubeconfig)" },
  { value: "ServiceAccount", label: "ServiceAccount" },
  { value: "User", label: "User" },
  { value: "Group", label: "Group" },
]

const EMPTY_SUBJECT: AccessSubject = {
  kind: "current-user",
  name: "",
  namespace: "",
}

/** The form fields, kept apart from the subject so switching tabs keeps both. */
interface QueryState {
  verb: string
  group: string
  resource: string
  subresource: string
  name: string
  namespace: string
  nonResourceURL: string
}

function labelClass(): string {
  return "text-xs font-medium text-muted-foreground"
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}): JSX.Element {
  return (
    <label className="flex flex-col gap-1">
      <span className={labelClass()}>{label}</span>
      {children}
      {hint && (
        <span className="text-[11px] text-muted-foreground">{hint}</span>
      )}
    </label>
  )
}

/** The subject the question is asked about — shared by both tabs. */
function SubjectFields({
  subject,
  onChange,
  allowCurrentUser,
}: {
  subject: AccessSubject
  onChange: (subject: AccessSubject) => void
  allowCurrentUser: boolean
}): JSX.Element {
  const kinds = allowCurrentUser
    ? SUBJECT_KINDS
    : SUBJECT_KINDS.filter((k) => k.value !== "current-user")
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <Field label="Subject">
        <select
          value={subject.kind}
          onChange={(e) =>
            onChange({
              ...subject,
              kind: e.target.value as AccessSubjectKind,
            })
          }
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
        >
          {kinds.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>
      </Field>
      {subject.kind !== "current-user" && (
        <Field label="Name">
          <Input
            value={subject.name}
            onChange={(e) => onChange({ ...subject, name: e.target.value })}
            placeholder={
              subject.kind === "ServiceAccount"
                ? "default"
                : "alice@example.com"
            }
          />
        </Field>
      )}
      {subject.kind === "ServiceAccount" && (
        <Field label="Subject namespace">
          <Input
            value={subject.namespace}
            onChange={(e) =>
              onChange({ ...subject, namespace: e.target.value })
            }
            placeholder="default"
          />
        </Field>
      )}
    </div>
  )
}

function CanITab({
  subject,
  onSubjectChange,
}: {
  subject: AccessSubject
  onSubjectChange: (subject: AccessSubject) => void
}): JSX.Element {
  const selectedContext = useAppStore((s) => s.selectedContext)
  const selectedNamespace = useAppStore((s) => s.selectedNamespace)

  const [query, setQuery] = useState<QueryState>({
    verb: "get",
    group: "",
    resource: "pods",
    subresource: "",
    name: "",
    namespace: selectedNamespace ?? "",
    nonResourceURL: "",
  })
  const [result, setResult] = useState<K8sAccessReviewResult | null>(null)
  const [running, setRunning] = useState(false)
  const [copied, setCopied] = useState(false)

  const request = { subject, ...query }
  const problem = validateAccessRequest(request)
  const command = canICommand(request)

  function set<K extends keyof QueryState>(key: K, value: QueryState[K]): void {
    setQuery((prev) => ({ ...prev, [key]: value }))
    setResult(null)
  }

  async function run(): Promise<void> {
    setRunning(true)
    try {
      const answer = await window.api.k8s.checkAccess({
        contextName: selectedContext ?? undefined,
        request,
      })
      setResult(answer)
    } catch (err) {
      setResult(null)
      handleIpcError(err, "Access review")
    } finally {
      setRunning(false)
    }
  }

  const nonResource = query.nonResourceURL.trim() !== ""

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded border p-3">
        <SectionHeader title="Who" />
        <SubjectFields
          subject={subject}
          onChange={(next) => {
            onSubjectChange(next)
            setResult(null)
          }}
          allowCurrentUser
        />
        {subject.kind !== "current-user" && (
          <p className="text-[11px] text-muted-foreground">
            Asking about anyone but yourself is a SubjectAccessReview, which
            needs <code>create</code> on <code>subjectaccessreviews</code>.
          </p>
        )}
      </div>

      <div className="space-y-3 rounded border p-3">
        <SectionHeader title="What" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Verb">
            <Input
              list="access-verbs"
              value={query.verb}
              onChange={(e) => set("verb", e.target.value)}
              placeholder="get"
            />
            <datalist id="access-verbs">
              {ACCESS_VERBS.map((verb) => (
                <option key={verb} value={verb} />
              ))}
            </datalist>
          </Field>
          <Field
            label="Resource"
            hint="Plural, as RBAC names it — pods, deployments, a CRD's plural."
          >
            <Input
              list="access-resources"
              value={query.resource}
              onChange={(e) => set("resource", e.target.value)}
              disabled={nonResource}
              placeholder="pods"
            />
            <datalist id="access-resources">
              {COMMON_RESOURCES.map((resource) => (
                <option key={resource} value={resource} />
              ))}
            </datalist>
          </Field>
          <Field label="API group" hint="Empty is the core group.">
            <Input
              value={query.group}
              onChange={(e) => set("group", e.target.value)}
              disabled={nonResource}
              placeholder="apps"
            />
          </Field>
          <Field label="Subresource">
            <Input
              value={query.subresource}
              onChange={(e) => set("subresource", e.target.value)}
              disabled={nonResource}
              placeholder="log"
            />
          </Field>
          <Field label="Object name" hint="Leave empty to ask about the kind.">
            <Input
              value={query.name}
              onChange={(e) => set("name", e.target.value)}
              disabled={nonResource}
              placeholder="nginx"
            />
          </Field>
          <Field label="Namespace" hint="Empty asks across all namespaces.">
            <Input
              value={query.namespace}
              onChange={(e) => set("namespace", e.target.value)}
              placeholder="all namespaces"
            />
          </Field>
        </div>
        <Field
          label="Non-resource URL"
          hint="Set this to ask about a path like /healthz instead of a resource."
        >
          <Input
            value={query.nonResourceURL}
            onChange={(e) => set("nonResourceURL", e.target.value)}
            placeholder="/healthz"
          />
        </Field>
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={run} disabled={running || problem !== null}>
          {running ? "Checking…" : "Check access"}
        </Button>
        {problem && <span className="text-xs text-destructive">{problem}</span>}
      </div>

      <div className="flex items-center gap-2 rounded border bg-muted/40 p-2">
        <code className="flex-1 overflow-x-auto whitespace-nowrap text-xs">
          {command}
        </code>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            navigator.clipboard.writeText(command).then(
              () => {
                setCopied(true)
                setTimeout(() => setCopied(false), 1500)
              },
              () => setCopied(false),
            )
          }}
        >
          <Copy className="h-3.5 w-3.5" />
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>

      {result && (
        <div
          className={cn(
            "space-y-1 rounded border p-3",
            result.allowed
              ? "border-green-500 bg-green-50 dark:bg-green-950/20"
              : "border-red-500 bg-red-50 dark:bg-red-950/20",
          )}
        >
          <div className="flex items-center gap-2 text-sm font-semibold">
            {result.allowed ? (
              <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
            ) : (
              <X className="h-4 w-4 text-red-600 dark:text-red-400" />
            )}
            {result.allowed ? "yes" : result.denied ? "no (denied)" : "no"}
          </div>
          <p className="text-xs text-muted-foreground">
            {result.reviewKind} · checked as {result.checkedAs}
          </p>
          {result.reason && <p className="text-xs">{result.reason}</p>}
          {!result.reason && !result.allowed && (
            <p className="text-xs text-muted-foreground">
              No authorizer allowed it. RBAC gives no reason for a plain no.
            </p>
          )}
          {result.evaluationError && (
            <p className="text-xs text-destructive">
              Evaluation error: {result.evaluationError}
            </p>
          )}
        </div>
      )}

      <SelfRulesSection />
    </div>
  )
}

/** What the API server says the kubeconfig user may do in one namespace. Only
 *  answerable for the caller — there is no rules review for another subject. */
function SelfRulesSection(): JSX.Element {
  const selectedContext = useAppStore((s) => s.selectedContext)
  const selectedNamespace = useAppStore((s) => s.selectedNamespace)
  const [namespace, setNamespace] = useState(selectedNamespace ?? "default")
  const [rules, setRules] = useState<K8sSelfRules | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load(): Promise<void> {
    setLoading(true)
    setError(null)
    try {
      setRules(
        await window.api.k8s.listSelfRules({
          contextName: selectedContext ?? undefined,
          namespace: namespace.trim() || "default",
        }),
      )
    } catch (err) {
      setRules(null)
      setError(normalizeIpcError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2 rounded border p-3">
      <SectionHeader title="Your own rules" />
      <div className="flex items-end gap-3">
        <Field label="Namespace">
          <Input
            value={namespace}
            onChange={(e) => setNamespace(e.target.value)}
            placeholder="default"
          />
        </Field>
        <Button size="sm" variant="outline" onClick={load} disabled={loading}>
          {loading ? "Loading…" : rules ? "Refresh" : "Show rules"}
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {rules && (
        <div className="space-y-1">
          {rules.incomplete && (
            <p className="text-xs rounded border border-yellow-400 bg-yellow-50 p-2 dark:bg-yellow-950/20">
              The API server could not enumerate every rule, so this list is
              incomplete.
              {rules.evaluationError ? ` ${rules.evaluationError}` : ""}
            </p>
          )}
          {rules.resourceRules.length === 0 &&
            rules.nonResourceRules.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No rules in {rules.namespace}.
              </p>
            )}
          {rules.resourceRules.map((rule, i) => (
            <div key={`r${i}`} className="rounded border p-2 text-xs font-mono">
              {rule.verbs.join(", ")} on {rule.resources.join(", ") || "*"}
              {rule.apiGroups.length > 0 && rule.apiGroups[0] !== ""
                ? `.${rule.apiGroups.join(".")}`
                : ""}
              {rule.resourceNames.length > 0
                ? ` (${rule.resourceNames.join(", ")})`
                : ""}
            </div>
          ))}
          {rules.nonResourceRules.map((rule, i) => (
            <div key={`n${i}`} className="rounded border p-2 text-xs font-mono">
              {rule.verbs.join(", ")} on {rule.nonResourceURLs.join(", ")}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function SubjectTab({
  subject,
  onSubjectChange,
}: {
  subject: AccessSubject
  onSubjectChange: (subject: AccessSubject) => void
}): JSX.Element {
  // The lookup runs against a submitted subject, not the one being typed.
  const [draft, setDraft] = useState<AccessSubject>(
    subject.kind === "current-user"
      ? { kind: "ServiceAccount", name: "", namespace: "default" }
      : subject,
  )
  const [target, setTarget] = useState<AccessSubject | null>(
    subject.kind === "current-user" || subject.name === "" ? null : subject,
  )

  useEffect(() => {
    // A click on a subject elsewhere in the app lands here.
    if (subject.kind === "current-user" || subject.name === "") return
    setDraft(subject)
    setTarget(subject)
  }, [subject])

  const problem = validateSubject(draft)

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded border p-3">
        <SectionHeader title="Subject" />
        <SubjectFields
          subject={draft}
          onChange={setDraft}
          allowCurrentUser={false}
        />
        <div className="flex items-center gap-3">
          <Button
            onClick={() => {
              setTarget(draft)
              onSubjectChange(draft)
            }}
            disabled={problem !== null}
          >
            Look up
          </Button>
          {problem && (
            <span className="text-xs text-destructive">{problem}</span>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground">
          Walks every RoleBinding and ClusterRoleBinding, including the ones
          reaching {formatSubject(draft)} through a group it belongs to without
          being named — <code>system:authenticated</code> most of all.
        </p>
      </div>

      {target ? (
        <div className="rounded border p-3">
          <SubjectPermissionsSection subject={target} />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Name a subject to see what it can do.
        </p>
      )}
    </div>
  )
}

export function AccessReviewView(): JSX.Element {
  const accessReviewSubject = useAppStore((s) => s.accessReviewSubject)
  const [subject, setSubject] = useState<AccessSubject>(
    accessReviewSubject ?? EMPTY_SUBJECT,
  )
  const [tab, setTab] = useState<"can-i" | "subject">(
    accessReviewSubject ? "subject" : "can-i",
  )

  useEffect(() => {
    if (!accessReviewSubject) return
    setSubject(accessReviewSubject)
    setTab("subject")
  }, [accessReviewSubject])

  return (
    <div className="flex h-full flex-col overflow-hidden p-4">
      <div className="mb-4 flex shrink-0 items-center justify-between">
        <h1 className="text-lg font-semibold">Access Review</h1>
        <div className="flex gap-1 rounded-md border p-0.5">
          {(
            [
              ["can-i", "Can I?"],
              ["subject", "Subject permissions"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setTab(value)}
              className={cn(
                "rounded px-3 py-1 text-xs",
                tab === value
                  ? "bg-accent font-medium"
                  : "text-muted-foreground hover:bg-accent/50",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto pr-1">
        {tab === "can-i" ? (
          <CanITab subject={subject} onSubjectChange={setSubject} />
        ) : (
          <SubjectTab subject={subject} onSubjectChange={setSubject} />
        )}
      </div>
    </div>
  )
}
