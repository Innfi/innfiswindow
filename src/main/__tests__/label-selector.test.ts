import { describe, expect, test } from "vitest"

import { parseLabelSelector } from "../../shared/label-selector"

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
