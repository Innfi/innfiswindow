import { AlertTriangle } from "lucide-react"
import { type ReactNode, useCallback, useMemo, useState } from "react"

import {
  type AwsAccount,
  AWSINV_FAILURE_RESOURCE,
  type AwsInventoryStatus,
  type AwsResourceKind,
  type AwsRowByKind,
  type AwsScanFailure,
} from "../../../shared/aws"
import { Button } from "../../components/ui/Button"
import { ClosePanelButton } from "../../components/ui/ClosePanelButton"
import { CollapsibleSection } from "../../components/ui/CollapsibleSection"
import { DetailPanelLayout } from "../../components/ui/DetailPanelLayout"
import { MetaEntry } from "../../components/ui/MetaEntry"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../../components/ui/Popover"
import {
  type ResourceColumn,
  ResourceListView,
} from "../../components/ui/ResourceListView"
import { useAppStore } from "../../store/app.store"
import { useAwsInventoryStatus } from "../hooks/useAwsInventoryStatus"

// ── Shared ───────────────────────────────────────────────────────────────────

type Row<K extends AwsResourceKind> = AwsRowByKind[K]

/** Every row the table may hand back from the store, before `detailGuard`. */
type AnyItem = { name: string; namespace?: string | null }

/** The awsinv list call for a kind. Global views pass no `contextName`. */
type Lister<K extends AwsResourceKind> = (args?: {
  contextName?: string
}) => Promise<Row<K>[]>

interface AwsKindConfig<K extends AwsResourceKind> {
  kind: K
  title: string
  /** False for account-wide kinds (IAM), which have no region filter. */
  regional: boolean
  list: Lister<K>
  /**
   * Tells this kind's rows apart from any other selected item, by fields only
   * this kind carries.
   */
  detailGuard: (item: AnyItem) => boolean
  columns: (accounts: AccountNames) => ResourceColumn<Row<K>>[]
  /** Detail panel entries, after the ID, account and region. */
  details: (row: Row<K>) => [label: string, value: ReactNode][]
}

type AccountNames = (accountId: string) => string

const has = (item: AnyItem, key: string): boolean => key in item

function formatTime(iso: string | null | undefined): string {
  if (!iso) return "—"
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString()
}

const yesNo = (value: boolean): string => (value ? "Yes" : "No")

/** Go encodes nil slices as `null`; main maps them, but be safe on reads. */
const listOf = <T,>(value: T[] | null | undefined): T[] => value ?? []

function accountNamesFrom(accounts: AwsAccount[]): AccountNames {
  const byId = new Map(accounts.map((a) => [a.accountId, a.name]))
  return (accountId) => byId.get(accountId) || accountId
}

/** Fields every row carries, whatever its kind. */
type BaseRow = Row<AwsResourceKind>

function nameColumn<T extends BaseRow>(): ResourceColumn<T> {
  return {
    head: "Name",
    cell: (row) => {
      return (
        <span className="flex items-center gap-2">
          {row.Name || "—"}
          {row.staleSince && (
            <span
              className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900 dark:text-amber-300"
              title={`Last seen ${formatTime(row.staleSince)}`}
            >
              stale
            </span>
          )}
        </span>
      )
    },
    className: "font-medium",
  }
}

function idColumn<T extends BaseRow>(head: string): ResourceColumn<T> {
  return {
    head,
    cell: (row) => row.displayId,
    className: "font-mono text-xs",
  }
}

function monoColumn<T>(
  head: string,
  value: (row: T) => string,
): ResourceColumn<T> {
  return {
    head,
    cell: (row) => value(row) || "—",
    className: "font-mono text-xs",
  }
}

function accountColumn<T extends BaseRow>(
  accounts: AccountNames,
): ResourceColumn<T> {
  return {
    head: "Account",
    cell: (row) => <span title={row.AccountID}>{accounts(row.AccountID)}</span>,
  }
}

function regionColumn<T extends { Region: string }>(): ResourceColumn<T> {
  return { head: "Region", cell: (row) => row.Region }
}

