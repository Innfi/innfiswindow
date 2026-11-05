/**
 * The awsinv sidecar's JSON-RPC results (`../golang/awsinv/api/api.go`) and
 * the shapes main derives from them. Resource fields keep the Go struct
 * spelling (`VpcID`, `AccountID`), since `inventory` has no JSON tags.
 */

/** JSON-RPC error codes awsinv sends; see `api.Code*`. */
export const AWSINV_RPC_CODE = {
  parseError: -32700,
  invalidRequest: -32600,
  methodNotFound: -32601,
  invalidParams: -32602,
  internalError: -32603,
  shuttingDown: -32000,
} as const

/** `api.AccountInfo`. */
export interface AwsAccount {
  accountId: string
  name: string
  regions: string[]
}

/** `api.ScanFailure`: one (resource, account, region) that could not be scanned. */
export interface AwsScanFailure {
  resource: string
  accountId: string
  region: string
  message: string
}

export interface AwsVpc {
  AccountID: string
  Region: string
  VpcID: string
  CIDR: string
  IsDefault: boolean
  State: string
  Name: string
  Tags: Record<string, string>
}

export interface AwsSubnet {
  AccountID: string
  Region: string
  SubnetID: string
  VpcID: string
  CIDR: string
  AvailabilityZone: string
  AvailableIPs: number
  MapPublicIP: boolean
  IsDefault: boolean
  State: string
  Name: string
  Tags: Record<string, string>
}

export interface AwsRouteTableAssociation {
  AssociationID: string
  SubnetID: string
  GatewayID: string
  IsMain: boolean
  State: string
}

export interface AwsRoute {
  Destination: string
  Target: string
  State: string
  Origin: string
}

export interface AwsRouteTable {
  AccountID: string
  Region: string
  RouteTableID: string
  VpcID: string
  IsMain: boolean
  Associations: AwsRouteTableAssociation[]
  Routes: AwsRoute[]
  Name: string
  Tags: Record<string, string>
}

export interface AwsNatGatewayAddress {
  AllocationID: string
  NetworkInterfaceID: string
  PrivateIP: string
  PublicIP: string
  AvailabilityZone: string
  IsPrimary: boolean
  Status: string
}

export interface AwsNatGateway {
  AccountID: string
  Region: string
  NATGatewayID: string
  VpcID: string
  SubnetID: string
  ConnectivityType: string
  AvailabilityMode: string
  State: string
  Addresses: AwsNatGatewayAddress[]
  Name: string
  Tags: Record<string, string>
}

export interface AwsGatewayAttachment {
  VpcID: string
  State: string
}

export interface AwsInternetGateway {
  AccountID: string
  Region: string
  InternetGatewayID: string
  OwnerID: string
  Attachments: AwsGatewayAttachment[]
  Name: string
  Tags: Record<string, string>
}

export interface AwsEgressOnlyGateway {
  AccountID: string
  Region: string
  EgressOnlyInternetGatewayID: string
  Attachments: AwsGatewayAttachment[]
  Name: string
  Tags: Record<string, string>
}

export interface AwsTransitGateway {
  AccountID: string
  Region: string
  TransitGatewayID: string
  ARN: string
  OwnerID: string
  AmazonSideASN: number
  Description: string
  State: string
  Name: string
  Tags: Record<string, string>
}

/** IAM is global, so a principal has no `Region`. */
export interface AwsIamPrincipal {
  AccountID: string
  Kind: string
  Name: string
  ID: string
  ARN: string
  Path: string
  CreateDate: string
}

/**
 * Adds what `ResourceListView` needs. `name` is unique across accounts, because
 * a shared resource is listed by each account it is shared with. It is not the
 * AWS `Name` tag: table cells show `displayId` and `Name`. There is deliberately
 * no `namespace`, since `navigateToResourceRef` moves the app-wide namespace
 * scope to whatever namespace it is given.
 */
export type AwsRow<T> = T & { name: string; displayId: string }

export interface AwsRowByKind {
  vpcs: AwsRow<AwsVpc>
  subnets: AwsRow<AwsSubnet>
  routeTables: AwsRow<AwsRouteTable>
  natGateways: AwsRow<AwsNatGateway>
  internetGateways: AwsRow<AwsInternetGateway>
  egressOnlyGateways: AwsRow<AwsEgressOnlyGateway>
  transitGateways: AwsRow<AwsTransitGateway>
  iamPrincipals: AwsRow<AwsIamPrincipal>
}

export type AwsResourceKind = keyof AwsRowByKind

export type AwsRows = { [K in AwsResourceKind]: AwsRowByKind[K][] }

export interface AwsInventorySnapshot {
  scannedAt: string
  accounts: AwsAccount[]
  failures: AwsScanFailure[]
  rows: AwsRows
}

export type AwsInventoryErrorCode =
  | "binary-missing"
  | "not-configured"
  /** The binary has no `accounts` method (`-32601`). */
  | "awsinv-outdated"
  | "scan-failed"
  | "scan-incomplete"

export interface AwsInventoryError {
  code: AwsInventoryErrorCode
  message: string
}

export interface AwsInventoryStatus {
  running: boolean
  startedAt: string | null
  scannedAt: string | null
  accounts: AwsAccount[]
  failures: AwsScanFailure[]
  /** Why the last scan produced no snapshot. Any earlier snapshot is kept. */
  lastError: AwsInventoryError | null
  binaryFound: boolean
  databaseConfigured: boolean
}

/** Never carries the URL: a renderer only learns whether one is set. */
export interface AwsInventoryConfigState {
  hasDatabaseUrl: boolean
  source: "stored" | "env" | null
  encryptionAvailable: boolean
}

export interface AwsScope {
  accountId: string
  /** Ignored for IAM principals, which are account-wide. */
  region?: string
}
