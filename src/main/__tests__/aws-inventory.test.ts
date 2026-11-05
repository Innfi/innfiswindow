import { mkdtempSync, rmSync, writeFileSync } from "fs"
import { tmpdir } from "os"
import { join } from "path"
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest"

import {
  AwsInventory,
  mapInventory,
  parseAccountsResult,
  redactSecrets,
  toSnapshot,
} from "../handlers/aws-inventory"
import { parseEksClusterArn } from "../handlers/cluster"

// No kind cluster here: the sidecar is a Node script speaking awsinv's
// line-delimited JSON-RPC on stdio.
const scanResult = (overrides: object = {}): string =>
  JSON.stringify({
    incomplete: false,
    inventory: {
      VPCs: [{ AccountID: "111111111111", Region: "r1", VpcID: "vpc-1" }],
    },
    failures: [],
    ...overrides,
  })

const SIDECAR = String.raw`
const readline = require("readline")
const mode = process.env.FAKE_MODE
const scan = JSON.parse(process.env.FAKE_SCAN)
const send = (msg) =>
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", ...msg }) + "\n")
if (mode === "setup-fail") {
  console.error("connect failed: " + process.env.DATABASE_URL)
  process.exit(1)
}
let held = null
const rl = readline.createInterface({ input: process.stdin })
rl.on("line", (line) => {
  const req = JSON.parse(line)
  if (req.method === "accounts") {
    if (mode === "old") {
      return send({ id: req.id, error: { code: -32601, message: "method not found: accounts" } })
    }
    return send({ id: req.id, result: { accounts: [
      { accountId: "111111111111", name: "prod", regions: null, RoleARN: "arn:aws:iam::1:role/secret" },
    ] } })
  }
  if (mode === "rpc-error") {
    return send({ id: req.id, error: { code: Number(process.env.FAKE_CODE), message: "boom " + process.env.DATABASE_URL } })
  }
  if (mode === "bad-json") return process.stdout.write("not json\n")
  if (mode === "wrong-id") return send({ id: 999, result: scan })
  if (mode === "both") return send({ id: req.id, result: scan, error: { code: 1, message: "x" } })
  if (mode === "die") {
    console.error("panic: " + process.env.DATABASE_URL)
    process.exit(2)
  }
  if (["wait", "shutdown", "ignore-cancel", "silent"].includes(mode)) {
    held = req
    return
  }
  // Split one reply over two writes: the client must buffer to the newline.
  const text = JSON.stringify({ jsonrpc: "2.0", id: req.id, result: scan })
  process.stdout.write(text.slice(0, 10))
  setTimeout(() => process.stdout.write(text.slice(10) + "\n"), 5)
})
rl.on("close", () => {
  if (mode === "ignore-cancel") return setInterval(() => {}, 1000)
  if (held && mode === "wait") send({ id: held.id, result: { ...scan, incomplete: true } })
  if (held && mode === "shutdown") send({ id: held.id, error: { code: -32000, message: "server shutting down" } })
  process.exit(0)
})
`

let dir: string
let script: string

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "awsinv-fake-"))
  script = join(dir, "sidecar.js")
  writeFileSync(script, SIDECAR)
})

afterAll(() => rmSync(dir, { recursive: true, force: true }))

const SECRET_URL = "postgres://user:hunter2@db/inv"

function setup(
  mode: string,
  scan = scanResult(),
  extraEnv: Record<string, string> = {},
): {
  inventory: AwsInventory
  /** Resolves when the current scan finishes: start and finish each notify. */
  finished: () => Promise<void>
} {
  Object.assign(process.env, { FAKE_MODE: mode, FAKE_SCAN: scan }, extraEnv)
  let changes = 0
  let target = 2
  let resolveFinished: () => void = () => {}
  let done = new Promise<void>((resolve) => (resolveFinished = resolve))
  const inventory = new AwsInventory({
    getCommand: () => ({ command: process.execPath, args: [script] }),
    binaryExists: () => true,
    getDatabaseUrl: () => SECRET_URL,
    killDelayMs: 200,
    onChange: () => {
      changes++
      if (changes !== target) return
      const resolve = resolveFinished
      target += 2
      done = new Promise<void>((r) => (resolveFinished = r))
      resolve()
    },
  })
  return { inventory, finished: () => done }
}

/** `finished()` for the scan just started, taken before anything can settle. */
function scanOnce(
  inventory: AwsInventory,
  finished: () => Promise<void>,
): Promise<void> {
  const done = finished()
  inventory.startScan()
  return done
}