function attachedVpcs(attachments: { VpcID: string }[] | null): string {
  return listOf(attachments)
    .map((a) => a.VpcID)
    .join(", ")
}

// ── Kinds ────────────────────────────────────────────────────────────────────

const VPCS: AwsKindConfig<"vpcs"> = {
  kind: "vpcs",
  regional: true,
  title: "VPCs",
  list: (args) => window.api.aws.listVpcs(args),
  // Subnets also carry VpcID and IsDefault, but no subnet lacks SubnetID.
  detailGuard: (item) =>
    has(item, "VpcID") && has(item, "IsDefault") && !has(item, "SubnetID"),
  columns: (accounts) => [
    nameColumn(),
    idColumn("VPC ID"),
    monoColumn("CIDR", (r) => r.CIDR),
    { head: "Default", cell: (r) => yesNo(r.IsDefault) },
    { head: "State", cell: (r) => r.State },
    accountColumn(accounts),
    regionColumn(),
  ],
  details: (r) => [
    ["CIDR", r.CIDR],
    ["Default", yesNo(r.IsDefault)],
    ["State", r.State],
  ],
}

const SUBNETS: AwsKindConfig<"subnets"> = {
  kind: "subnets",
  regional: true,
  title: "Subnets",
  list: (args) => window.api.aws.listSubnets(args),
  // NAT gateways carry SubnetID too, but no top-level AvailabilityZone.
  detailGuard: (item) => has(item, "SubnetID") && has(item, "AvailabilityZone"),
  columns: (accounts) => [
    nameColumn(),
    idColumn("Subnet ID"),
    monoColumn("VPC ID", (r) => r.VpcID),
    monoColumn("CIDR", (r) => r.CIDR),
    { head: "AZ", cell: (r) => r.AvailabilityZone },
    { head: "Available IPs", cell: (r) => r.AvailableIPs.toLocaleString() },
    { head: "Public IP on launch", cell: (r) => yesNo(r.MapPublicIP) },
    { head: "State", cell: (r) => r.State },
    accountColumn(accounts),
  ],
  details: (r) => [
    ["VPC ID", r.VpcID],
    ["CIDR", r.CIDR],
    ["Availability Zone", r.AvailabilityZone],
    ["Available IPs", r.AvailableIPs.toLocaleString()],
    ["Public IP on launch", yesNo(r.MapPublicIP)],
    ["Default for AZ", yesNo(r.IsDefault)],
    ["State", r.State],
  ],
}

const ROUTE_TABLES: AwsKindConfig<"routeTables"> = {
  kind: "routeTables",
  regional: true,
  title: "Route Tables",
  list: (args) => window.api.aws.listRouteTables(args),
  detailGuard: (item) => has(item, "RouteTableID"),
  columns: (accounts) => [
    nameColumn(),
    idColumn("Route Table ID"),
    monoColumn("VPC ID", (r) => r.VpcID),
    { head: "Main", cell: (r) => yesNo(r.IsMain) },
    { head: "Routes", cell: (r) => listOf(r.Routes).length },
    {
      head: "Associations",
      cell: (r) =>
        listOf(r.Associations).filter((a) => a.State === "associated").length,
    },
    accountColumn(accounts),
    regionColumn(),
  ],
  details: (r) => [
    ["VPC ID", r.VpcID],
    ["Main", yesNo(r.IsMain)],
    ["Routes", listOf(r.Routes).length],
    ["Associations", listOf(r.Associations).length],
  ],
}

const NAT_GATEWAYS: AwsKindConfig<"natGateways"> = {
  kind: "natGateways",
  regional: true,
  title: "NAT Gateways",
  list: (args) => window.api.aws.listNatGateways(args),
  detailGuard: (item) => has(item, "NATGatewayID"),
  columns: (accounts) => [
    nameColumn(),
    idColumn("NAT Gateway ID"),
    monoColumn("VPC ID", (r) => r.VpcID),
    monoColumn("Subnet ID", (r) => r.SubnetID),
    { head: "Type", cell: (r) => r.ConnectivityType },
    { head: "State", cell: (r) => r.State },
    accountColumn(accounts),
    regionColumn(),
  ],
  details: (r) => [
    ["VPC ID", r.VpcID],
    ["Subnet ID", r.SubnetID],
    ["Type", r.ConnectivityType],
    ["Availability mode", r.AvailabilityMode || "—"],
    ["State", r.State],
    ["Addresses", listOf(r.Addresses).length],
  ],
}

