import { describe, expect, test } from "vitest"

import {
  hasLabelEquality,
  parseLabelSelector,
  toggleLabelEquality,
} from "../../shared/label-selector"

// The app bar's `-l` box sends its selector to the API server with every list,
// so a mis-parse is either a 400 on every poll tick or, worse, a filter that
// quietly means something other than what was typed. The grammar is kubectl's,
// and these are the shapes a session actually types.
describe("parseLabelSelector", () => {
  test("an empty input is no filter", () => {
    expect(parseLabelSelector("")).toEqual({
      selector: "",
      requirements: [],
      error: null,
    })
    expect(parseLabelSelector("   ").selector).toBe("")
  })

  test("equality, in both spellings", () => {
    expect(parseLabelSelector("app=nginx").selector).toBe("app=nginx")
    expect(parseLabelSelector("app==nginx").selector).toBe("app=nginx")
    expect(parseLabelSelector("app!=nginx").selector).toBe("app!=nginx")
  })

  test("an empty value matches a label set to the empty string", () => {
    const { selector, requirements, error } = parseLabelSelector("app=")
    expect(error).toBeNull()
    expect(selector).toBe("app=")
    expect(requirements[0]).toEqual({ key: "app", operator: "=", values: [] })
  })

  test("set membership, with the commas inside the parentheses kept", () => {
    expect(parseLabelSelector("tier in (web, cache)").selector).toBe(
      "tier in (web,cache)",
    )
    expect(parseLabelSelector("tier notin (batch)").selector).toBe(
      "tier notin (batch)",
    )
  })

  test("existence and non-existence", () => {
    expect(parseLabelSelector("canary").selector).toBe("canary")
    expect(parseLabelSelector("!canary").selector).toBe("!canary")
  })

  test("requirements are ANDed and re-rendered canonically", () => {
    expect(
      parseLabelSelector("  app = nginx ,  tier in (web , cache) , !canary ")
        .selector,
    ).toBe("app=nginx,tier in (web,cache),!canary")
  })

  test("a prefixed key is a key", () => {
    expect(
      parseLabelSelector("app.kubernetes.io/name=ingress-nginx").selector,
    ).toBe("app.kubernetes.io/name=ingress-nginx")
  })

  test("half-typed and malformed input is refused rather than sent", () => {
    expect(parseLabelSelector("app in (web").error).toBe(
      "Unbalanced parentheses.",
    )
    expect(parseLabelSelector("app in ()").error).not.toBeNull()
    expect(parseLabelSelector("app=nginx,").error).not.toBeNull()
    expect(parseLabelSelector("app nginx").error).not.toBeNull()
    expect(parseLabelSelector("=nginx").error).not.toBeNull()
    expect(parseLabelSelector("app=ngin x").error).not.toBeNull()
    // A refused selector carries no partial filter with it.
    expect(parseLabelSelector("app in (web").selector).toBe("")
  })

  test("the key and value rules are Kubernetes' own", () => {
    expect(parseLabelSelector(`app=${"n".repeat(64)}`).error).not.toBeNull()
    expect(parseLabelSelector("-app=nginx").error).not.toBeNull()
    expect(parseLabelSelector("a/b/c=nginx").error).not.toBeNull()
  })
})

// Clicking a label in a detail panel puts it in the same box, so the result has
// to be a selector the parser above would have accepted.
describe("toggleLabelEquality", () => {
  test("adds a label to an empty selector", () => {
    expect(toggleLabelEquality("", "app", "nginx")).toBe("app=nginx")
  })

  test("ANDs onto what is already there", () => {
    expect(toggleLabelEquality("tier=web", "app", "nginx")).toBe(
      "tier=web,app=nginx",
    )
  })

  test("a second click on the same label takes it out again", () => {
    expect(toggleLabelEquality("tier=web,app=nginx", "app", "nginx")).toBe(
      "tier=web",
    )
    expect(toggleLabelEquality("app=nginx", "app", "nginx")).toBe("")
  })

  test("replaces another requirement on the same key rather than ANDing", () => {
    // app=nginx,app=redis would match nothing; a click is meant to narrow.
    expect(toggleLabelEquality("app=redis", "app", "nginx")).toBe("app=nginx")
    expect(toggleLabelEquality("app in (redis,web)", "app", "nginx")).toBe(
      "app=nginx",
    )
    expect(toggleLabelEquality("!app", "app", "nginx")).toBe("app=nginx")
  })

  test("what it produces parses back to itself", () => {
    const selector = toggleLabelEquality("tier=web", "app", "nginx")
    expect(parseLabelSelector(selector).selector).toBe(selector)
    expect(parseLabelSelector(selector).error).toBeNull()
  })
})

describe("hasLabelEquality", () => {
  test("is true only for that exact key and value", () => {
    expect(hasLabelEquality("app=nginx,tier=web", "app", "nginx")).toBe(true)
    expect(hasLabelEquality("app=nginx", "app", "redis")).toBe(false)
    expect(hasLabelEquality("app!=nginx", "app", "nginx")).toBe(false)
    expect(hasLabelEquality("app in (nginx)", "app", "nginx")).toBe(false)
    expect(hasLabelEquality("", "app", "nginx")).toBe(false)
  })
})