describe("AwsInventory scans", () => {
  test("stores a complete scan", async () => {
    const { inventory, finished } = setup("ok")
    const before = new Date().toISOString()
    const done = scanOnce(inventory, finished)
    expect(inventory.getStatus().running).toBe(true)
    await done
    const status = inventory.getStatus()
    expect(status.running).toBe(false)
    expect(status.lastError).toBeNull()
    expect(status.scannedAt! >= before).toBe(true)
    expect(status.accounts).toEqual([
      { accountId: "111111111111", name: "prod", regions: [] },
    ])
    expect(JSON.stringify(status)).not.toContain("secret")
    expect(inventory.list("vpcs")[0].name).toBe("vpc-1@111111111111")
    inventory.stop()
  })

  test("reuses one child for a second scan", async () => {
    const { inventory, finished } = setup("ok")
    await scanOnce(inventory, finished)
    const first = inventory.getStatus().scannedAt!
    await scanOnce(inventory, finished)
    expect(inventory.getStatus().lastError).toBeNull()
    expect(inventory.getStatus().scannedAt! >= first).toBe(true)
    inventory.stop()
  })

  test("keeps rows that succeeded and reports failed targets", async () => {
    const failures = [
      { resource: "iam", accountId: "2", region: "global", message: "denied" },
    ]
    const { inventory, finished } = setup("ok", scanResult({ failures }))
    await scanOnce(inventory, finished)
    expect(inventory.getStatus().failures).toEqual(failures)
    expect(inventory.list("vpcs")).toHaveLength(1)
    inventory.stop()
  })

  test("reports a setup exit with the secret redacted", async () => {
    const { inventory, finished } = setup("setup-fail")
    await scanOnce(inventory, finished)
    const { lastError } = inventory.getStatus()
    expect(lastError?.code).toBe("scan-failed")
    expect(lastError?.message).toContain("connect failed")
    expect(lastError?.message).not.toContain("hunter2")
  })

  test("reports a child that dies mid-call, then respawns", async () => {
    const { inventory, finished } = setup("die")
    await scanOnce(inventory, finished)
    expect(inventory.getStatus().lastError?.message).toContain("panic")
    expect(inventory.getStatus().lastError?.message).not.toContain("hunter2")
    process.env.FAKE_MODE = "ok"
    await scanOnce(inventory, finished)
    expect(inventory.getStatus().lastError).toBeNull()
    inventory.stop()
  })

  test.each([-32602, -32603, -32600, -32700])(
    "reports RPC error %i with the secret redacted",
    async (code) => {
      const { inventory, finished } = setup("rpc-error", scanResult(), {
        FAKE_CODE: String(code),
      })
      await scanOnce(inventory, finished)
      const { lastError } = inventory.getStatus()
      expect(lastError?.code).toBe("scan-failed")
      expect(lastError?.message).toContain("boom")
      expect(lastError?.message).not.toContain("hunter2")
      inventory.stop()
    },
  )

  test("reports an old binary without accounts", async () => {
    const { inventory, finished } = setup("old")
    await scanOnce(inventory, finished)
    const { lastError } = inventory.getStatus()
    expect(lastError?.code).toBe("awsinv-outdated")
    expect(lastError?.message).toContain("update awsinv")
    inventory.stop()
  })

  test.each(["bad-json", "wrong-id", "both"])(
    "fails on protocol error: %s",
    async (mode) => {
      const { inventory, finished } = setup(mode)
      await scanOnce(inventory, finished)
      expect(inventory.getStatus().lastError?.code).toBe("scan-failed")
      expect(inventory.getStatus().scannedAt).toBeNull()
    },
  )

  test("rejects a second scan while one runs", async () => {
    const { inventory, finished } = setup("wait")
    const done = scanOnce(inventory, finished)
    expect(() => inventory.startScan()).toThrow("already running")
    inventory.cancelScan()
    await done
  })

  test.each(["wait", "shutdown", "silent", "ignore-cancel"])(
    "cancel keeps the previous snapshot with no error: %s",
    async (mode) => {
      const { inventory, finished } = setup("ok")
      await scanOnce(inventory, finished)
      const scannedAt = inventory.getStatus().scannedAt

      process.env.FAKE_MODE = mode
      inventory.restartIdle() // the next scan gets a child in the new mode
      const done = scanOnce(inventory, finished)
      await new Promise((r) => setTimeout(r, 300)) // let `scan` be sent
      inventory.cancelScan()
      await done
      const status = inventory.getStatus()
      expect(status.running).toBe(false)
      expect(status.scannedAt).toBe(scannedAt)
      expect(status.lastError).toBeNull()
      expect(inventory.list("vpcs")).toHaveLength(1)
    },
  )

  test("reports an incomplete scan nobody cancelled", async () => {
    const { inventory, finished } = setup(
      "ok",
      scanResult({ incomplete: true }),
    )
    await scanOnce(inventory, finished)
    const status = inventory.getStatus()
    expect(status.scannedAt).toBeNull()
    expect(status.lastError?.code).toBe("scan-incomplete")
    inventory.stop()
  })

  test("stop ends a running scan", async () => {
    const { inventory, finished } = setup("ignore-cancel")
    const done = scanOnce(inventory, finished)
    inventory.stop()
    await done
    expect(inventory.getStatus().running).toBe(false)
    expect(inventory.getStatus().lastError).toBeNull()
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
    const accounts = parseAccountsResult({
      accounts: [
        {
          accountId: "1",
          name: "prod",
          regions: ["r1"],
          RoleARN: "arn:aws:iam::1:role/secret",
          ExternalID: "secret",
        },
      ],
    })
    const snapshot = toSnapshot("t", accounts, {
      incomplete: false,
      inventory: null,
      failures: null,
    })
    expect(JSON.stringify(snapshot)).not.toContain("secret")
    expect(snapshot.failures).toEqual([])
  })

  test("redacts failure messages", () => {
    const snapshot = toSnapshot(
      "t",
      [],
      {
        incomplete: false,
        inventory: null,
        failures: [
          { resource: "vpc", accountId: "1", region: "r", message: "x db://a" },
        ],
      },
      "db://a",
    )
    expect(snapshot.failures[0].message).toBe("x [redacted]")
  })
})

describe("scoped lists", () => {
  async function scanned(): Promise<AwsInventory> {
    const { inventory, finished } = setup(
      "ok",
      scanResult({
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
    await scanOnce(inventory, finished)
    inventory.stop()
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
