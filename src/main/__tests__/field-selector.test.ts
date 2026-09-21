import { describe, expect, test } from "vitest"

import {
  fieldSelectorFields,
  parseFieldSelector,
} from "../../shared/field-selector"

// Unlike a label selector, a field selector is only as good as the API
// server's index for that kind: a key it does not index is a 400 on every poll
// tick, so the parser refuses one here instead. These are the shapes a session
// types, and the ones it mistypes.
const POD_FIELDS = fieldSelectorFields("Pods")

describe("parseFieldSelector", () => {
  test("an empty input is no filter", () => {
    expect(parseFieldSelector("", POD_FIELDS)).toEqual({
      selector: "",
      requirements: [],
      error: null,
    })
    expect(parseFieldSelector("   ", POD_FIELDS).error).toBeNull()
  })

  test("equality, inequality, and several ANDed together", () => {
    expect(
      parseFieldSelector("status.phase=Running", POD_FIELDS),
    ).toMatchObject({
      selector: "status.phase=Running",
      requirements: [{ key: "status.phase", operator: "=", value: "Running" }],
    })
    expect(
      parseFieldSelector("spec.nodeName!=node-1", POD_FIELDS).requirements,
    ).toEqual([{ key: "spec.nodeName", operator: "!=", value: "node-1" }])
    expect(
      parseFieldSelector(
        "status.phase=Running,spec.nodeName!=node-1",
        POD_FIELDS,
      ).selector,
    ).toBe("status.phase=Running,spec.nodeName!=node-1")
  })

  test("`==` is the same operator as `=` and is normalised to it", () => {
    expect(
      parseFieldSelector("status.phase==Running", POD_FIELDS).selector,
    ).toBe("status.phase=Running")
  })

  test("whitespace alone is not a new filter", () => {
    expect(
      parseFieldSelector(
        "  status.phase = Running , status.podIP!=  ",
        POD_FIELDS,
      ).selector,
    ).toBe("status.phase=Running,status.podIP!=")
  })

  test("an empty value is a selector of its own — an unscheduled pod", () => {
    expect(parseFieldSelector("spec.nodeName=", POD_FIELDS)).toMatchObject({
      selector: "spec.nodeName=",
      error: null,
    })
  })

  test("a field the kind does not index is refused, and says what it has", () => {
    const { error, selector } = parseFieldSelector(
      "spec.hostNetwork=true",
      POD_FIELDS,
    )
    expect(error).toContain("cannot be filtered on spec.hostNetwork")
    expect(error).toContain("spec.nodeName")
    expect(selector).toBe("")
  })

  test("a field another kind indexes is still refused here", () => {
    // `type` is a Secret field; a Pod list filtered on it is a 400.
    expect(parseFieldSelector("type=Opaque", POD_FIELDS).error).not.toBeNull()
    expect(
      parseFieldSelector("type=Opaque", fieldSelectorFields("Secrets")).error,
    ).toBeNull()
  })

  test("malformed input is refused rather than sent", () => {
    expect(parseFieldSelector("status.phase", POD_FIELDS).error).toContain(
      "not a field requirement",
    )
    expect(parseFieldSelector("=Running", POD_FIELDS).error).toContain(
      "needs a field",
    )
    expect(
      parseFieldSelector("status.phase=Running,", POD_FIELDS).error,
    ).toContain("stray comma")
  })

  test("two equalities on one field match nothing, so they are refused", () => {
    expect(
      parseFieldSelector("status.phase=Running,status.phase=Failed", POD_FIELDS)
        .error,
    ).toContain("two values at once")
    // Two inequalities are a legitimate narrowing, unlike two equalities.
    expect(
      parseFieldSelector(
        "spec.nodeName!=node-1,spec.nodeName!=node-2",
        POD_FIELDS,
      ).error,
    ).toBeNull()
  })

  test("a kind that indexes nothing takes no selector at all", () => {
    expect(fieldSelectorFields("Deployments")).toEqual([])
    expect(fieldSelectorFields(null)).toEqual([])
    expect(
      parseFieldSelector(
        "metadata.name=web",
        fieldSelectorFields("Deployments"),
      ).error,
    ).toBe("This kind cannot be filtered by field.")
  })
})
