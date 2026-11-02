import { mkdtempSync, rmSync, writeFileSync } from "fs"
import { tmpdir } from "os"
import { join } from "path"
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest"

import { AWSINV_CONTRACT_VERSION } from "../../shared/aws"
import {
  AwsInventory,
  mapInventory,
  parseEnvelope,
  redactSecrets,
  toSnapshot,
} from "../handlers/aws-inventory"
import { parseEksClusterArn } from "../handlers/cluster"

// No kind cluster here: the sidecar is a Node script standing in for awsinv.
const envelope = (overrides: object = {}): string =>
  JSON.stringify({
    contractVersion: AWSINV_CONTRACT_VERSION,
    scannedAt: "2026-11-02T10:00:00Z",
    incomplete: false,
    accounts: [{ accountId: "111111111111", name: "prod", regions: null }],
    errors: null,
    inventory: {
      VPCs: [{ AccountID: "111111111111", Region: "r1", VpcID: "vpc-1" }],
    },
    ...overrides,
  })

const SIDECAR = `
const mode = process.env.FAKE_MODE
const body = process.env.FAKE_BODY
if (mode === "fail") {
  console.error("connect failed: " + process.env.DATABASE_URL)
  process.exit(1)
}
if (mode === "ok") {
  process.stdout.write(body)
} else if (mode === "wait") {
  process.stdin.resume()
  process.stdin.on("end", () => {
    process.stdout.write(body)
    process.exit(0)
  })
} else if (mode === "ignore-cancel") {
  process.stdin.resume()
  setInterval(() => {}, 1000)
}
`

let dir: string
let script: string

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "awsinv-fake-"))
  script = join(dir, "sidecar.js")
  writeFileSync(script, SIDECAR)
})

afterAll(() => rmSync(dir, { recursive: true, force: true }))

function setup(
  mode: string,
  body = envelope(),
): {
  inventory: AwsInventory
  finished: () => Promise<void>
} {
  process.env.FAKE_MODE = mode
  process.env.FAKE_BODY = body
  let changes = 0
  let resolveFinished: () => void = () => {}
  const inventory = new AwsInventory({
    getCommand: () => ({ command: process.execPath, args: [script] }),
    binaryExists: () => true,
    getDatabaseUrl: () => "postgres://user:hunter2@db/inv",
    killDelayMs: 200,
    onChange: () => {
      changes++
      if (changes === 2) resolveFinished()
    },
  })
  const done = new Promise<void>((resolve) => (resolveFinished = resolve))
  return { inventory, finished: () => done }
}

describe("AwsInventory scans", () => {
  test("stores a complete scan", async () => {
    const { inventory, finished } = setup("ok")
    inventory.startScan()
    expect(inventory.getStatus().running).toBe(true)
    await finished()
    const status = inventory.getStatus()
    expect(status.running).toBe(false)
    expect(status.scannedAt).toBe("2026-11-02T10:00:00Z")
    expect(status.lastError).toBeNull()
    expect(inventory.list("vpcs")[0].name).toBe("vpc-1@111111111111")
  })

  test("keeps rows that succeeded and reports failed targets", async () => {
    const errors = [
      { resource: "iam", accountId: "2", region: "global", message: "denied" },
    ]
    const { inventory, finished } = setup("ok", envelope({ errors }))
    inventory.startScan()
    await finished()
    expect(inventory.getStatus().errors).toEqual(errors)
    expect(inventory.list("vpcs")).toHaveLength(1)
  })

  test("reports a non-zero exit with the secret redacted", async () => {
    const { inventory, finished } = setup("fail")
    inventory.startScan()
    await finished()
    const { lastError } = inventory.getStatus()
    expect(lastError?.code).toBe("scan-failed")
    expect(lastError?.message).toContain("connect failed")
    expect(lastError?.message).not.toContain("hunter2")
  })

  test("reports invalid JSON", async () => {
    const { inventory, finished } = setup("ok", "not json")
    inventory.startScan()
    await finished()
    expect(inventory.getStatus().lastError?.message).toContain("invalid JSON")
  })

  test("rejects an unknown contract version", async () => {
    const { inventory, finished } = setup(
      "ok",
      envelope({ contractVersion: 999 }),
    )
    inventory.startScan()
    await finished()
    expect(inventory.getStatus().lastError?.message).toContain("update awsinv")
  })

  test("rejects a second scan while one runs", async () => {
    const { inventory, finished } = setup("wait")
    inventory.startScan()
    expect(() => inventory.startScan()).toThrow("already running")
    inventory.cancelScan()
    await finished()
  })

  test("discards an incomplete scan on cancel, with no error", async () => {
    const { inventory, finished } = setup(
      "wait",
      envelope({ incomplete: true }),
    )
    inventory.startScan()
    inventory.cancelScan()
    await finished()
    const status = inventory.getStatus()
    expect(status.running).toBe(false)
    expect(status.scannedAt).toBeNull()
    expect(status.lastError).toBeNull()
  })

  test("reports an incomplete scan nobody cancelled", async () => {
    const { inventory, finished } = setup("ok", envelope({ incomplete: true }))
    inventory.startScan()
    await finished()
    const status = inventory.getStatus()
    expect(status.scannedAt).toBeNull()
    expect(status.lastError?.code).toBe("scan-incomplete")
  })

  test("kills a scan that ignores cancel", async () => {
    const { inventory, finished } = setup("ignore-cancel")
    inventory.startScan()
    inventory.cancelScan()
    await finished()
    expect(inventory.getStatus().running).toBe(false)
    expect(inventory.getStatus().lastError).toBeNull()
  })

  test("stop ends a running scan", async () => {
    const { inventory, finished } = setup("ignore-cancel")
    inventory.startScan()
    inventory.stop()
    await finished()
    expect(inventory.getStatus().running).toBe(false)
  })

  test("reports a missing binary", async () => {
    let resolveFinished: () => void = () => {}
    const done = new Promise<void>((resolve) => (resolveFinished = resolve))
    const onChange = vi.fn(() => {
      if (onChange.mock.calls.length === 2) resolveFinished()
    })
    const inventory = new AwsInventory({
      getCommand: () => ({ command: join(dir, "does-not-exist") }),
      binaryExists: () => false,
      getDatabaseUrl: () => "postgres://db",
      onChange,
    })
    inventory.startScan()
    await done
    expect(inventory.getStatus().lastError?.code).toBe("binary-missing")
  })

  test("does not spawn without a database URL", () => {
    const inventory = new AwsInventory({
      getCommand: () => ({ command: join(dir, "does-not-exist") }),
      binaryExists: () => true,
      getDatabaseUrl: () => undefined,
      onChange: () => {},
    })
    inventory.startScan()
    const status = inventory.getStatus()
    expect(status.running).toBe(false)
    expect(status.lastError?.code).toBe("not-configured")
  })
})

