import { describe, expect, test } from "bun:test"
import { catalogIdentity } from "./catalog-identity"

describe("stats catalog identity", () => {
  test("resolves Codeshod offerings to canonical labs", () => {
    const identity = catalogIdentity({
      models: { "meituan/longcat-2.5-preview": {} },
      providers: {
        codeshod: { models: { "longcat-2.5-preview-free": { canonical_model_id: "meituan/longcat-2.5-preview" } } },
        "codeshod-go": {
          models: { "longcat-2.5-preview-free": { canonical_model_id: "meituan/longcat-2.5-preview" } },
        },
      },
    })

    expect(identity.offerings.get("codeshod/longcat-2.5-preview-free")).toBe("meituan")
    expect(identity.offerings.get("codeshod-go/longcat-2.5-preview-free")).toBe("meituan")
    expect(identity.models.get("longcat-2.5-preview")).toBe("meituan")
  })

  test("does not guess a lab for a name shared by different canonical models", () => {
    const identity = catalogIdentity({
      models: { "lab-a/model": {}, "lab-b/model": {} },
      providers: {
        codeshod: { models: { "model-free": { canonical_model_id: "lab-a/model" } } },
        "codeshod-go": { models: { model: { canonical_model_id: "lab-b/model" } } },
      },
    })

    expect(identity.offerings.get("codeshod/model-free")).toBe("lab-a")
    expect(identity.offerings.get("codeshod-go/model")).toBe("lab-b")
    expect(identity.models.has("model")).toBe(false)
  })

  test("accepts provider IDs that are already canonical catalog IDs", () => {
    const identity = catalogIdentity({
      models: { "codeshod/direct-model": {} },
      providers: { codeshod: { models: { "direct-model": {} } } },
    })

    expect(identity.offerings.get("codeshod/direct-model")).toBe("codeshod")
    expect(identity.models.get("direct-model")).toBe("codeshod")
  })

  test("rejects a catalog without published canonical identities", () => {
    expect(() => catalogIdentity({ models: {}, providers: { codeshod: { models: { model: {} } } } })).toThrow(
      "Model catalog has no canonical Codeshod offerings",
    )
  })
})
