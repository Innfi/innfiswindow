import { Copy } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { Button } from "./button"
import { Popover, PopoverContent, PopoverTrigger } from "./popover"

interface CopyResourceButtonProps {
  name: string
  namespace?: string
  resourceKind: string
}

export function CopyResourceButton({
  name,
  namespace,
  resourceKind,
}: CopyResourceButtonProps): JSX.Element {
  const [open, setOpen] = useState(false)

  async function copy(text: string): Promise<void> {
    await navigator.clipboard.writeText(text)
    toast.success("Copied!")
    setOpen(false)
  }

  const namespacedName = namespace ? `${namespace}/${name}` : name
  const kubectlCmd = namespace
    ? `kubectl get ${resourceKind} ${name} -n ${namespace} -o yaml`
    : `kubectl get ${resourceKind} ${name} -o yaml`

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" title="Copy to clipboard">
          <Copy className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-1" align="end">
        <div className="flex flex-col">
          <button
            className="flex items-center px-3 py-2 text-sm rounded hover:bg-muted text-left w-full"
            onClick={() => copy(name)}
          >
            Copy name
          </button>
          <button
            className="flex items-center px-3 py-2 text-sm rounded hover:bg-muted text-left w-full"
            onClick={() => copy(namespacedName)}
          >
            Copy namespace/name
          </button>
          <button
            className="flex items-center px-3 py-2 text-sm rounded hover:bg-muted text-left w-full"
            onClick={() => copy(kubectlCmd)}
          >
            Copy kubectl command
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
