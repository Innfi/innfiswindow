import { createServer, Server } from "http"
import { AddressInfo } from "net"
import { PassThrough, Writable } from "stream"
import { afterEach, describe, expect, test } from "vitest"
import { KubeConfig } from "@kubernetes/client-node"

import {
  createLineSplitter,
  readContainerLog,
  toLogQueryOptions,
  toRfc3339Seconds,
  writeContainerLogs,
} from "../ipc/pod-streams"

// Both helpers decide what the panel actually shows, and neither is reachable
// from a kind cluster test: the query mapping is checked before it becomes a
// URL, and the splitter is checked against chunk boundaries a real stream only
// hits by luck.
describe("toLogQueryOptions", () => {
  test("follows with no limits by default", () => {
    expect(toLogQueryOptions(undefined)).toEqual({
      follow: true,
      previous: false,
      timestamps: false,
    })
  })

  test("omits tailLines and sinceSeconds when they are null", () => {
    const opts = toLogQueryOptions({ tailLines: null, sinceSeconds: null })
    expect(opts).not.toHaveProperty("tailLines")
    expect(opts).not.toHaveProperty("sinceSeconds")
  })

  test("passes limits through when set", () => {
    expect(
      toLogQueryOptions({ tailLines: 50, sinceSeconds: 300 }),
    ).toMatchObject({ tailLines: 50, sinceSeconds: 300 })
  })

  test("keeps tailLines: 0, which means no lines rather than no limit", () => {
    expect(toLogQueryOptions({ tailLines: 0 })).toMatchObject({ tailLines: 0 })
  })

  test("turns follow off for a previous-instance read", () => {
    expect(toLogQueryOptions({ previous: true, follow: true })).toMatchObject({
      previous: true,
      follow: false,
    })
  })

  test("honours an explicit follow: false", () => {
    expect(toLogQueryOptions({ follow: false })).toMatchObject({
      follow: false,
    })
  })

  test("sends sinceTime as RFC 3339 UTC at whole seconds", () => {
    expect(
      toLogQueryOptions({ sinceTime: "2026-09-19T10:15:30.789+09:00" }),
    ).toMatchObject({ sinceTime: "2026-09-19T01:15:30Z" })
  })

  test("sinceTime wins over sinceSeconds, which the API refuses together", () => {
    const opts = toLogQueryOptions({
      sinceTime: "2026-09-19T01:15:30Z",
      sinceSeconds: 300,
    })
    expect(opts).toMatchObject({ sinceTime: "2026-09-19T01:15:30Z" })
    expect(opts).not.toHaveProperty("sinceSeconds")
  })

  test("a null sinceTime leaves sinceSeconds in charge", () => {
    const opts = toLogQueryOptions({ sinceTime: null, sinceSeconds: 300 })
    expect(opts).toMatchObject({ sinceSeconds: 300 })
    expect(opts).not.toHaveProperty("sinceTime")
  })
})

describe("toRfc3339Seconds", () => {
  test("refuses what it cannot read instead of sending a 400", () => {
    expect(() => toRfc3339Seconds("yesterday-ish")).toThrow(
      "Invalid log start time",
    )
  })
})

// Stands in for `Log.log`: pushes the given text into the sink and ends it on
// a later tick, the way a response body piped into it would.
function fakeRead(
  logs: Record<string, string>,
  failFor?: string,
): (container: string, sink: Writable) => Promise<unknown> {
  return (container, sink) => {
    if (container === failFor) {
      return Promise.reject(new Error(`log of ${container} unavailable`))
    }
    setImmediate(() => sink.end(logs[container] ?? ""))
    return Promise.resolve()
  }
}

function collect(): { out: PassThrough; text: () => string } {
  const out = new PassThrough()
  const chunks: Buffer[] = []
  out.on("data", (c: Buffer) => chunks.push(c))
  return { out, text: () => Buffer.concat(chunks).toString() }
}

