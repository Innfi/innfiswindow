import { describe, expect, test } from "vitest"

import { evaluateJsonPath } from "../../shared/jsonpath"

// The generic custom-resource browser renders every non-name column by running
// a CRD's own `additionalPrinterColumns` JSONPath over each object. A path this
// evaluator gets wrong is a silently wrong cell, and a kind cluster test would
// need one operator installed per path shape — so the paths are checked here
// against the objects those operators actually produce.
describe("evaluateJsonPath", () => {
  const certificate = {
    apiVersion: "cert-manager.io/v1",
    kind: "Certificate",
    metadata: { name: "web-tls", namespace: "default", labels: { app: "web" } },
    spec: { secretName: "web-tls", dnsNames: ["a.example", "b.example"] },
    status: {
      conditions: [
        { type: "Issuing", status: "False" },
        { type: "Ready", status: "True", reason: "Ready" },
      ],
      revision: 3,
      renewalTime: "2026-09-01T00:00:00Z",
    },
  }

  test("reads a dotted path", () => {
    expect(evaluateJsonPath(certificate, ".spec.secretName")).toBe("web-tls")
  })

  test("accepts the leading $, the {} template form, and a bare path", () => {
    expect(evaluateJsonPath(certificate, "$.spec.secretName")).toBe("web-tls")
    expect(evaluateJsonPath(certificate, "{.spec.secretName}")).toBe("web-tls")
    expect(evaluateJsonPath(certificate, "spec.secretName")).toBe("web-tls")
  })

  test("stringifies numbers so a column can render them", () => {
    expect(evaluateJsonPath(certificate, ".status.revision")).toBe("3")
  })

  test("picks an array element by index, counting back from the end", () => {
    expect(evaluateJsonPath(certificate, ".spec.dnsNames[0]")).toBe("a.example")
    expect(evaluateJsonPath(certificate, ".spec.dnsNames[-1]")).toBe(
      "b.example",
    )
    expect(evaluateJsonPath(certificate, ".spec.dnsNames[9]")).toBeNull()
  })

  test("joins several matches with a comma, as kubectl prints them", () => {
    expect(evaluateJsonPath(certificate, ".spec.dnsNames[*]")).toBe(
      "a.example,b.example",
    )
  })

  test("resolves the condition filter cert-manager and Argo both use", () => {
    expect(
      evaluateJsonPath(
        certificate,
        '.status.conditions[?(@.type=="Ready")].status',
      ),
    ).toBe("True")
    expect(
      evaluateJsonPath(
        certificate,
        ".status.conditions[?(@.type=='Issuing')].status",
      ),
    ).toBe("False")
  })

  test("a filter that matches nothing yields null, not an empty string", () => {
    expect(
      evaluateJsonPath(
        certificate,
        '.status.conditions[?(@.type=="Degraded")].status',
      ),
    ).toBeNull()
  })

  test("compares an unquoted filter value as text", () => {
    const list = { items: [{ replicas: 3, name: "three" }] }
    expect(evaluateJsonPath(list, ".items[?(@.replicas==3)].name")).toBe(
      "three",
    )
  })

  test("reads a bracketed key, which is how dotted label keys are addressed", () => {
    const obj = { metadata: { labels: { "app.kubernetes.io/name": "web" } } }
    expect(
      evaluateJsonPath(obj, ".metadata.labels['app.kubernetes.io/name']"),
    ).toBe("web")
  })

  test("a missing path yields null rather than throwing", () => {
    expect(evaluateJsonPath(certificate, ".status.nope.deeper")).toBeNull()
    expect(evaluateJsonPath(certificate, ".spec.dnsNames.name")).toBeNull()
  })

  test("JSON-encodes an object or array a column points at", () => {
    expect(evaluateJsonPath(certificate, ".spec.dnsNames")).toBe(
      '["a.example","b.example"]',
    )
  })

  test("unsupported syntax yields null instead of a wrong value", () => {
    // Recursive descent and slices are real JSONPath, just not implemented —
    // a column using one renders as a dash.
    expect(evaluateJsonPath(certificate, "..conditions")).toBeNull()
    expect(evaluateJsonPath(certificate, ".spec.dnsNames[0:1]")).toBeNull()
    expect(evaluateJsonPath(certificate, ".spec.dnsNames[")).toBeNull()
  })

  test("an empty path resolves to the object itself", () => {
    expect(evaluateJsonPath({ a: 1 }, "")).toBe('{"a":1}')
  })
})
