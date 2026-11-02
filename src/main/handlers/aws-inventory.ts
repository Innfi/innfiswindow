import { spawn } from "child_process"

import {
  AwsAccount,
  AWSINV_CONTRACT_VERSION,
  AwsInventoryError,
  AwsInventoryErrorCode,
  AwsInventorySnapshot,
  AwsInventoryStatus,
  AwsResourceKind,
  AwsRow,
  AwsRowByKind,
  AwsRows,
  AwsScanError,
  AwsScope,
} from "../../shared/aws"

/** How long a cancelled scan gets to exit by itself before it is killed. */
const CANCEL_KILL_DELAY_MS = 10_000
const STDERR_TAIL_CHARS = 8_192

export class AwsinvError extends Error {
  constructor(
    readonly code: AwsInventoryErrorCode,
    message: string,
  ) {
    super(message)
    this.name = "AwsinvError"
  }
}

// ---------------------------------------------------------------------------
// Secret redaction
// ---------------------------------------------------------------------------

/** stderr can repeat a connection string, and it ends up on screen. */
export function redactSecrets(text: string, databaseUrl?: string): string {
  let out = text
  if (databaseUrl) out = out.split(databaseUrl).join("[redacted]")
  return out
    .replace(/\b[a-z][a-z0-9+.-]*:\/\/[^\s:/@]+:[^\s@]+@\S*/gi, "[redacted]")
    .replace(/\bpostgres(ql)?:\/\/\S+/gi, "[redacted]")
    .replace(/\b(password|passwd|pwd)\s*=\s*\S+/gi, "$1=[redacted]")
}

// ---------------------------------------------------------------------------
// Envelope
// ---------------------------------------------------------------------------

/** Anything Go can encode as `null`: a nil slice is not an empty array there. */
interface RawInventory {
  VPCs?: Omit<AwsRowByKind["vpcs"], "name" | "displayId">[] | null
  Subnets?: Omit<AwsRowByKind["subnets"], "name" | "displayId">[] | null
  RouteTables?: Omit<AwsRowByKind["routeTables"], "name" | "displayId">[] | null
  NATGateways?: Omit<AwsRowByKind["natGateways"], "name" | "displayId">[] | null
  InternetGateways?:
    | Omit<AwsRowByKind["internetGateways"], "name" | "displayId">[]
    | null
  EgressOnlyInternetGateways?:
    | Omit<AwsRowByKind["egressOnlyGateways"], "name" | "displayId">[]
    | null
  TransitGateways?:
    | Omit<AwsRowByKind["transitGateways"], "name" | "displayId">[]
    | null
  IAM?: Omit<AwsRowByKind["iamPrincipals"], "name" | "displayId">[] | null
}

export interface AwsinvEnvelope {
  contractVersion: number
  scannedAt: string
  incomplete: boolean
  accounts: AwsAccount[] | null
  errors: AwsScanError[] | null
  inventory: RawInventory | null
}

export function parseEnvelope(stdout: string): AwsinvEnvelope {
  let parsed: unknown
  try {
    parsed = JSON.parse(stdout)
  } catch {
    throw new AwsinvError("scan-failed", "awsinv returned invalid JSON")
  }
  if (typeof parsed !== "object" || parsed === null) {
    throw new AwsinvError("scan-failed", "awsinv returned an invalid result")
  }
  const version = (parsed as { contractVersion?: unknown }).contractVersion
  if (version !== AWSINV_CONTRACT_VERSION) {
    throw new AwsinvError(
      "scan-failed",
      `awsinv output version ${String(version)} is not supported (expected ${AWSINV_CONTRACT_VERSION}); update awsinv`,
    )
  }
  return parsed as AwsinvEnvelope
}

function rows<T extends { AccountID: string }>(
  items: T[] | null | undefined,
  idOf: (item: T) => string,
  normalize: (item: T) => T = (item) => item,
): AwsRow<T>[] {
  return (items ?? []).map((item) => {
    const id = idOf(item)
    return {
      ...normalize(item),
      name: `${id}@${item.AccountID}`,
      displayId: id,
    }
  })
}

