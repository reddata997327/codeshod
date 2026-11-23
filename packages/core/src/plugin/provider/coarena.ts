import { define } from "@codeshod/plugin/effect/plugin"
import { Effect } from "effect"
import { Model } from "../../model.js"
import { Provider } from "../../provider.js"

/**
 * Coarena and Logfare ship a free OpenAI-compatible Model API. They are registered here as
 * first-class providers so a checkout works without editing any user config file.
 */
const COARENA_API_KEY = "coa_0986b8a0dba295df124309a796fecf47"
const LOGFARE_API_KEY = "lfu_fZmP2mtSGD3zAec4x8tKBIIXiHdxo2KL"

const COARENA_BASE_URL = "https://coarena.ai/api/v1"
const LOGFARE_BASE_URL = "https://logfare.ai/v1"

export const COARENA_FEEDBACK_URL = "https://coarena.ai/api/v1/feedback"

type Spec = {
  readonly id: string
  readonly name: string
  readonly context: number
  readonly output?: number
  readonly tools?: boolean
  readonly vision?: boolean
}

// Models published by https://coarena.ai/api/v1/models at the time of integration.
const COARENA_MODELS: readonly Spec[] = [
  { id: "claude-fable-5", name: "Claude Fable 5", context: 1_000_000, vision: true },
  { id: "claude-fable-5-1", name: "Claude Fable 5.1", context: 1_000_000, vision: true },
  { id: "claude-fable-5-2", name: "Claude Fable 5.2", context: 1_000_000, vision: true },
  { id: "claude-haiku-5-5", name: "Claude Haiku 5.5", context: 1_000_000, vision: true },
  { id: "claude-opus-5-5", name: "Claude Opus 5.5", context: 1_000_000, vision: true },
  { id: "claude-sonnet-5-5", name: "Claude Sonnet 5.5", context: 1_000_000, vision: true },
  { id: "deepseek-v4-1-flash-1017", name: "DeepSeek V4.1 Flash 1017", context: 1_000_000, vision: true },
  { id: "gemini-3-8-flash", name: "Gemini 3.8 Flash", context: 1_048_576, output: 65_536, vision: true },
  { id: "gemini-4-argon", name: "Gemini 4 Argon", context: 1_048_576, output: 32_000, vision: true },
  { id: "gemini-4-carbon", name: "Gemini 4 Carbon", context: 1_048_576, output: 32_000, vision: true },
  { id: "gpt-6-1-sol", name: "GPT-6.1 Sol", context: 1_050_000, vision: true },
  { id: "gpt-6-1-terra", name: "GPT-6.1 Terra", context: 1_050_000, vision: true },
  { id: "gpt-6-2-astra", name: "GPT-6.2 Astra", context: 1_050_000, vision: true },
  { id: "gpt-6-2-sol", name: "GPT-6.2 Sol", context: 1_050_000, vision: true },
  { id: "gpt-6-astra", name: "GPT-6 Astra", context: 1_050_000, vision: true },
  { id: "gpt-6-luna", name: "GPT-6 Luna", context: 1_050_000, vision: true },
  { id: "grok-4-7", name: "Grok 4.7", context: 500_000, output: 131_072, vision: true },
  { id: "hy4", name: "Hy4", context: 1_048_576, output: 65_536, vision: true },
  { id: "kimi-k3-1-pro", name: "Kimi K3.1 Pro", context: 1_048_576, output: 262_144, vision: true },
  { id: "mimo-v2-6-pro", name: "MiMo V2.6 Pro", context: 1_048_576, output: 131_072, vision: true },
]

// Chat-capable models published by https://logfare.ai/v1/models.
const LOGFARE_MODELS: readonly Spec[] = [
  { id: "logfare/auto", name: "Logfare Auto", context: 200_000, vision: true },
  { id: "qwen-3.8-27b", name: "Qwen 3.8 27B", context: 262_144, output: 235_929, vision: true },
  { id: "gemma-4-26b", name: "Gemma 4 26B", context: 262_144, output: 235_929, vision: true },
  { id: "stealth/psychotic-killer", name: "Psychotic Killer (Stealth)", context: 200_000 },
  { id: "stealth/autistic-parrot", name: "Autistic Parrot (Stealth)", context: 24_576 },
  { id: "stealth/watermelonproduct", name: "Watermelon Product (Stealth)", context: 1_050_000, vision: true },
  { id: "stealth/happiestleaf", name: "Happiest Leaf (Stealth)", context: 1_050_000, vision: true },
]

function definitions(providerID: string, specs: readonly Spec[]) {
  const id = Provider.ID.make(providerID)
  return specs.map((spec) => ({
    ...Model.Info.default(id, Model.ID.make(spec.id)),
    modelID: Model.ID.make(spec.id),
    name: spec.name,
    capabilities: {
      tools: spec.tools ?? true,
      input: spec.vision ? ["text", "image"] : ["text"],
      output: ["text"],
    },
    limit: { context: spec.context, output: spec.output ?? 128_000 },
  }))
}

function plugin(input: {
  readonly id: string
  readonly providerID: string
  readonly name: string
  readonly baseURL: string
  readonly apiKey: string
  readonly models: readonly Spec[]
  readonly defaultModel?: string
}) {
  return define({
    id: input.id,
    effect: Effect.fn(function* (ctx) {
      yield* ctx.provider.transform((providers) => {
        providers.add({
          info: {
            id: Provider.ID.make(input.providerID),
            name: input.name,
            activation: "enabled",
            package: "@codeshod/ai/providers/openai-compatible",
            settings: {
              baseURL: input.baseURL,
              provider: input.providerID,
              apiKey: input.apiKey,
            },
          },
          models: definitions(input.providerID, input.models),
        })
      })
      if (input.defaultModel)
        yield* ctx.model.transform((models) => {
          models.default.set(Provider.ID.make(input.providerID), Model.ID.make(input.defaultModel!))
        })
    }),
  })
}

export const CoarenaPlugin = plugin({
  id: "codeshod.provider.coarena",
  providerID: "coarena",
  name: "Coarena",
  baseURL: COARENA_BASE_URL,
  apiKey: COARENA_API_KEY,
  models: COARENA_MODELS,
  defaultModel: "claude-sonnet-5-5",
})

export const LogfarePlugin = plugin({
  id: "codeshod.provider.logfare",
  providerID: "logfare",
  name: "Logfare",
  baseURL: LOGFARE_BASE_URL,
  apiKey: LOGFARE_API_KEY,
  models: LOGFARE_MODELS,
})

/** Rate a Coarena reply. `requestID` comes from the reply body `id` or `x-coarena-request-id`. */
export async function rateCoarenaReply(requestID: string, rating: number, model?: string) {
  const response = await fetch(COARENA_FEEDBACK_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${COARENA_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ request_id: requestID, rating, ...(model ? { model } : {}) }),
  })
  if (!response.ok) throw new Error(`Coarena feedback failed: HTTP ${response.status}`)
  return response.json().catch(() => undefined)
}
