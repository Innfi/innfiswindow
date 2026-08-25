import { describe, expect, test } from "vitest"

import { buildEphemeralContainer } from "../handlers/workload"
import {
  copyFromPodCommand,
  copyToPodCommand,
  splitRemotePath,
} from "../ipc/pod-copy"

// The API server answers a bad ephemeral container with a 422 whose message
// does not say which existing container the name collided with, and a kind
// cluster would only show the patch succeeding. Both are checked here instead.
describe("buildEphemeralContainer", () => {
  const pod = { containers: ["app", "sidecar"], takenNames: ["app", "sidecar"] }
  const suffix = (): string => "ab12z"

  test("generates a name and holds stdin open so a shell survives", () => {
    expect(
      buildEphemeralContainer({ image: "busybox:1.36" }, pod, suffix),
    ).toEqual({
      name: "debugger-ab12z",
      image: "busybox:1.36",
      stdin: true,
      tty: true,
      terminationMessagePolicy: "File",
    })
  })

  test("keeps a given name, target and command", () => {
    expect(
      buildEphemeralContainer(
        {
          image: "nicolaka/netshoot:latest",
          name: "netshoot",
          targetContainer: "app",
          command: ["sleep", "  ", "3600"],
        },
        pod,
        suffix,
      ),
    ).toEqual({
      name: "netshoot",
      image: "nicolaka/netshoot:latest",
      stdin: true,
      tty: true,
      terminationMessagePolicy: "File",
      command: ["sleep", "3600"],
      targetContainerName: "app",
    })
  })

  test("rejects a name already on the pod — they cannot be replaced", () => {
    expect(() =>
      buildEphemeralContainer({ image: "busybox", name: "sidecar" }, pod),
    ).toThrow(/already has a container named "sidecar"/)
  })

  test("rejects a name that is not a DNS label", () => {
    expect(() =>
      buildEphemeralContainer({ image: "busybox", name: "Debug_1" }, pod),
    ).toThrow(/not a DNS label/)
  })

  test("rejects a target that is not one of the pod's containers", () => {
    expect(() =>
      buildEphemeralContainer(
        { image: "busybox", targetContainer: "nope" },
        pod,
      ),
    ).toThrow(/No container named "nope"/)
  })

  test("rejects a blank image", () => {
    expect(() => buildEphemeralContainer({ image: "  " }, pod)).toThrow(
      /needs an image/,
    )
  })
})

// A copy is a `tar` invocation inside the container, and getting `-C` wrong is
// the difference between `<dest>/app.log` and `<dest>/var/log/app.log`.
describe("pod copy commands", () => {
  test("splits a container path on POSIX rules, not the host's", () => {
    expect(splitRemotePath("/var/log/app.log")).toEqual({
      dir: "/var/log",
      base: "app.log",
    })
    expect(splitRemotePath("/etc/")).toEqual({ dir: "/", base: "etc" })
    expect(splitRemotePath("app.log")).toEqual({ dir: ".", base: "app.log" })
    expect(splitRemotePath("C:\\data")).toEqual({
      dir: ".",
      base: "C:\\data",
    })
  })

  test("refuses the container root, which has no parent to tar from", () => {
    expect(() => splitRemotePath("/")).toThrow(/not the root/)
    expect(() => splitRemotePath("   ")).toThrow(/not the root/)
  })

  test("tars the entry relative to its parent when reading out", () => {
    expect(copyFromPodCommand("/var/log/app.log")).toEqual([
      "tar",
      "cf",
      "-",
      "-C",
      "/var/log",
      "app.log",
    ])
  })

  test("extracts into the destination directory when writing in", () => {
    expect(copyToPodCommand("/tmp/")).toEqual(["tar", "xmf", "-", "-C", "/tmp"])
    expect(copyToPodCommand("/")).toEqual(["tar", "xmf", "-", "-C", "/"])
  })

  test("refuses a blank destination directory", () => {
    expect(() => copyToPodCommand("  ")).toThrow(/destination directory/)
  })
})