export function mapInventory(raw: RawInventory | null | undefined): AwsRows {
  const inv = raw ?? {}
  return {
    vpcs: rows(inv.VPCs, (v) => v.VpcID),
    subnets: rows(inv.Subnets, (s) => s.SubnetID),
    routeTables: rows(
      inv.RouteTables,
      (r) => r.RouteTableID,
      (r) => ({
        ...r,
        Associations: r.Associations ?? [],
        Routes: r.Routes ?? [],
      }),
    ),
    natGateways: rows(
      inv.NATGateways,
      (n) => n.NATGatewayID,
      (n) => ({ ...n, Addresses: n.Addresses ?? [] }),
    ),
    internetGateways: rows(
      inv.InternetGateways,
      (g) => g.InternetGatewayID,
      (g) => ({ ...g, Attachments: g.Attachments ?? [] }),
    ),
    egressOnlyGateways: rows(
      inv.EgressOnlyInternetGateways,
      (g) => g.EgressOnlyInternetGatewayID,
      (g) => ({ ...g, Attachments: g.Attachments ?? [] }),
    ),
    transitGateways: rows(inv.TransitGateways, (t) => t.TransitGatewayID),
    // An ARN is already unique across accounts.
    iamPrincipals: (inv.IAM ?? []).map((p) => ({
      ...p,
      name: p.ARN,
      displayId: p.ID,
    })),
  }
}

export function toSnapshot(envelope: AwsinvEnvelope): AwsInventorySnapshot {
  return {
    scannedAt: envelope.scannedAt,
    // Field by field: role ARNs and external IDs must not reach the renderer,
    // whatever the sidecar sends.
    accounts: (envelope.accounts ?? []).map((a) => ({
      accountId: a.accountId,
      name: a.name,
      regions: a.regions ?? [],
    })),
    errors: envelope.errors ?? [],
    rows: mapInventory(envelope.inventory),
  }
}

export function selectAwsRows<K extends AwsResourceKind>(
  snapshot: AwsInventorySnapshot | null,
  kind: K,
  scope?: AwsScope,
): AwsRowByKind[K][] {
  if (!snapshot) return []
  const all = snapshot.rows[kind]
  if (!scope) return all
  return all.filter((row) => {
    if (row.AccountID !== scope.accountId) return false
    if (!scope.region || !("Region" in row)) return true
    return row.Region === scope.region
  })
}

// ---------------------------------------------------------------------------
// Sidecar process
// ---------------------------------------------------------------------------

export interface AwsinvCommand {
  command: string
  /** Placed before `--sidecar`. */
  args?: string[]
}

export interface AwsinvProcess {
  result: Promise<AwsinvEnvelope>
  /** Asks the scan to stop, and kills it if it has not exited after a delay. */
  cancel: () => void
  kill: () => void
}

export function spawnAwsinv(
  { command, args = [] }: AwsinvCommand,
  env: NodeJS.ProcessEnv,
  extraArgs: string[] = [],
  killDelayMs = CANCEL_KILL_DELAY_MS,
): AwsinvProcess {
  // `execFile` does not fit: scans outlast its timeouts and output limit.
  const child = spawn(command, [...args, "--sidecar", ...extraArgs], {
    env,
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
  })

  let killTimer: ReturnType<typeof setTimeout> | null = null
  const clearKillTimer = (): void => {
    if (killTimer) clearTimeout(killTimer)
    killTimer = null
  }

  const result = new Promise<AwsinvEnvelope>((resolve, reject) => {
    const stdout: Buffer[] = []
    let stderrTail = ""
    let spawnError: NodeJS.ErrnoException | undefined

    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk))
    child.stderr.on("data", (chunk: Buffer) => {
      stderrTail = (stderrTail + chunk.toString("utf8")).slice(
        -STDERR_TAIL_CHARS,
      )
    })
    // Closing stdin of a process that already exited raises EPIPE here, which
    // would otherwise be an uncaught exception in the main process.
    child.stdin.on("error", () => {})

    child.on("error", (err: NodeJS.ErrnoException) => {
      spawnError = err
      // A process that never started may not emit `close`.
      if (child.pid === undefined) settle()
    })
    child.on("close", (code) => settle(code))

    let settled = false
    function settle(code?: number | null): void {
      if (settled) return
      settled = true
      clearKillTimer()
      if (spawnError) {
        reject(
          spawnError.code === "ENOENT"
            ? new AwsinvError(
                "binary-missing",
                `awsinv binary not found: ${command}`,
              )
            : new AwsinvError("scan-failed", spawnError.message),
        )
        return
      }
      if (code !== 0) {
        const detail = stderrTail.trim()
        reject(
          new AwsinvError(
            "scan-failed",
            detail || `awsinv exited with code ${String(code)}`,
          ),
        )
        return
      }
      try {
        resolve(parseEnvelope(Buffer.concat(stdout).toString("utf8")))
      } catch (err) {
        reject(err)
      }
    }
  })

  return {
    result,
    cancel: () => {
      // Not a signal: on Windows `kill()` ends the process with no handler run.
      child.stdin.end()
      if (killTimer) return
      killTimer = setTimeout(() => child.kill(), killDelayMs)
    },
    kill: () => {
      clearKillTimer()
      child.kill()
    },
  }
}

