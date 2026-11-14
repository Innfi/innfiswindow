import { type ChildProcessWithoutNullStreams, spawn } from "child_process"

import {
  AwsAccount,
  AWSINV_FAILURE_RESOURCE,
  AWSINV_GLOBAL_REGION,
  AWSINV_RPC_CODE,
  AwsInventoryError,
  AwsInventoryErrorCode,
  AwsInventorySnapshot,
  AwsInventoryStatus,
  AwsResourceKind,
  AwsRow,
  AwsRowByKind,
  AwsRows,
  AwsScanFailure,
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

/** A JSON-RPC `error` object from awsinv. */
export class AwsinvRpcError extends Error {
  constructor(
    readonly code: number,
    message: string,
  ) {
    super(message)
    this.name = "AwsinvRpcError"
  }
}

// ---------------------------------------------------------------------------
// Secret redaction
// ---------------------------------------------------------------------------

/** stderr and `-32603` messages can repeat a connection string. */
export function redactSecrets(text: string, databaseUrl?: string): string {
  let out = text
  if (databaseUrl) out = out.split(databaseUrl).join("[redacted]")
  return out
    .replace(/\b[a-z][a-z0-9+.-]*:\/\/[^\s:/@]+:[^\s@]+@\S*/gi, "[redacted]")
    .replace(/\bpostgres(ql)?:\/\/\S+/gi, "[redacted]")
    .replace(/\b(password|passwd|pwd)\s*=\s*\S+/gi, "$1=[redacted]")
}

// ---------------------------------------------------------------------------
// JSON-RPC results (`api.ScanResult`, `api.AccountsResult`)
// ---------------------------------------------------------------------------

/** Anything Go can encode as `null`: a nil slice is not an empty array there. */
export interface RawInventory {
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

export interface AwsinvScanResult {
  incomplete: boolean
  inventory: RawInventory | null
  failures: AwsScanFailure[] | null
}

export interface AwsinvAccountsResult {
  accounts: AwsAccount[] | null
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isArrayOrNull(value: unknown): boolean {
  return value === null || value === undefined || Array.isArray(value)
}

export function parseScanResult(result: unknown): AwsinvScanResult {
  if (
    !isObject(result) ||
    typeof result.incomplete !== "boolean" ||
    !(result.inventory === null || isObject(result.inventory)) ||
    !isArrayOrNull(result.failures)
  ) {
    throw new AwsinvError(
      "awsinv-outdated",
      "awsinv returned an unexpected scan result; update awsinv",
    )
  }
  return result as unknown as AwsinvScanResult
}

/** Field by field: role ARNs and external IDs must never reach the renderer. */
export function parseAccountsResult(result: unknown): AwsAccount[] {
  if (!isObject(result) || !isArrayOrNull(result.accounts)) {
    throw new AwsinvError(
      "scan-failed",
      "awsinv returned an unexpected accounts result",
    )
  }
  return ((result.accounts as unknown[] | null) ?? [])
    .filter(isObject)
    .map((a) => ({
      accountId: String(a.accountId ?? ""),
      name: String(a.name ?? ""),
      regions: Array.isArray(a.regions) ? a.regions.map(String) : [],
    }))
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

function inTarget(
  row: { AccountID: string },
  failure: AwsScanFailure,
): boolean {
  if (row.AccountID !== failure.accountId) return false
  // IAM rows have no Region; their target is the account's global scan.
  if (!("Region" in row)) return failure.region === AWSINV_GLOBAL_REGION
  return row.Region === failure.region
}

/**
 * A failed target has no rows in the new scan, which would read as deleted
 * resources. Carries that target's rows over from `previous`, marked stale.
 * Accounts no longer in the scan report no failures, so their rows drop.
 */
export function carryOverFailedTargets(
  rows: AwsRows,
  failures: AwsScanFailure[],
  previous: AwsInventorySnapshot | null | undefined,
): AwsRows {
  if (!previous) return rows
  const out = { ...rows }
  for (const failure of failures) {
    const kind = AWSINV_FAILURE_RESOURCE[failure.resource]
    if (!kind) continue
    carryOverKind(out, kind, failure, previous)
  }
  return out
}

/** Generic over `K` so `rows[K]` stays one row type, not a union. */
function carryOverKind<K extends AwsResourceKind>(
  rows: AwsRows,
  kind: K,
  failure: AwsScanFailure,
  previous: AwsInventorySnapshot,
): void {
  const current: AwsRowByKind[K][] = rows[kind]
  const seen = new Set(current.map((r) => r.name))
  const kept = previous.rows[kind]
    .filter((r) => inTarget(r, failure) && !seen.has(r.name))
    .map((r) => ({ ...r, staleSince: r.staleSince ?? previous.scannedAt }))
  // TS cannot relate a write through the mapped `AwsRows[K]`; same type.
  if (kept.length) rows[kind] = [...current, ...kept] as AwsRows[K]
}

export function toSnapshot(
  scannedAt: string,
  accounts: AwsAccount[],
  result: AwsinvScanResult,
  databaseUrl?: string,
  previous?: AwsInventorySnapshot | null,
): AwsInventorySnapshot {
  const failures = (result.failures ?? []).map((f) => ({
    resource: f.resource,
    accountId: f.accountId,
    region: f.region,
    message: redactSecrets(f.message, databaseUrl),
  }))
  return {
    scannedAt,
    accounts,
    failures,
    rows: carryOverFailedTargets(
      mapInventory(result.inventory),
      failures,
      previous,
    ),
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
// JSON-RPC client over the sidecar's stdin/stdout
// ---------------------------------------------------------------------------

export interface AwsinvCommand {
  command: string
  /** Placed before `-stdio`. */
  args?: string[]
}

interface Pending {
  method: string
  resolve: (result: unknown) => void
  reject: (err: Error) => void
}

/**
 * One long-lived `awsinv -stdio` child. Requests and responses are one JSON
 * value per line; stderr is logs, kept only as a tail for error messages.
 * Closing stdin is the shutdown signal: on Windows `kill()` ends the process
 * without running any handler, so a signal cannot cancel a scan gracefully.
 */
export class AwsinvClient {
  private readonly child: ChildProcessWithoutNullStreams
  private readonly pending = new Map<number, Pending>()
  private nextId = 1
  private stdoutBuf = ""
  private stderrTail = ""
  private spawnError: NodeJS.ErrnoException | undefined
  private failure: Error | null = null
  private exitedFlag = false
  private killTimer: ReturnType<typeof setTimeout> | null = null
  /** Settles once the process is gone and every pending call has settled. */
  readonly exited: Promise<void>

  constructor(
    private readonly cmd: AwsinvCommand,
    env: NodeJS.ProcessEnv,
  ) {
    // `execFile` does not fit: scans outlast its timeout and output limit.
    this.child = spawn(cmd.command, [...(cmd.args ?? []), "-stdio"], {
      env,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    })

    let markExited: () => void = () => {}
    this.exited = new Promise((resolve) => (markExited = resolve))

    this.child.stdout.setEncoding("utf8")
    this.child.stdout.on("data", (chunk: string) => this.onStdout(chunk))
    this.child.stderr.setEncoding("utf8")
    this.child.stderr.on("data", (chunk: string) => {
      this.stderrTail = (this.stderrTail + chunk).slice(-STDERR_TAIL_CHARS)
    })
    // Writing to or closing the stdin of a process that already exited
    // raises EPIPE here, which would otherwise crash the main process.
    this.child.stdin.on("error", () => {})

    const onGone = (code?: number | null): void => {
      if (this.exitedFlag) return
      this.exitedFlag = true
      if (this.killTimer) clearTimeout(this.killTimer)
      this.failAll(this.failure ?? this.exitError(code))
      markExited()
    }
    this.child.on("error", (err: NodeJS.ErrnoException) => {
      this.spawnError = err
      // A process that never started may not emit `close`.
      if (this.child.pid === undefined) onGone()
    })
    this.child.on("close", (code) => onGone(code))
  }

  get alive(): boolean {
    return !this.exitedFlag && this.failure === null
  }

  call(method: string, params?: unknown): Promise<unknown> {
    if (!this.alive) {
      return Promise.reject(this.failure ?? this.exitError(null))
    }
    const id = this.nextId++
    const request =
      params === undefined
        ? { jsonrpc: "2.0", id, method }
        : { jsonrpc: "2.0", id, method, params }
    return new Promise((resolve, reject) => {
      this.pending.set(id, { method, resolve, reject })
      this.child.stdin.write(`${JSON.stringify(request)}\n`)
    })
  }

  /**
   * Graceful stop: awsinv cancels a running scan, replies to it and exits.
   * Kills it if it is still running after `killDelayMs`.
   */
  close(killDelayMs = CANCEL_KILL_DELAY_MS): void {
    this.child.stdin.end()
    if (this.exitedFlag || this.killTimer) return
    this.killTimer = setTimeout(() => this.child.kill(), killDelayMs)
  }

  kill(): void {
    this.child.kill()
  }

  private onStdout(chunk: string): void {
    let start = this.stdoutBuf.length
    this.stdoutBuf += chunk
    let nl: number
    // Search only the new part: a scan result can be one multi-megabyte line.
    while ((nl = this.stdoutBuf.indexOf("\n", start)) >= 0) {
      const line = this.stdoutBuf.slice(0, nl).trim()
      this.stdoutBuf = this.stdoutBuf.slice(nl + 1)
      start = 0
      if (line) this.onLine(line)
    }
  }

  private onLine(line: string): void {
    if (this.failure) return
    let msg: unknown
    try {
      msg = JSON.parse(line)
    } catch {
      this.protocolError("awsinv sent a line that is not JSON")
      return
    }
    if (!isObject(msg) || msg.jsonrpc !== "2.0") {
      this.protocolError("awsinv sent a message that is not JSON-RPC 2.0")
      return
    }
    const hasResult = "result" in msg
    const hasError = "error" in msg
    if (hasResult === hasError) {
      this.protocolError(
        "awsinv sent a response without exactly one of result and error",
      )
      return
    }
    // id null means awsinv could not read a request: one of ours is broken,
    // and there is no way to tell which.
    const pending =
      typeof msg.id === "number" ? this.pending.get(msg.id) : undefined
    if (!pending) {
      this.protocolError(
        `awsinv sent a response for unknown id ${JSON.stringify(msg.id)}`,
        hasError ? rpcErrorMessage(msg.error) : undefined,
      )
      return
    }
    this.pending.delete(msg.id as number)
    if (hasError) {
      const err = isObject(msg.error) ? msg.error : {}
      pending.reject(
        new AwsinvRpcError(
          typeof err.code === "number"
            ? err.code
            : AWSINV_RPC_CODE.internalError,
          rpcErrorMessage(msg.error),
        ),
      )
    } else {
      pending.resolve(msg.result)
    }
  }

  /** The stream can no longer be trusted: fail everything and stop the child. */
  private protocolError(message: string, detail?: string): void {
    console.error(
      `[awsinv] protocol error: ${message}${detail ? `: ${detail}` : ""}`,
    )
    this.failure = new AwsinvError("scan-failed", message)
    this.failAll(this.failure)
    this.child.kill()
  }

  private failAll(err: Error): void {
    const pending = [...this.pending.values()]
    this.pending.clear()
    for (const p of pending) p.reject(err)
  }

  private exitError(code: number | null | undefined): AwsinvError {
    if (this.spawnError) {
      return this.spawnError.code === "ENOENT"
        ? new AwsinvError(
            "binary-missing",
            `awsinv binary not found: ${this.cmd.command}`,
          )
        : new AwsinvError("scan-failed", this.spawnError.message)
    }
    const detail = this.stderrTail.trim()
    return new AwsinvError(
      "scan-failed",
      detail || `awsinv exited with code ${String(code)}`,
    )
  }
}

function rpcErrorMessage(error: unknown): string {
  if (isObject(error) && typeof error.message === "string") return error.message
  return "awsinv returned an error"
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

interface RunningScan {
  client: AwsinvClient
  cancelled: boolean
}

/**
 * Holds the last complete scan. List reads only ever touch this, since
 * `useK8sResource` polls them on every refresh tick: they never spawn the
 * sidecar or call it. Saving the snapshot across restarts is deferred, so
 * each launch starts with no snapshot.
 */
export class AwsInventory {
  private snapshot: AwsInventorySnapshot | null = null
  private client: AwsinvClient | null = null
  /** The URL `client` was started with; a change means a restart. */
  private clientDatabaseUrl: string | undefined
  private running: RunningScan | null = null
  private startedAt: string | null = null
  private lastError: AwsInventoryError | null = null

  constructor(private readonly deps: AwsInventoryDeps) {}

  /**
   * Starts a scan and returns without waiting for it. One at a time: each
   * `Collect` builds its own limiter, so parallel scans break the throttle caps.
   */
  startScan(): void {
    if (this.running) throw new Error("An AWS scan is already running")

    // Checked before spawning: a missing sidecar affects only AWS views, and
    // reports as its own state rather than as a failed scan.
    if (!this.binaryFound()) {
      this.fail(new AwsinvError("binary-missing", "awsinv binary not found"))
      return
    }

    const databaseUrl = this.deps.getDatabaseUrl()
    if (!databaseUrl) {
      this.fail(
        new AwsinvError("not-configured", "DATABASE_URL is not configured"),
      )
      return
    }

    let client: AwsinvClient
    try {
      client = this.getClient(databaseUrl)
    } catch (err) {
      this.fail(err)
      return
    }

    const scan: RunningScan = { client, cancelled: false }
    this.running = scan
    this.startedAt = new Date().toISOString()
    this.lastError = null
    this.deps.onChange()

    void this.runScan(scan)
      .catch((err: unknown) => {
        // A cancelled scan ending badly is what was asked for, not a failure.
        if (!scan.cancelled) this.lastError = this.toError(err)
      })
      .finally(() => {
        this.running = null
        this.startedAt = null
        this.deps.onChange()
      })
  }

  cancelScan(): void {
    if (!this.running || this.running.cancelled) return
    this.running.cancelled = true
    // Closing stdin cancels the scan and ends the child; the next scan
    // starts a fresh one.
    this.dropClient(this.running.client)
    this.running.client.close(this.deps.killDelayMs)
  }

  /** For app quit: there is no time left for a graceful stop. */
  stop(): void {
    if (this.running) this.running.cancelled = true
    this.client?.kill()
    this.running?.client.kill()
    this.client = null
  }

  /** Called when the stored URL changes, so an idle child does not keep the old one. */
  restartIdle(): void {
    if (this.running || !this.client) return
    const client = this.client
    this.client = null
    client.close(this.deps.killDelayMs)
  }

  /**
   * `scope` comes from the context named `contextName`; it is omitted when
   * that context's cluster is not an EKS ARN.
   */
  getStatus(context?: {
    contextName: string
    scope?: AwsScope
  }): AwsInventoryStatus {
    const status = this.baseStatus()
    if (!context) return status
    const { contextName, scope } = context
    if (!scope) return { ...status, scope: { contextName, failures: [] } }
    return {
      ...status,
      scope: {
        contextName,
        accountId: scope.accountId,
        region: scope.region,
        account: status.accounts.find((a) => a.accountId === scope.accountId),
        failures: status.failures.filter(
          (f) =>
            f.accountId === scope.accountId &&
            (!scope.region ||
              f.region === scope.region ||
              f.region === AWSINV_GLOBAL_REGION),
        ),
      },
    }
  }

  private baseStatus(): AwsInventoryStatus {
    return {
      running: this.running !== null,
      startedAt: this.startedAt,
      scannedAt: this.snapshot?.scannedAt ?? null,
      accounts: this.snapshot?.accounts ?? [],
      failures: this.snapshot?.failures ?? [],
      lastError: this.lastError,
      binaryFound: this.binaryFound(),
      databaseConfigured: Boolean(this.deps.getDatabaseUrl()),
    }
  }

  list<K extends AwsResourceKind>(
    kind: K,
    scope?: AwsScope,
  ): AwsRowByKind[K][] {
    return selectAwsRows(this.snapshot, kind, scope)
  }

  private async runScan(scan: RunningScan): Promise<void> {
    let accounts: AwsAccount[]
    try {
      accounts = parseAccountsResult(await scan.client.call("accounts"))
    } catch (err) {
      if (
        err instanceof AwsinvRpcError &&
        err.code === AWSINV_RPC_CODE.methodNotFound
      ) {
        throw new AwsinvError(
          "awsinv-outdated",
          "awsinv has no accounts method; update awsinv",
        )
      }
      throw err
    }
    if (scan.cancelled) return

    // Data is at least as fresh as the moment the scan was asked for.
    const scannedAt = new Date().toISOString()
    let result: AwsinvScanResult
    try {
      result = parseScanResult(await scan.client.call("scan"))
    } catch (err) {
      if (
        err instanceof AwsinvRpcError &&
        err.code === AWSINV_RPC_CODE.shuttingDown
      ) {
        if (scan.cancelled) return
        throw new AwsinvError(
          "scan-failed",
          "awsinv shut down before the scan ran",
        )
      }
      throw err
    }

    // Half a scan would read as deleted resources, so the previous one stays.
    if (result.incomplete) {
      if (!scan.cancelled) {
        throw new AwsinvError(
          "scan-incomplete",
          "The scan timed out; the previous results were kept",
        )
      }
      return
    }
    this.snapshot = toSnapshot(
      scannedAt,
      accounts,
      result,
      this.deps.getDatabaseUrl(),
      this.snapshot,
    )
  }

  /** Spawns lazily, and again after an exit or a database URL change. */
  private getClient(databaseUrl: string): AwsinvClient {
    if (this.client?.alive && this.clientDatabaseUrl === databaseUrl) {
      return this.client
    }
    if (this.client) {
      const stale = this.client
      this.client = null
      stale.close(this.deps.killDelayMs)
    }
    // Never in argv: the URL would show in process listings.
    const client = new AwsinvClient(this.deps.getCommand(), {
      ...process.env,
      DATABASE_URL: databaseUrl,
    })
    this.client = client
    this.clientDatabaseUrl = databaseUrl
    void client.exited.then(() => this.dropClient(client))
    return client
  }

  private dropClient(client: AwsinvClient): void {
    if (this.client === client) this.client = null
  }

  /** A status read must never throw, whatever the path lookup does. */
  private binaryFound(): boolean {
    try {
      return this.deps.binaryExists()
    } catch {
      return false
    }
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
