import { describe, expect, test } from "vitest"
import { AdmissionregistrationV1Api } from "@kubernetes/client-node"

import {
  getMutatingWebhookConfiguration,
  getValidatingWebhookConfiguration,
  listMutatingWebhookConfigurations,
  listValidatingWebhookConfigurations,
} from "../handlers/governance"

// The interesting part of these two handlers is the mapping: what an unset
// field is reported as (the API server's own defaults, not a blank), what the
// row summarises, and what survives for an Edit to write back. A kind cluster
// has no admission webhooks installed, so stubs are what can check it.

function stub(
  validating: unknown[],
  mutating: unknown[] = [],
): AdmissionregistrationV1Api {
  return {
    listValidatingWebhookConfiguration: () =>
      Promise.resolve({ items: validating }),
    listMutatingWebhookConfiguration: () =>
      Promise.resolve({ items: mutating }),
    readValidatingWebhookConfiguration: ({ name }: { name: string }) =>
      Promise.resolve(
        validating.find(
          (c) =>
            (c as { metadata?: { name?: string } }).metadata?.name === name,
        ),
      ),
    readMutatingWebhookConfiguration: ({ name }: { name: string }) =>
      Promise.resolve(
        mutating.find(
          (c) =>
            (c as { metadata?: { name?: string } }).metadata?.name === name,
        ),
      ),
  } as unknown as AdmissionregistrationV1Api
}

const CREATED = new Date("2026-01-02T03:04:05Z")

/** A webhook leaving every optional field unset, which is the shape a chart
 *  written against the API defaults produces. */
const MINIMAL_VALIDATING = {
  metadata: { name: "minimal", creationTimestamp: CREATED },
  webhooks: [
    {
      name: "check.example.com",
      clientConfig: {
        service: { namespace: "webhooks", name: "checker" },
      },
      sideEffects: "None",
      admissionReviewVersions: ["v1"],
      rules: [
        {
          apiGroups: [""],
          apiVersions: ["v1"],
          operations: ["CREATE"],
          resources: ["pods"],
        },
      ],
    },
  ],
}

const FULL_VALIDATING = {
  metadata: {
    name: "full",
    creationTimestamp: CREATED,
    labels: { app: "gatekeeper" },
    annotations: { "cert-manager.io/inject-ca-from": "webhooks/serving-cert" },
  },
  webhooks: [
    {
      name: "a.example.com",
      clientConfig: {
        url: "https://admission.example.com/validate",
        caBundle: "LS0tLS1CRUdJTg==",
      },
      failurePolicy: "Ignore",
      matchPolicy: "Exact",
      sideEffects: "NoneOnDryRun",
      timeoutSeconds: 5,
      admissionReviewVersions: ["v1", "v1beta1"],
      namespaceSelector: {
        matchExpressions: [
          {
            key: "kubernetes.io/metadata.name",
            operator: "NotIn",
            values: ["kube-system"],
          },
        ],
      },
      objectSelector: {},
      matchConditions: [
        { name: "not-a-daemon", expression: "object.spec.foo != 'bar'" },
      ],
      rules: [
        {
          apiGroups: ["apps"],
          apiVersions: ["v1"],
          operations: ["CREATE", "UPDATE"],
          resources: ["deployments"],
          scope: "Namespaced",
        },
      ],
    },
    {
      name: "b.example.com",
      clientConfig: { service: { namespace: "webhooks", name: "checker" } },
      sideEffects: "None",
      admissionReviewVersions: ["v1"],
      rules: [
        {
          apiGroups: [""],
          apiVersions: ["v1"],
          operations: ["*"],
          resources: ["pods"],
        },
      ],
    },
  ],
}

const MUTATING = {
  metadata: { name: "sidecar-injector", creationTimestamp: CREATED },
  webhooks: [
    {
      name: "inject.example.com",
      clientConfig: {
        service: {
          namespace: "mesh",
          name: "injector",
          path: "/inject",
          port: 443,
        },
      },
      sideEffects: "None",
      admissionReviewVersions: ["v1"],
      rules: [
        {
          apiGroups: [""],
          apiVersions: ["v1"],
          operations: ["CREATE"],
          resources: ["pods"],
        },
      ],
    },
  ],
}

