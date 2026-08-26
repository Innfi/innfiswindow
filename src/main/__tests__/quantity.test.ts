import { describe, expect, test } from "vitest"

import {
  formatMemory,
  formatMillicores,
  isPositiveQuantity,
  parseCpuToNanocores,
  parseMemoryToBytes,
  parseStorageQuantity,
} from "../../shared/quantity"

// Pure math, so unlike the rest of this directory these need no kind cluster.
// The units are the trap: metrics-server reports CPU in nanocores while
// `.status.allocatable` reports cores or millicores, and mixing them up is off
// by a factor of a million.
describe("parseCpuToNanocores", () => {
  test("reads metrics-server nanocores", () => {
    expect(parseCpuToNanocores("123456789n")).toBe(123456789)
  })

  test("reads microcores", () => {
    expect(parseCpuToNanocores("1500u")).toBe(1_500_000)
  })

  test("reads millicores", () => {
    expect(parseCpuToNanocores("250m")).toBe(250_000_000)
  })

  test("reads whole and fractional cores", () => {
    expect(parseCpuToNanocores("2")).toBe(2_000_000_000)
    expect(parseCpuToNanocores("0.5")).toBe(500_000_000)
  })

  test("treats empty and unparseable values as zero", () => {
    expect(parseCpuToNanocores("")).toBe(0)
    expect(parseCpuToNanocores("abc")).toBe(0)
  })
})

describe("parseMemoryToBytes", () => {
  test("reads binary suffixes", () => {
    expect(parseMemoryToBytes("512Ki")).toBe(524288)
    expect(parseMemoryToBytes("2Gi")).toBe(2 * 1024 ** 3)
  })

  test("reads decimal suffixes", () => {
    expect(parseMemoryToBytes("1M")).toBe(1_000_000)
    expect(parseMemoryToBytes("3k")).toBe(3000)
  })

  test("reads bare byte counts", () => {
    expect(parseMemoryToBytes("1048576")).toBe(1048576)
    expect(parseMemoryToBytes("")).toBe(0)
  })
})

// The PVC expand dialog and handler both compare sizes with this, so an
// unparseable value has to come back as null rather than 0: "0" would read as
// a legal shrink to nothing.
describe("parseStorageQuantity", () => {
  test("reads binary and decimal suffixes", () => {
    expect(parseStorageQuantity("20Gi")).toBe(20 * 1024 ** 3)
    expect(parseStorageQuantity("500M")).toBe(500e6)
    expect(parseStorageQuantity("1Ti")).toBe(1024 ** 4)
  })

  test("orders sizes by bytes, not by their text", () => {
    expect(parseStorageQuantity("9Gi")!).toBeLessThan(
      parseStorageQuantity("10Gi")!,
    )
  })

  test("reads bare and fractional quantities", () => {
    expect(parseStorageQuantity("1048576")).toBe(1048576)
    expect(parseStorageQuantity("1.5Gi")).toBe(1.5 * 1024 ** 3)
  })

  test("rejects anything that is not a quantity", () => {
    expect(parseStorageQuantity("")).toBeNull()
    expect(parseStorageQuantity("20 GB")).toBeNull()
    expect(parseStorageQuantity("-5Gi")).toBeNull()
    expect(parseStorageQuantity("Gi")).toBeNull()
  })

  test("is case sensitive about suffixes, as the API server is", () => {
    expect(parseStorageQuantity("20gi")).toBeNull()
    expect(parseStorageQuantity("20m")).toBeNull()
  })
})

describe("formatters", () => {
  test("millicores round to whole units", () => {
    expect(formatMillicores(123456789)).toBe("123m")
    expect(formatMillicores(0)).toBe("0m")
  })

  test("memory switches to Gi above a gibibyte", () => {
    expect(formatMemory(256 * 1024 ** 2)).toBe("256 Mi")
    expect(formatMemory(2.5 * 1024 ** 3)).toBe("2.5 Gi")
  })
})

describe("isPositiveQuantity", () => {
  test("takes the CPU and memory suffixes an HPA target uses", () => {
    expect(isPositiveQuantity("100m")).toBe(true)
    expect(isPositiveQuantity("1")).toBe(true)
    expect(isPositiveQuantity("500Mi")).toBe(true)
    expect(isPositiveQuantity("1.5")).toBe(true)
    expect(isPositiveQuantity("3e2")).toBe(true)
  })

  test("rejects zero, since a target the HPA divides by cannot be one", () => {
    expect(isPositiveQuantity("0")).toBe(false)
    expect(isPositiveQuantity("0Mi")).toBe(false)
  })

  test("rejects anything that is not a quantity", () => {
    expect(isPositiveQuantity("")).toBe(false)
    expect(isPositiveQuantity("70%")).toBe(false)
    expect(isPositiveQuantity("-1")).toBe(false)
    expect(isPositiveQuantity("500 Mi")).toBe(false)
  })
})
