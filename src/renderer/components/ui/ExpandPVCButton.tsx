import { HardDriveUpload } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { parseStorageQuantity } from "../../../shared/quantity"
import { useRecordHistory } from "../../src/hooks/useRecordHistory"
import { useAppStore } from "../../store/app.store"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./AlertDialog"
import { Button } from "./Button"
import { Input } from "./Input"
import { Label } from "./Label"

interface ExpandPVCButtonProps {
  pvcName: string
  namespace: string
  /** spec.resources.requests.storage — seeds the input and is the floor. */
  requestedStorage: string
  /** status.capacity, shown when it still trails the request. */
  capacity: string
  storageClass: string
  /** allowVolumeExpansion of the StorageClass; null when it is unknown. */
  allowVolumeExpansion: boolean | null
  /** Reloads the list once the new request is patched in. */
  onExpanded: () => void
  /** Pauses list polling while the dialog is open. */
  onDialogChange: (open: boolean) => void
  className?: string
}

/**
 * Raises `spec.resources.requests.storage`, the same edit `kubectl patch pvc`
 * makes. Kubernetes only grows a claim, so the current request is the floor;
 * the button is disabled outright when the StorageClass says expansion is not
 * allowed, since the API server would reject the patch.
 */
export function ExpandPVCButton({
  pvcName,
  namespace,
  requestedStorage,
  capacity,
  storageClass,
  allowVolumeExpansion,
  onExpanded,
  onDialogChange,
  className,
}: ExpandPVCButtonProps): JSX.Element {
  const selectedContext = useAppStore((s) => s.selectedContext)
  const recordHistory = useRecordHistory()
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(requestedStorage)
  const [expanding, setExpanding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const currentBytes = parseStorageQuantity(requestedStorage)
  const targetBytes = parseStorageQuantity(value)
  const wellFormed = targetBytes !== null && targetBytes > 0
  // A claim whose current request cannot be parsed is left to the API server
  // to judge rather than blocked here.
  const grows =
    !wellFormed || currentBytes === null || targetBytes > currentBytes
  const valid = wellFormed && grows
  const expansionBlocked = allowVolumeExpansion === false

  function setOpenNotify(next: boolean): void {
    setOpen(next)
    onDialogChange(next)
    if (next) {
      // Reopening after a poll picked up the new size must not show a stale
      // target.
      setValue(requestedStorage)
      setError(null)
    }
  }

  async function handleExpand(): Promise<void> {
    if (!valid) return
    const target = {
      action: "expand",
      resourceKind: "PersistentVolumeClaim",
      resourceName: pvcName,
      namespace,
    } as const
    setExpanding(true)
    setError(null)
    try {
      await window.api.k8s.expandPVC({
        contextName: selectedContext ?? undefined,
        namespace,
        name: pvcName,
        storage: value.trim(),
      })
      recordHistory(target, { success: true })
      toast.success(`Expanded ${pvcName} to ${value.trim()}`)
      setOpenNotify(false)
      onExpanded()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      recordHistory(target, { success: false, error: msg })
      toast.error(msg)
      useAppStore
        .getState()
        .addGlobalError(msg, "PersistentVolumeClaim: expand")
      setError(msg)
    } finally {
      setExpanding(false)
    }
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className={`h-7 text-xs gap-1${className ? ` ${className}` : ""}`}
        onClick={() => setOpenNotify(true)}
        disabled={expansionBlocked}
        title={
          expansionBlocked
            ? `StorageClass ${storageClass} does not allow volume expansion`
            : "Expand"
        }
      >
        <HardDriveUpload className="h-3 w-3" />
        Expand
      </Button>
      <AlertDialog open={open} onOpenChange={setOpenNotify}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Expand PersistentVolumeClaim</AlertDialogTitle>
            <AlertDialogDescription>
              Set the requested size for{" "}
              <strong>
                {namespace}/{pvcName}
              </strong>
              , currently <strong>{requestedStorage || "unset"}</strong>
              {capacity && capacity !== requestedStorage
                ? ` (${capacity} provisioned)`
                : ""}
              .
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1">
            <Label htmlFor="pvc-storage" className="text-xs">
              Storage
            </Label>
            <Input
              id="pvc-storage"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && valid && !expanding) handleExpand()
              }}
              disabled={expanding}
              placeholder="20Gi"
              className="h-8"
              autoFocus
            />
            {!wellFormed && value.trim() !== "" && (
              <p className="text-xs text-red-500">
                Use a quantity like 20Gi, 500Mi, or 1T.
              </p>
            )}
            {wellFormed && !grows && (
              <p className="text-xs text-red-500">
                Must be larger than {requestedStorage} — Kubernetes cannot
                shrink a claim.
              </p>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {allowVolumeExpansion === null
              ? `Whether StorageClass ${storageClass || "(none)"} allows expansion could not be read; the API server may still refuse.`
              : "The resize runs in the background: the claim reports Resizing, and status capacity catches up when the volume and its filesystem are done. Some drivers only finish the filesystem grow once the mounted pods restart."}
          </p>
          {error && (
            <p className="text-sm text-red-500 font-mono whitespace-pre-wrap">
              {error}
            </p>
          )}
          <AlertDialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpenNotify(false)}
              disabled={expanding}
            >
              Cancel
            </Button>
            <Button onClick={handleExpand} disabled={expanding || !valid}>
              {expanding ? "Expanding…" : "Expand"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