describe("webhook configuration mapping", () => {
  test("unset fields report the API server's defaults", async () => {
    const [webhook] = (
      await getValidatingWebhookConfiguration(
        stub([MINIMAL_VALIDATING]),
        "minimal",
      )
    ).webhooks

    expect(webhook.failurePolicy).toBe("Fail")
    expect(webhook.matchPolicy).toBe("Equivalent")
    expect(webhook.timeoutSeconds).toBe(10)
    expect(webhook.rules[0].scope).toBe("*")
    // A validating webhook is never reinvoked, so the field is absent rather
    // than defaulted to a mutating webhook's "Never".
    expect(webhook.reinvocationPolicy).toBeNull()
    // Unset selectors stay null: null and an empty object both match
    // everything, but only the empty one must be written back by an Edit.
    expect(webhook.namespaceSelector).toBeNull()
    expect(webhook.objectSelector).toBeNull()
  })

  test("an empty selector is kept apart from an absent one", async () => {
    const [webhook] = (
      await getValidatingWebhookConfiguration(stub([FULL_VALIDATING]), "full")
    ).webhooks

    expect(webhook.objectSelector).toEqual({
      matchLabels: {},
      matchExpressions: [],
    })
    expect(webhook.namespaceSelector?.matchExpressions).toEqual([
      {
        key: "kubernetes.io/metadata.name",
        operator: "NotIn",
        values: ["kube-system"],
      },
    ])
  })

  test("the detail carries what an Edit has to write back", async () => {
    const config = await getValidatingWebhookConfiguration(
      stub([FULL_VALIDATING]),
      "full",
    )

    expect(config.type).toBe("Validating")
    expect(config.labels).toEqual({ app: "gatekeeper" })
    expect(config.annotations["cert-manager.io/inject-ca-from"]).toBe(
      "webhooks/serving-cert",
    )
    // Dropping the CA bundle on a Save leaves the API server unable to verify
    // the webhook's certificate, so it has to survive the round trip.
    expect(config.webhooks[0].clientConfig.caBundle).toBe("LS0tLS1CRUdJTg==")
    expect(config.webhooks[0].clientConfig.url).toBe(
      "https://admission.example.com/validate",
    )
    expect(config.webhooks[0].clientConfig.serviceName).toBeNull()
    expect(config.webhooks[0].matchConditions).toEqual([
      { name: "not-a-daemon", expression: "object.spec.foo != 'bar'" },
    ])
  })

  test("a row summarises policies, resources and endpoints", async () => {
    const [row] = await listValidatingWebhookConfigurations(
      stub([FULL_VALIDATING]),
    )

    expect(row).toEqual({
      name: "full",
      type: "Validating",
      webhookCount: 2,
      failurePolicies: ["Ignore", "Fail"],
      resources: ["apps/deployments", "core/pods"],
      endpoints: ["https://admission.example.com/validate", "webhooks/checker"],
      creationTimestamp: CREATED.toISOString(),
    })
    // The rules, selectors and CA bundles stay behind in the detail read.
    expect(row).not.toHaveProperty("webhooks")
  })

  test("a mutating webhook reports its reinvocation policy and service path", async () => {
    const config = await getMutatingWebhookConfiguration(
      stub([], [MUTATING]),
      "sidecar-injector",
    )
    const [row] = await listMutatingWebhookConfigurations(stub([], [MUTATING]))

    expect(config.type).toBe("Mutating")
    expect(config.webhooks[0].reinvocationPolicy).toBe("Never")
    expect(config.webhooks[0].clientConfig.servicePath).toBe("/inject")
    expect(config.webhooks[0].clientConfig.servicePort).toBe(443)
    expect(row.type).toBe("Mutating")
    expect(row.endpoints).toEqual(["mesh/injector"])
  })

  test("a configuration with no webhooks maps to empty columns", async () => {
    const [row] = await listValidatingWebhookConfigurations(
      stub([{ metadata: { name: "empty", creationTimestamp: CREATED } }]),
    )

    expect(row.webhookCount).toBe(0)
    expect(row.failurePolicies).toEqual([])
    expect(row.resources).toEqual([])
    expect(row.endpoints).toEqual([])
  })
})
