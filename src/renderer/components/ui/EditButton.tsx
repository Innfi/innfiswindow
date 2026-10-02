import { Pencil } from "lucide-react"

import type { ResourceGvk, ResourceKind } from "../../lib/resource-gvk"
import { dumpYaml } from "../../lib/yaml"
import { useAppStore } from "../../store/app.store"
import { Button } from "./Button"

interface EditButtonProps {
  resourceKind: ResourceKind
  resourceName: string
  namespace?: string
  /** Required for a custom resource: its group/version is only known from the
   *  CRD, so the editor cannot look the kind up. */
  gvk?: ResourceGvk
  buildYaml: () => Record<string, unknown>
  className?: string
}

export function EditButton({
  resourceKind,
  resourceName,
  namespace = "",
  gvk,
  buildYaml,
  className,
}: EditButtonProps): JSX.Element {
  const openDrawerTab = useAppStore((s) => s.openDrawerTab)
  const selectedContext = useAppStore((s) => s.selectedContext)

  function handleEdit(): void {
    const ns = namespace ?? ""
    // Keyed by context too: the same object in another cluster is a
    // different edit, not the tab already open.
    const scope = `${selectedContext ?? ""}:${resourceKind}`
    const tabKey = ns
      ? `yaml-edit:${scope}:${ns}/${resourceName}`
      : `yaml-edit:${scope}:${resourceName}`
    openDrawerTab({
      tabKey,
      type: "yaml-edit",
      resourceKind,
      ...(gvk ? { gvk } : {}),
      resourceName,
      namespace: ns,
      initialYaml: dumpYaml(buildYaml()),
      ...(selectedContext ? { contextName: selectedContext } : {}),
    })
  }

  return (
    <Button
      size="sm"
      variant="outline"
      className={`h-7 text-xs gap-1${className ? ` ${className}` : ""}`}
      onClick={handleEdit}
    >
      <Pencil className="h-3 w-3" />
      Edit
    </Button>
  )
}
