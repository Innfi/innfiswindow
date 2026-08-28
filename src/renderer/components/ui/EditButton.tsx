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

  function handleEdit(): void {
    const ns = namespace ?? ""
    const tabKey = ns
      ? `yaml-edit:${resourceKind}:${ns}/${resourceName}`
      : `yaml-edit:${resourceKind}:${resourceName}`
    openDrawerTab({
      tabKey,
      type: "yaml-edit",
      resourceKind,
      ...(gvk ? { gvk } : {}),
      resourceName,
      namespace: ns,
      initialYaml: dumpYaml(buildYaml()),
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
