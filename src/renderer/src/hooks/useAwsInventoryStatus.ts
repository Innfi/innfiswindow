import { useCallback, useEffect, useState } from "react"

import type { AwsInventoryStatus } from "../../../shared/aws"
import { handleIpcError } from "../../lib/ipc-error"

/**
 * The awsinv scan status: read once, then kept current by
 * `aws:inventory:changed`, which main sends on scan start and finish. Reading
 * it never spawns awsinv or starts a scan.
 *
 * With `contextName`, the status carries that context's `scope`. Events carry
 * the global status, so a scoped read is refreshed on each event instead.
 */
export function useAwsInventoryStatus(contextName?: string | null): {
  status: AwsInventoryStatus | null
  scan: () => void
  cancel: () => void
} {
  const [status, setStatus] = useState<AwsInventoryStatus | null>(null)

  const read = useCallback(() => {
    window.api.aws
      .inventoryStatus(contextName ? { contextName } : undefined)
      .then(setStatus)
      .catch((e) => handleIpcError(e, "AWS: inventory status"))
  }, [contextName])

  useEffect(() => {
    read()
    return window.api.aws.onInventoryChanged((next) => {
      if (contextName) read()
      else setStatus(next)
    })
  }, [contextName, read])

  const scan = useCallback(() => {
    window.api.aws
      .scan()
      .then(setStatus)
      .catch((e) => handleIpcError(e, "AWS: scan"))
  }, [])

  const cancel = useCallback(() => {
    window.api.aws
      .cancelScan()
      .then(setStatus)
      .catch((e) => handleIpcError(e, "AWS: cancel scan"))
  }, [])

  return { status, scan, cancel }
}