const INTERNET_GATEWAYS: AwsKindConfig<"internetGateways"> = {
  kind: "internetGateways",
  regional: true,
  title: "Internet Gateways",
  list: (args) => window.api.aws.listInternetGateways(args),
  detailGuard: (item) => has(item, "InternetGatewayID"),
  columns: (accounts) => [
    nameColumn(),
    idColumn("Gateway ID"),
    monoColumn("Attached VPCs", (r) => attachedVpcs(r.Attachments)),
    monoColumn("Owner", (r) => r.OwnerID),
    accountColumn(accounts),
    regionColumn(),
  ],
  details: (r) => [
    ["Attached VPCs", attachedVpcs(r.Attachments) || "—"],
    ["Owner", r.OwnerID],
  ],
}

const EGRESS_ONLY_GATEWAYS: AwsKindConfig<"egressOnlyGateways"> = {
  kind: "egressOnlyGateways",
  regional: true,
  title: "Egress-Only Gateways",
  list: (args) => window.api.aws.listEgressOnlyGateways(args),
  detailGuard: (item) => has(item, "EgressOnlyInternetGatewayID"),
  columns: (accounts) => [
    nameColumn(),
    idColumn("Gateway ID"),
    monoColumn("Attached VPCs", (r) => attachedVpcs(r.Attachments)),
    accountColumn(accounts),
    regionColumn(),
  ],
  details: (r) => [["Attached VPCs", attachedVpcs(r.Attachments) || "—"]],
}

const TRANSIT_GATEWAYS: AwsKindConfig<"transitGateways"> = {
  kind: "transitGateways",
  regional: true,
  title: "Transit Gateways",
  list: (args) => window.api.aws.listTransitGateways(args),
  detailGuard: (item) => has(item, "TransitGatewayID"),
  columns: (accounts) => [
    nameColumn(),
    idColumn("Gateway ID"),
    monoColumn("Owner", (r) => r.OwnerID),
    { head: "ASN", cell: (r) => r.AmazonSideASN },
    { head: "State", cell: (r) => r.State },
    accountColumn(accounts),
    regionColumn(),
  ],
  details: (r) => [
    ["ARN", r.ARN],
    ["Owner", r.OwnerID],
    ["ASN", r.AmazonSideASN],
    ["Description", r.Description || "—"],
    ["State", r.State],
  ],
}

const IAM_PRINCIPALS: AwsKindConfig<"iamPrincipals"> = {
  kind: "iamPrincipals",
  regional: false,
  title: "IAM Principals",
  list: (args) => window.api.aws.listIamPrincipals(args),
  detailGuard: (item) =>
    has(item, "ARN") && has(item, "Kind") && has(item, "CreateDate"),
  columns: (accounts) => [
    nameColumn(),
    { head: "Kind", cell: (r) => r.Kind },
    monoColumn("Path", (r) => r.Path),
    { head: "Created", cell: (r) => formatTime(r.CreateDate) },
    accountColumn(accounts),
  ],
  details: (r) => [
    ["Kind", r.Kind],
    ["ARN", r.ARN],
    ["Path", r.Path],
    ["Created", formatTime(r.CreateDate)],
  ],
}

// ── Scan header ──────────────────────────────────────────────────────────────

interface AwsFilters {
  accountId: string
  region: string
  text: string
}

const NO_FILTERS: AwsFilters = { accountId: "", region: "", text: "" }

/** `failures` for one kind; resources main does not map belong to no view. */
function failuresOf(
  status: AwsInventoryStatus | null,
  kind: AwsResourceKind,
): AwsScanFailure[] {
  return (status?.failures ?? []).filter(
    (f) => AWSINV_FAILURE_RESOURCE[f.resource] === kind,
  )
}

