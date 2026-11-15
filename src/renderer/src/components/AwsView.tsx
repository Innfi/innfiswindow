import { type ReactNode, useMemo } from "react"

import type {
  AwsAccount,
  AwsInventoryStatus,
  AwsResourceKind,
  AwsRowByKind,
} from "../../../shared/aws"
import { Button } from "../../components/ui/Button"
import { ClosePanelButton } from "../../components/ui/ClosePanelButton"
import { CollapsibleSection } from "../../components/ui/CollapsibleSection"
import { DetailPanelLayout } from "../../components/ui/DetailPanelLayout"
import { MetaEntry } from "../../components/ui/MetaEntry"
import {
  type ResourceColumn,
  ResourceListView,
} from "../../components/ui/ResourceListView"
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
  title: string
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

// ── Scan strip ───────────────────────────────────────────────────────────────

function ScanStrip({
  status,
  onScan,
  onCancel,
}: {
  status: AwsInventoryStatus | null
  onScan: () => void
  onCancel: () => void
}): JSX.Element {
  return (
    <div className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-2 text-xs">
      <span className="text-muted-foreground">
        Last scan:{" "}
        <span className="text-foreground">
          {status?.scannedAt ? formatTime(status.scannedAt) : "No scan yet"}
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
          disabled={!status}
          onClick={onScan}
        >
          Scan now
        </Button>
      )}
      {status?.lastError && !status.running && (
        <span
          className="truncate text-red-500"
          title={status.lastError.message}
        >
          {status.lastError.message}
        </span>
      )}
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
  const accounts = useMemo(
    () => accountNamesFrom(status?.accounts ?? []),
    [status?.accounts],
  )
  const columns = useMemo(() => config.columns(accounts), [config, accounts])

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <ScanStrip status={status} onScan={scan} onCancel={cancel} />
      <div className="flex-1 overflow-hidden">
        <ResourceListView<Row<K>>
          // A finished scan replaces the snapshot; remounting re-lists at
          // once, even when the refresh interval is off.
          key={status?.scannedAt ?? "none"}
          title={config.title}
          emptyMessage={
            status?.scannedAt
              ? `No ${config.title} in the last scan`
              : "No scan yet"
          }
          namespaced={false}
          list={(ctx) => config.list(ctx ? { contextName: ctx } : undefined)}
          rowKey={(row) => row.name}
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
