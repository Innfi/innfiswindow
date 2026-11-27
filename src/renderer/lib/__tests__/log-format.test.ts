import { describe, expect, it } from "vitest"

import { parseLogLine } from "../log-format"

describe("parseLogLine", () => {
  it("splits kubectl timestamp, app timestamp, level and message", () => {
    expect(
      parseLogLine(
        "2026-11-27T10:00:00.123456789Z 2026-11-27 10:00:00,123 ERROR boom",
      ),
    ).toEqual([
      { kind: "timestamp", text: "2026-11-27T10:00:00.123456789Z " },
      { kind: "timestamp", text: "2026-11-27 10:00:00,123" },
      { kind: "message", text: " " },
      { kind: "level", text: "ERROR", level: "error" },
      { kind: "message", text: " boom" },
    ])
  })

  it("reads klog headers", () => {
    expect(parseLogLine("W1127 10:00:00.123456 1 main.go:1] careful")).toEqual([
      { kind: "level", text: "W", level: "warn" },
      { kind: "timestamp", text: "1127 10:00:00.123456" },
      { kind: "message", text: " 1 main.go:1] careful" },
    ])
  })

  it("colors only the value of keyed levels", () => {
    expect(parseLogLine('{"level":"info","msg":"hi"}')).toEqual([
      { kind: "message", text: '{"level":"' },
      { kind: "level", text: "info", level: "info" },
      { kind: "message", text: '","msg":"hi"}' },
    ])
    expect(parseLogLine("time=x level=warn msg=y")[1]).toEqual({
      kind: "level",
      text: "warn",
      level: "warn",
    })
  })

  it("accepts any-case bracketed levels but not lower-case prose", () => {
    expect(parseLogLine("[debug] x")[1]).toMatchObject({ level: "debug" })
    expect(parseLogLine("some info about error")).toEqual([
      { kind: "message", text: "some info about error" },
    ])
  })
})