/** Matches a row against the header's account, region and text filters. */
function matchesFilters(row: BaseRow, filters: AwsFilters): boolean {
  if (filters.accountId && row.AccountID !== filters.accountId) return false
  if (filters.region && "Region" in row && row.Region !== filters.region) {
    return false
  }
  const text = filters.text.trim().toLowerCase()
  if (!text) return true
  const fields = [row.Name, row.displayId, "CIDR" in row ? row.CIDR : ""]
  return fields.some((v) => (v ?? "").toLowerCase().includes(text))
}

const selectClass =
  "h-6 rounded border border-border bg-background px-1.5 text-xs text-foreground"

function FailuresControl({
  failures,
  accounts,
}: {
  failures: AwsScanFailure[]
  accounts: AccountNames
}): JSX.Element | null {
  if (failures.length === 0) return null
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1 rounded px-1.5 py-0.5 font-medium text-amber-600 hover:bg-muted dark:text-amber-400"
          title="Targets the last scan could not read"
        >
          <AlertTriangle className="h-3 w-3" />
          {failures.length}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[28rem] p-0 text-xs">
        <p className="border-b border-border px-3 py-2 text-muted-foreground">
          {failures.length} failed target{failures.length === 1 ? "" : "s"}.
          Rows they had in the previous scan are kept and marked stale.
        </p>
        <ul className="max-h-72 overflow-auto">
          {failures.map((f, i) => (
            <li
              key={`${f.resource}/${f.accountId}/${f.region}/${i}`}
              className="border-b border-border px-3 py-2 last:border-b-0"
            >
              <div className="font-medium">
                {f.resource} · {accounts(f.accountId)} · {f.region}
              </div>
              <div className="break-words text-muted-foreground">
                {f.message}
              </div>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  )
}

function AwsScanHeader({
  status,
  regional,
  failures,
  accounts,
  filters,
  onFiltersChange,
  onScan,
  onCancel,
}: {
  status: AwsInventoryStatus | null
  regional: boolean
  /** This kind's failed targets. */
  failures: AwsScanFailure[]
  accounts: AccountNames
  filters: AwsFilters
  onFiltersChange: (filters: AwsFilters) => void
  onScan: () => void
  onCancel: () => void
}): JSX.Element {
  const accountList = useMemo(() => status?.accounts ?? [], [status?.accounts])
  const regions = useMemo(() => {
    const scoped = filters.accountId
      ? accountList.filter((a) => a.accountId === filters.accountId)
      : accountList
    return [...new Set(scoped.flatMap((a) => listOf(a.regions)))].sort()
  }, [accountList, filters.accountId])
  const hasSnapshot = Boolean(status?.scannedAt)
  const canScan =
    status !== null && status.binaryFound && status.databaseConfigured

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-border px-4 py-2 text-xs">
      <span className="text-muted-foreground">
        Last scan:{" "}
        <span className="text-foreground">
          {hasSnapshot ? formatTime(status?.scannedAt) : "No scan yet"}
        </span>
      </span>
      {status?.running ? (
        <>
          <span className="text-muted-foreground">
            Scanning since {formatTime(status.startedAt)}…
          </span>
          <Button
            size="sm"
            variant="outline"
            className="h-6 text-xs"
            onClick={onCancel}
          >
            Cancel
          </Button>
        </>
      ) : (
        <Button
          size="sm"
          className="h-6 text-xs"
          disabled={!canScan}
          onClick={onScan}
        >
          Scan now
        </Button>
      )}
      <FailuresControl failures={failures} accounts={accounts} />
      {hasSnapshot && status?.lastError && !status.running && (
        <span
          className="min-w-0 truncate text-red-500"
          title={status.lastError.message}
        >
          {status.lastError.code === "scan-incomplete"
            ? "Last scan did not finish; showing the one before"
            : `Last scan failed; showing the one before: ${status.lastError.message}`}
        </span>
      )}
      {hasSnapshot && (
        <div className="ml-auto flex items-center gap-2">
          <select
            aria-label="Account"
            className={selectClass}
            value={filters.accountId}
            onChange={(e) =>
              onFiltersChange({
                ...filters,
                accountId: e.target.value,
                region: "",
              })
            }
          >
            <option value="">All accounts</option>
            {accountList.map((a) => (
              <option key={a.accountId} value={a.accountId}>
                {a.name || a.accountId}
              </option>
            ))}
          </select>
          {regional && (
            <select
              aria-label="Region"
              className={selectClass}
              value={filters.region}
              onChange={(e) =>
                onFiltersChange({ ...filters, region: e.target.value })
              }
            >
              <option value="">All regions</option>
              {regions.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          )}
          <input
            type="search"
            aria-label="Search name, ID or CIDR"
            placeholder="Name, ID or CIDR"
            className="h-6 w-44 rounded border border-border bg-background px-2 text-xs text-foreground placeholder:text-muted-foreground"
            value={filters.text}
            onChange={(e) =>
              onFiltersChange({ ...filters, text: e.target.value })
            }
          />
        </div>
      )}
    </div>
  )
}

// ── States ───────────────────────────────────────────────────────────────────

/**
 * Stands in for the table while there is no snapshot. Each state stays
 * distinct: a missing binary, missing config or an old binary must not read
 * as an empty inventory.
 */
function NoSnapshotState({
  status,
  onScan,
}: {
  status: AwsInventoryStatus | null
  onScan: () => void
}): JSX.Element {
  const setSettingsOpen = useAppStore((s) => s.setSettingsOpen)

  let title: string
  let detail: ReactNode = null
  let action: ReactNode = null

  if (status === null) {
    title = "Loading…"
  } else if (!status.binaryFound) {
    title = "awsinv binary missing"
    detail = (
      <>
        This build ships no awsinv sidecar. Run{" "}
        <code className="font-mono">npm run build:awsinv</code> with the awsinv
        source present, then restart the app.
      </>
    )
  } else if (!status.databaseConfigured) {
    title = "DATABASE_URL not configured"
    detail = "awsinv reads the accounts to scan from Postgres."
    action = (
      <Button size="sm" variant="outline" onClick={() => setSettingsOpen(true)}>
        Open Settings
      </Button>
    )
  } else if (status.running) {
    title = "Scanning…"
    detail = `Started ${formatTime(status.startedAt)}. A scan can take minutes.`
  } else if (status.lastError?.code === "awsinv-outdated") {
    title = "awsinv too old"
    detail = (
      <>
        The binary has no <code className="font-mono">accounts</code> method.
        Update awsinv and rebuild it.
      </>
    )
  } else if (status.lastError) {
    title =
      status.lastError.code === "scan-incomplete"
        ? "Scan did not finish"
        : "Scan failed"
    detail = (
      <span className="whitespace-pre-wrap break-words font-mono text-xs">
        {status.lastError.message}
      </span>
    )
    action = (
      <Button size="sm" onClick={onScan}>
        Scan again
      </Button>
    )
  } else {
    title = "No scan yet"
    detail = "Views read the last complete scan; nothing has been scanned."
    action = (
      <Button size="sm" onClick={onScan}>
        Scan now
      </Button>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center gap-2 px-8 py-16 text-center text-sm">
      <p className="font-medium">{title}</p>
      {detail && <p className="max-w-xl text-muted-foreground">{detail}</p>}
      {action}
    </div>
  )
}

// ── Detail panel ─────────────────────────────────────────────────────────────

function DetailPanel<K extends AwsResourceKind>({
  config,
  row,
  accounts,
  onClose,
}: {
  config: AwsKindConfig<K>
  row: Row<K>
  accounts: AccountNames
  onClose: () => void
}): JSX.Element {
  const tags = "Tags" in row ? Object.entries(row.Tags ?? {}) : []
  return (
    <DetailPanelLayout
      header={
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-semibold text-base mb-1">
              {row.Name || row.displayId}
            </h2>
            <span className="font-mono text-xs text-muted-foreground">
              {row.displayId}
            </span>
            {row.staleSince && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Last seen {formatTime(row.staleSince)}: the latest scan of this
                target failed.
              </p>
            )}
          </div>
          <ClosePanelButton onClose={onClose} />
        </div>
      }
    >
      <CollapsibleSection id={`aws.${config.title}.details`} title="Details">
        <MetaEntry label="ID" value={row.displayId} mono />
        <MetaEntry
          label="Account"
          value={`${accounts(row.AccountID)} (${row.AccountID})`}
        />
        {"Region" in row && <MetaEntry label="Region" value={row.Region} />}
        {config.details(row).map(([label, value]) => (
          <MetaEntry key={label} label={label} value={value} />
        ))}
      </CollapsibleSection>
      {tags.length > 0 && (
        <CollapsibleSection id={`aws.${config.title}.tags`} title="Tags">
          {tags.map(([k, v]) => (
            <MetaEntry key={k} label={k} value={v} />
          ))}
        </CollapsibleSection>
      )}
    </DetailPanelLayout>
  )
}

// ── View ─────────────────────────────────────────────────────────────────────

function AwsResourceView<K extends AwsResourceKind>({
  config,
}: {
  config: AwsKindConfig<K>
}): JSX.Element {
  const { status, scan, cancel } = useAwsInventoryStatus()
  const [filters, setFilters] = useState<AwsFilters>(NO_FILTERS)
  const accounts = useMemo(
    () => accountNamesFrom(status?.accounts ?? []),
    [status?.accounts],
  )
  const columns = useMemo(() => config.columns(accounts), [config, accounts])
  const failures = useMemo(
    () => failuresOf(status, config.kind),
    [status, config.kind],
  )
  const rowFilter = useCallback(
    (row: Row<K>) => matchesFilters(row, filters),
    [filters],
  )

  // Zero rows next to failed targets is not "zero resources".
  const emptyMessage =
    failures.length > 0
      ? `No ${config.title} from the targets that scanned; ${failures.length} failed (see ⚠)`
      : `No ${config.title} in the last scan`

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <AwsScanHeader
        status={status}
        regional={config.regional}
        failures={failures}
        accounts={accounts}
        filters={filters}
        onFiltersChange={setFilters}
        onScan={scan}
        onCancel={cancel}
      />
      <div className="flex-1 overflow-hidden">
        {status?.scannedAt ? (
          <ResourceListView<Row<K>>
            // A finished scan replaces the snapshot; remounting re-lists at
            // once, even when the refresh interval is off.
            key={status.scannedAt}
            title={config.title}
            emptyMessage={emptyMessage}
            namespaced={false}
            usesSelectors={false}
            list={(ctx) => config.list(ctx ? { contextName: ctx } : undefined)}
            rowKey={(row) => row.name}
            rowFilter={rowFilter}
            rowClassName={(row) => (row.staleSince ? "opacity-60" : undefined)}
            columns={columns}
            detailGuard={config.detailGuard}
            renderDetail={(row, ctl) => (
              <DetailPanel
                config={config}
                row={row}
                accounts={accounts}
                onClose={ctl.onClose}
              />
            )}
          />
        ) : (
          <NoSnapshotState status={status} onScan={scan} />
        )}
      </div>
    </div>
  )
}

export function AwsVpcsView(): JSX.Element {
  return <AwsResourceView config={VPCS} />
}

export function AwsSubnetsView(): JSX.Element {
  return <AwsResourceView config={SUBNETS} />
}

export function AwsRouteTablesView(): JSX.Element {
  return <AwsResourceView config={ROUTE_TABLES} />
}

export function AwsNatGatewaysView(): JSX.Element {
  return <AwsResourceView config={NAT_GATEWAYS} />
}

export function AwsInternetGatewaysView(): JSX.Element {
  return <AwsResourceView config={INTERNET_GATEWAYS} />
}

export function AwsEgressOnlyGatewaysView(): JSX.Element {
  return <AwsResourceView config={EGRESS_ONLY_GATEWAYS} />
}

export function AwsTransitGatewaysView(): JSX.Element {
  return <AwsResourceView config={TRANSIT_GATEWAYS} />
}

export function AwsIamPrincipalsView(): JSX.Element {
  return <AwsResourceView config={IAM_PRINCIPALS} />
}