describe("snapshot mapping", () => {
  test("treats Go's null slices as empty", () => {
    const rows = mapInventory({
      VPCs: null,
      RouteTables: [
        {
          AccountID: "1",
          RouteTableID: "rtb-1",
          Associations: null,
          Routes: null,
        },
      ],
    } as never)
    expect(rows.vpcs).toEqual([])
    expect(rows.subnets).toEqual([])
    expect(rows.routeTables[0].Routes).toEqual([])
    expect(rows.routeTables[0].Associations).toEqual([])
  })

  test("keeps a shared resource distinct per account", () => {
    const shared = { TransitGatewayID: "tgw-1", Region: "r1" }
    const rows = mapInventory({
      TransitGateways: [
        { ...shared, AccountID: "1" },
        { ...shared, AccountID: "2" },
      ],
    } as never)
    expect(rows.transitGateways.map((t) => t.name)).toEqual([
      "tgw-1@1",
      "tgw-1@2",
    ])
    expect(rows.transitGateways[0].displayId).toBe("tgw-1")
  })

  test("names IAM principals by ARN", () => {
    const rows = mapInventory({
      IAM: [{ AccountID: "1", ID: "AROA1", ARN: "arn:aws:iam::1:role/x" }],
    } as never)
    expect(rows.iamPrincipals[0].name).toBe("arn:aws:iam::1:role/x")
  })

  test("drops account fields beyond the renderer's shape", () => {
    const snapshot = toSnapshot(
      parseEnvelope(
        envelope({
          accounts: [
            {
              accountId: "1",
              name: "prod",
              regions: ["r1"],
              RoleARN: "arn:aws:iam::1:role/secret",
              ExternalID: "secret",
            },
          ],
        }),
      ),
    )
    expect(JSON.stringify(snapshot)).not.toContain("secret")
  })
})

describe("scoped lists", () => {
  async function scanned(): Promise<AwsInventory> {
    const { inventory, finished } = setup(
      "ok",
      envelope({
        inventory: {
          VPCs: [
            { AccountID: "1", Region: "r1", VpcID: "vpc-a" },
            { AccountID: "1", Region: "r2", VpcID: "vpc-b" },
            { AccountID: "2", Region: "r1", VpcID: "vpc-c" },
          ],
          IAM: [{ AccountID: "1", ID: "x", ARN: "arn-x" }],
        },
      }),
    )
    inventory.startScan()
    await finished()
    return inventory
  }

  test("filters by account and region", async () => {
    const inventory = await scanned()
    const ids = inventory
      .list("vpcs", { accountId: "1", region: "r1" })
      .map((v) => v.displayId)
    expect(ids).toEqual(["vpc-a"])
  })

  test("keeps IAM account-wide", async () => {
    const inventory = await scanned()
    expect(
      inventory.list("iamPrincipals", { accountId: "1", region: "r1" }),
    ).toHaveLength(1)
  })
})

describe("redactSecrets", () => {
  test("removes the exact URL", () => {
    expect(redactSecrets("bad db://a b", "db://a")).toBe("bad [redacted] b")
  })

  test("removes URLs with credentials and postgres URLs", () => {
    expect(redactSecrets("x postgres://u:p@h/d y")).toBe("x [redacted] y")
    expect(redactSecrets("x https://u:p@h/d y")).toBe("x [redacted] y")
  })

  test("removes key=value passwords", () => {
    expect(redactSecrets("host=h password=abc")).toBe(
      "host=h password=[redacted]",
    )
  })
})

describe("parseEksClusterArn", () => {
  test("reads account and region", () => {
    expect(
      parseEksClusterArn(
        "arn:aws:eks:ap-northeast-2:123456789012:cluster/prod",
      ),
    ).toEqual({ awsAccountId: "123456789012", awsRegion: "ap-northeast-2" })
  })

  test("accepts other partitions", () => {
    expect(
      parseEksClusterArn(
        "arn:aws-us-gov:eks:us-gov-west-1:123456789012:cluster/x",
      )?.awsRegion,
    ).toBe("us-gov-west-1")
  })

  test("ignores other cluster names", () => {
    expect(parseEksClusterArn("kind-local")).toBeNull()
    expect(parseEksClusterArn("arn:aws:iam::123456789012:role/x")).toBeNull()
  })
})
