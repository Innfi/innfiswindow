import { dump as yamlDump } from "js-yaml"
import { Pencil } from "lucide-react"

import { Button } from "../../components/ui/button"
import { DrawerTabInput, useAppStore } from "../../store/app.store"

type YamlEditKind = Extract<
  DrawerTabInput,
  { type: "yaml-edit" }
>["resourceKind"]

interface EditButtonProps {
  resourceKind: YamlEditKind
  resourceName: string
  namespace?: string
  buildYaml: () => Record<string, unknown>
  className?: string
}

export function EditButton({
  resourceKind,
  resourceName,
  namespace = "",
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
      resourceName,
      namespace: ns,
      initialYaml: yamlDump(buildYaml()),
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