describe("writeContainerLogs", () => {
  test("writes one container's log as-is, without a header", async () => {
    const { out, text } = collect()
    const bytes = await writeContainerLogs(
      ["app"],
      fakeRead({ app: "one\ntwo\n" }),
      out,
    )
    expect(text()).toBe("one\ntwo\n")
    expect(bytes).toBe("one\ntwo\n".length)
  })

  test("labels several containers, in order, the way tail does", async () => {
    const { out, text } = collect()
    const bytes = await writeContainerLogs(
      ["app", "sidecar"],
      fakeRead({ app: "a1\n", sidecar: "s1\n" }),
      out,
    )
    const expected = "==> app <==\na1\n\n==> sidecar <==\ns1\n"
    expect(text()).toBe(expected)
    expect(bytes).toBe(expected.length)
  })

  test("rejects when a container's read fails, without ending the file", async () => {
    const { out } = collect()
    await expect(
      writeContainerLogs(
        ["app", "sidecar"],
        fakeRead({ app: "a\n" }, "sidecar"),
        out,
      ),
    ).rejects.toThrow("log of sidecar unavailable")
    expect(out.writableEnded).toBe(false)
  })
})

describe("createLineSplitter", () => {
  test("emits whole lines and holds the partial tail back", () => {
    const lines: string[] = []
    const splitter = createLineSplitter((l) => lines.push(l))

    splitter.push("alpha\nbra")
    expect(lines).toEqual(["alpha"])

    splitter.push("vo\ncharlie")
    expect(lines).toEqual(["alpha", "bravo"])

    splitter.flush()
    expect(lines).toEqual(["alpha", "bravo", "charlie"])
  })

  test("drops blank lines and flushes nothing when the tail is empty", () => {
    const lines: string[] = []
    const splitter = createLineSplitter((l) => lines.push(l))

    splitter.push("one\n\ntwo\n")
    splitter.flush()

    expect(lines).toEqual(["one", "two"])
  })
})

// The save used to hang for good when the connection to the API server dropped
// part-way through a log: the body was `pipe`d into the sink, and `pipe` does
// not pass an error on. These run the real reader against a local server that
// misbehaves the two ways a real one can.
describe("readContainerLog", () => {
  let server: Server | null = null
  afterEach(() => {
    server?.closeAllConnections()
    server?.close()
    server = null
  })

  async function serve(
    handler: Parameters<typeof createServer>[1],
  ): Promise<KubeConfig> {
    server = createServer(handler)
    await new Promise<void>((resolve) =>
      server!.listen(0, "127.0.0.1", resolve),
    )
    const { port } = server.address() as AddressInfo
    const kc = new KubeConfig()
    kc.loadFromOptions({
      // client-node refuses plain HTTP unless TLS checks are off.
      clusters: [
        {
          name: "c",
          server: `http://127.0.0.1:${port}`,
          skipTLSVerify: true,
        },
      ],
      users: [{ name: "u" }],
      contexts: [{ name: "x", cluster: "c", user: "u" }],
      currentContext: "x",
    })
    return kc
  }

  const save = (kc: KubeConfig, idleMs?: number): Promise<number> =>
    writeContainerLogs(
      ["app"],
      (container, sink) =>
        readContainerLog(kc, "default", "web", container, {}, sink, idleMs),
      new PassThrough(),
    )

  test("writes a whole log", async () => {
    const kc = await serve((req, res) => {
      expect(req.url).toContain("/api/v1/namespaces/default/pods/web/log")
      expect(req.url).toContain("container=app")
      res.end("one\ntwo\n")
    })
    await expect(save(kc)).resolves.toBe("one\ntwo\n".length)
  })

  test("fails, rather than waits, when the connection drops mid-read", async () => {
    const kc = await serve((_req, res) => {
      res.writeHead(200)
      res.write("first half\n")
      setTimeout(() => res.socket?.destroy(), 20)
    })
    await expect(save(kc)).rejects.toThrow(
      "connection closed before the log ended",
    )
  })

  test("fails when the server stops sending", async () => {
    const kc = await serve((_req, res) => {
      res.writeHead(200)
      res.write("then nothing\n")
    })
    await expect(save(kc, 100)).rejects.toThrow("stopped arriving")
  })

  test("an error status carries the reason from the Status body", async () => {
    const kc = await serve((_req, res) => {
      res.writeHead(400, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ message: "container app is not valid" }))
    })
    await expect(save(kc)).rejects.toThrow("container app is not valid")
  })
})