// ---------------------------------------------------------------------------
// Scan state
// ---------------------------------------------------------------------------

export interface AwsInventoryDeps {
  getCommand: () => AwsinvCommand
  binaryExists: () => boolean
  /** The configured database URL, stored or inherited. */
  getDatabaseUrl: () => string | undefined
  /** Called when a scan starts or finishes. */
  onChange: () => void
  killDelayMs?: number
}

/**
 * Holds the last complete scan. List reads only ever touch this, since
 * `useK8sResource` polls them on every refresh tick. Saving it across restarts
 * is deferred, so each launch starts with no snapshot.
 */
export class AwsInventory {
  private snapshot: AwsInventorySnapshot | null = null
  private running: AwsinvProcess | null = null
  private startedAt: string | null = null
  private cancelled = false
  private lastError: AwsInventoryError | null = null

  constructor(private readonly deps: AwsInventoryDeps) {}

  /**
   * Starts a scan and returns without waiting for it. One at a time: each
   * `Collect` builds its own limiter, so parallel scans break the throttle caps.
   */
  startScan(): void {
    if (this.running) throw new Error("An AWS scan is already running")

    const databaseUrl = this.deps.getDatabaseUrl()
    if (!databaseUrl) {
      this.fail(
        new AwsinvError("not-configured", "DATABASE_URL is not configured"),
      )
      return
    }

    let scan: AwsinvProcess
    try {
      scan = spawnAwsinv(
        this.deps.getCommand(),
        { ...process.env, DATABASE_URL: databaseUrl },
        [],
        this.deps.killDelayMs,
      )
    } catch (err) {
      this.fail(err)
      return
    }

    this.running = scan
    this.startedAt = new Date().toISOString()
    this.cancelled = false
    this.lastError = null
    this.deps.onChange()

    void scan.result
      .then((envelope) => this.finish(envelope))
      .catch((err: unknown) => this.finishFailed(err))
  }

  cancelScan(): void {
    if (!this.running) return
    this.cancelled = true
    this.running.cancel()
  }

  /** For app quit: there is no time left for a graceful stop. */
  stop(): void {
    this.cancelled = true
    this.running?.kill()
  }

  getStatus(): AwsInventoryStatus {
    return {
      running: this.running !== null,
      startedAt: this.startedAt,
      scannedAt: this.snapshot?.scannedAt ?? null,
      accounts: this.snapshot?.accounts ?? [],
      errors: this.snapshot?.errors ?? [],
      lastError: this.lastError,
      binaryFound: this.deps.binaryExists(),
      databaseConfigured: Boolean(this.deps.getDatabaseUrl()),
    }
  }

  list<K extends AwsResourceKind>(
    kind: K,
    scope?: AwsScope,
  ): AwsRowByKind[K][] {
    return selectAwsRows(this.snapshot, kind, scope)
  }

  private finish(envelope: AwsinvEnvelope): void {
    // Half a scan would read as deleted resources, so the previous one stays.
    if (!envelope.incomplete) {
      const snapshot = toSnapshot(envelope)
      const secret = this.deps.getDatabaseUrl()
      snapshot.errors = snapshot.errors.map((e) => ({
        ...e,
        message: redactSecrets(e.message, secret),
      }))
      this.snapshot = snapshot
    } else if (!this.cancelled) {
      this.lastError = {
        code: "scan-incomplete",
        message: "The scan timed out; the previous results were kept",
      }
    }
    this.settle()
  }

  private finishFailed(err: unknown): void {
    // A cancelled scan ending badly is what was asked for, not a failure.
    if (!this.cancelled) this.lastError = this.toError(err)
    this.settle()
  }

  private settle(): void {
    this.running = null
    this.startedAt = null
    this.deps.onChange()
  }

  private fail(err: unknown): void {
    this.lastError = this.toError(err)
    this.deps.onChange()
  }

  private toError(err: unknown): AwsInventoryError {
    const message = err instanceof Error ? err.message : String(err)
    return {
      code: err instanceof AwsinvError ? err.code : "scan-failed",
      message: redactSecrets(message, this.deps.getDatabaseUrl()),
    }
  }
}
