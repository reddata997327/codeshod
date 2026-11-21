export * as Provider from "./provider.js"

import { Context, Effect, Layer, Option, Schema, Stream, Struct } from "effect"
import { Provider } from "@codeshod/schema/provider"
import { Model } from "@codeshod/schema/model"
import { makeLocationNode } from "@codeshod/util/effect/app-node"
import { HttpTimeout, type ProviderPackage } from "@codeshod/ai/effect"
import { Npm } from "@codeshod/util/npm"
import type { DeepMutable } from "./schema.js"
import { importModule, resolveModule } from "@codeshod/util/runtime-import"
import { Bus } from "./bus.js"
import { Integration } from "./integration.js"
import { State } from "./state.js"
import { IntegrationConnection } from "./integration/connection.js"
import { Credential } from "@codeshod/schema/credential"
import { Location } from "./location.js"
import { freeze } from "immer"
import { AISDKNative } from "./aisdk-native.js"

export { AISDK_PREFIX, aisdk, isAISDK, mergeHeaders, mergeOverlay, packageName } from "./aisdk-native.js"

export const ID = Provider.ID
export type ID = typeof ID.Type

export class LoadError extends Schema.TaggedError<LoadError>()("Provider.LoadError", {
  package: Schema.String,
  cause: Schema.Defect(),
}) {}

const packages = new Map<string, Promise<unknown>>()
const builtins = new Map<string, () => Promise<unknown>>([
  ["@codeshod/ai/providers/alibaba", () => import("@codeshod/ai/providers/alibaba")],
  ["@codeshod/ai/providers/alibaba/chat", () => import("@codeshod/ai/providers/alibaba/chat")],
  ["@codeshod/ai/providers/alibaba/messages", () => import("@codeshod/ai/providers/alibaba/messages")],
  ["@codeshod/ai/providers/alibaba/responses", () => import("@codeshod/ai/providers/alibaba/responses")],
  ["@codeshod/ai/providers/alibaba/images", () => import("@codeshod/ai/providers/alibaba/images")],
  ["@codeshod/ai/providers/alibaba/embeddings", () => import("@codeshod/ai/providers/alibaba/embeddings")],
  ["@codeshod/ai/providers/amazon-bedrock", () => import("@codeshod/ai/providers/amazon-bedrock")],
  ["@codeshod/ai/providers/amazon-bedrock/mantle", () => import("@codeshod/ai/providers/amazon-bedrock/mantle")],
  [
    "@codeshod/ai/providers/amazon-bedrock/mantle/chat",
    () => import("@codeshod/ai/providers/amazon-bedrock/mantle/chat"),
  ],
  [
    "@codeshod/ai/providers/amazon-bedrock/mantle/messages",
    () => import("@codeshod/ai/providers/amazon-bedrock/mantle/messages"),
  ],
  [
    "@codeshod/ai/providers/amazon-bedrock/mantle/responses",
    () => import("@codeshod/ai/providers/amazon-bedrock/mantle/responses"),
  ],
  ["@codeshod/ai/providers/anthropic", () => import("@codeshod/ai/providers/anthropic")],
  ["@codeshod/ai/providers/anthropic-compatible", () => import("@codeshod/ai/providers/anthropic-compatible")],
  ["@codeshod/ai/providers/azure", () => import("@codeshod/ai/providers/azure")],
  ["@codeshod/ai/providers/azure/chat", () => import("@codeshod/ai/providers/azure/chat")],
  ["@codeshod/ai/providers/azure/responses", () => import("@codeshod/ai/providers/azure/responses")],
  ["@codeshod/ai/providers/azure/images", () => import("@codeshod/ai/providers/azure/images")],
  ["@codeshod/ai/providers/azure/embeddings", () => import("@codeshod/ai/providers/azure/embeddings")],
  ["@codeshod/ai/providers/azure/messages", () => import("@codeshod/ai/providers/azure/messages")],
  ["@codeshod/ai/providers/baseten", () => import("@codeshod/ai/providers/baseten")],
  ["@codeshod/ai/providers/baseten/decisions", () => import("@codeshod/ai/providers/baseten/decisions")],
  ["@codeshod/ai/providers/byteplus/videos", () => import("@codeshod/ai/providers/byteplus/videos")],
  ["@codeshod/ai/providers/cerebras", () => import("@codeshod/ai/providers/cerebras")],
  ["@codeshod/ai/providers/cloudflare-ai-gateway", () => import("@codeshod/ai/providers/cloudflare-ai-gateway")],
  [
    "@codeshod/ai/providers/cloudflare-ai-gateway/decisions",
    () => import("@codeshod/ai/providers/cloudflare-ai-gateway/decisions"),
  ],
  ["@codeshod/ai/providers/cloudflare-workers-ai", () => import("@codeshod/ai/providers/cloudflare-workers-ai")],
  [
    "@codeshod/ai/providers/cloudflare-workers-ai/decisions",
    () => import("@codeshod/ai/providers/cloudflare-workers-ai/decisions"),
  ],
  [
    "@codeshod/ai/providers/cloudflare-workers-ai/images",
    () => import("@codeshod/ai/providers/cloudflare-workers-ai/images"),
  ],
  ["@codeshod/ai/providers/cohere", () => import("@codeshod/ai/providers/cohere")],
  ["@codeshod/ai/providers/cohere/chat", () => import("@codeshod/ai/providers/cohere/chat")],
  ["@codeshod/ai/providers/cohere/embeddings", () => import("@codeshod/ai/providers/cohere/embeddings")],
  ["@codeshod/ai/providers/deepinfra", () => import("@codeshod/ai/providers/deepinfra")],
  ["@codeshod/ai/providers/deepinfra/embeddings", () => import("@codeshod/ai/providers/deepinfra/embeddings")],
  ["@codeshod/ai/providers/deepseek", () => import("@codeshod/ai/providers/deepseek")],
  ["@codeshod/ai/providers/digitalocean", () => import("@codeshod/ai/providers/digitalocean")],
  ["@codeshod/ai/providers/digitalocean/decisions", () => import("@codeshod/ai/providers/digitalocean/decisions")],
  ["@codeshod/ai/providers/digitalocean/embeddings", () => import("@codeshod/ai/providers/digitalocean/embeddings")],
  ["@codeshod/ai/providers/digitalocean/images", () => import("@codeshod/ai/providers/digitalocean/images")],
  ["@codeshod/ai/providers/digitalocean/responses", () => import("@codeshod/ai/providers/digitalocean/responses")],
  ["@codeshod/ai/providers/fireworks", () => import("@codeshod/ai/providers/fireworks")],
  ["@codeshod/ai/providers/fireworks/embeddings", () => import("@codeshod/ai/providers/fireworks/embeddings")],
  ["@codeshod/ai/providers/google", () => import("@codeshod/ai/providers/google")],
  ["@codeshod/ai/providers/google/decisions", () => import("@codeshod/ai/providers/google/decisions")],
  ["@codeshod/ai/providers/google/interactions", () => import("@codeshod/ai/providers/google/interactions")],
  ["@codeshod/ai/providers/google/embeddings", () => import("@codeshod/ai/providers/google/embeddings")],
  ["@codeshod/ai/providers/google/images", () => import("@codeshod/ai/providers/google/images")],
  ["@codeshod/ai/providers/google/videos", () => import("@codeshod/ai/providers/google/videos")],
  ["@codeshod/ai/providers/google-vertex", () => import("@codeshod/ai/providers/google-vertex")],
  ["@codeshod/ai/providers/google-vertex/chat", () => import("@codeshod/ai/providers/google-vertex/chat")],
  ["@codeshod/ai/providers/google-vertex/gemini", () => import("@codeshod/ai/providers/google-vertex/gemini")],
  [
    "@codeshod/ai/providers/google-vertex/interactions",
    () => import("@codeshod/ai/providers/google-vertex/interactions"),
  ],
  ["@codeshod/ai/providers/google-vertex/messages", () => import("@codeshod/ai/providers/google-vertex/messages")],
  ["@codeshod/ai/providers/google-vertex/mistral", () => import("@codeshod/ai/providers/google-vertex/mistral")],
  ["@codeshod/ai/providers/google-vertex/responses", () => import("@codeshod/ai/providers/google-vertex/responses")],
  ["@codeshod/ai/providers/google-vertex/embeddings", () => import("@codeshod/ai/providers/google-vertex/embeddings")],
  ["@codeshod/ai/providers/google-vertex/images", () => import("@codeshod/ai/providers/google-vertex/images")],
  ["@codeshod/ai/providers/google-vertex-messages", () => import("@codeshod/ai/providers/google-vertex-messages")],
  ["@codeshod/ai/providers/groq", () => import("@codeshod/ai/providers/groq")],
  ["@codeshod/ai/providers/meta", () => import("@codeshod/ai/providers/meta")],
  ["@codeshod/ai/providers/meta/chat", () => import("@codeshod/ai/providers/meta/chat")],
  ["@codeshod/ai/providers/meta/images", () => import("@codeshod/ai/providers/meta/images")],
  ["@codeshod/ai/providers/meta/messages", () => import("@codeshod/ai/providers/meta/messages")],
  ["@codeshod/ai/providers/meta/responses", () => import("@codeshod/ai/providers/meta/responses")],
  ["@codeshod/ai/providers/minimax", () => import("@codeshod/ai/providers/minimax")],
  ["@codeshod/ai/providers/minimax/chat", () => import("@codeshod/ai/providers/minimax/chat")],
  ["@codeshod/ai/providers/minimax/images", () => import("@codeshod/ai/providers/minimax/images")],
  ["@codeshod/ai/providers/minimax/messages", () => import("@codeshod/ai/providers/minimax/messages")],
  ["@codeshod/ai/providers/minimax/responses", () => import("@codeshod/ai/providers/minimax/responses")],
  ["@codeshod/ai/providers/minimax/videos", () => import("@codeshod/ai/providers/minimax/videos")],
  ["@codeshod/ai/providers/mistral", () => import("@codeshod/ai/providers/mistral")],
  ["@codeshod/ai/providers/moonshot", () => import("@codeshod/ai/providers/moonshot")],
  ["@codeshod/ai/providers/moonshot/chat", () => import("@codeshod/ai/providers/moonshot/chat")],
  ["@codeshod/ai/providers/moonshot/messages", () => import("@codeshod/ai/providers/moonshot/messages")],
  ["@codeshod/ai/providers/moonshot/responses", () => import("@codeshod/ai/providers/moonshot/responses")],
  ["@codeshod/ai/providers/openai", () => import("@codeshod/ai/providers/openai")],
  ["@codeshod/ai/providers/openai/chat", () => import("@codeshod/ai/providers/openai/chat")],
  ["@codeshod/ai/providers/openai/responses", () => import("@codeshod/ai/providers/openai/responses")],
  ["@codeshod/ai/providers/openai/images", () => import("@codeshod/ai/providers/openai/images")],
  ["@codeshod/ai/providers/openai/embeddings", () => import("@codeshod/ai/providers/openai/embeddings")],
  ["@codeshod/ai/providers/openai-compatible", () => import("@codeshod/ai/providers/openai-compatible")],
  [
    "@codeshod/ai/providers/openai-compatible/responses",
    () => import("@codeshod/ai/providers/openai-compatible/responses"),
  ],
  ["@codeshod/ai/providers/openai-compatible/images", () => import("@codeshod/ai/providers/openai-compatible/images")],
  [
    "@codeshod/ai/providers/openai-compatible/decisions",
    () => import("@codeshod/ai/providers/openai-compatible/decisions"),
  ],
  [
    "@codeshod/ai/providers/openai-compatible/embeddings",
    () => import("@codeshod/ai/providers/openai-compatible/embeddings"),
  ],
  [
    "@codeshod/ai/providers/openai-compatible-responses",
    () => import("@codeshod/ai/providers/openai-compatible-responses"),
  ],
  ["@codeshod/ai/providers/codeshod/decisions", () => import("@codeshod/ai/providers/codeshod/decisions")],
  ["@codeshod/ai/providers/openrouter", () => import("@codeshod/ai/providers/openrouter")],
  ["@codeshod/ai/providers/openrouter/decisions", () => import("@codeshod/ai/providers/openrouter/decisions")],
  ["@codeshod/ai/providers/openrouter/embeddings", () => import("@codeshod/ai/providers/openrouter/embeddings")],
  ["@codeshod/ai/providers/openrouter/images", () => import("@codeshod/ai/providers/openrouter/images")],
  ["@codeshod/ai/providers/openrouter/videos", () => import("@codeshod/ai/providers/openrouter/videos")],
  ["@codeshod/ai/providers/openrouter/responses", () => import("@codeshod/ai/providers/openrouter/responses")],
  ["@codeshod/ai/providers/togetherai", () => import("@codeshod/ai/providers/togetherai")],
  ["@codeshod/ai/providers/typesafe-ai/decisions", () => import("@codeshod/ai/providers/typesafe-ai/decisions")],
  ["@codeshod/ai/providers/venice", () => import("@codeshod/ai/providers/venice")],
  ["@codeshod/ai/providers/venice/responses", () => import("@codeshod/ai/providers/venice/responses")],
  ["@codeshod/ai/providers/volcengine/videos", () => import("@codeshod/ai/providers/volcengine/videos")],
  ["@codeshod/ai/providers/vercel-ai-gateway", () => import("@codeshod/ai/providers/vercel-ai-gateway")],
  ["@codeshod/ai/providers/vercel-ai-gateway/chat", () => import("@codeshod/ai/providers/vercel-ai-gateway/chat")],
  [
    "@codeshod/ai/providers/vercel-ai-gateway/messages",
    () => import("@codeshod/ai/providers/vercel-ai-gateway/messages"),
  ],
  [
    "@codeshod/ai/providers/vercel-ai-gateway/responses",
    () => import("@codeshod/ai/providers/vercel-ai-gateway/responses"),
  ],
  [
    "@codeshod/ai/providers/vercel-ai-gateway/decisions",
    () => import("@codeshod/ai/providers/vercel-ai-gateway/decisions"),
  ],
  ["@codeshod/ai/providers/vercel-ai-gateway/images", () => import("@codeshod/ai/providers/vercel-ai-gateway/images")],
  [
    "@codeshod/ai/providers/vercel-ai-gateway/embeddings",
    () => import("@codeshod/ai/providers/vercel-ai-gateway/embeddings"),
  ],
  ["@codeshod/ai/providers/xai", () => import("@codeshod/ai/providers/xai")],
  ["@codeshod/ai/providers/xai/images", () => import("@codeshod/ai/providers/xai/images")],
  ["@codeshod/ai/providers/xai/videos", () => import("@codeshod/ai/providers/xai/videos")],
  ["@codeshod/ai/providers/zai", () => import("@codeshod/ai/providers/zai")],
  ["@codeshod/ai/providers/zai/chat", () => import("@codeshod/ai/providers/zai/chat")],
  ["@codeshod/ai/providers/zai/images", () => import("@codeshod/ai/providers/zai/images")],
  ["@codeshod/ai/providers/zai-coding-plan", () => import("@codeshod/ai/providers/zai-coding-plan")],
  ["@codeshod/ai/providers/zai-coding-plan/chat", () => import("@codeshod/ai/providers/zai-coding-plan/chat")],
  ["@codeshod/ai/providers/zai-coding-plan/messages", () => import("@codeshod/ai/providers/zai-coding-plan/messages")],
  [
    "@codeshod/ai/providers/zai-coding-plan/responses",
    () => import("@codeshod/ai/providers/zai-coding-plan/responses"),
  ],
])

/** Native `@codeshod/ai/providers/*` entrypoints bundled with Core and loadable by name from config. */
export const builtinPackages: ReadonlySet<string> = new Set(builtins.keys())

export const loadPackage = Effect.fn("Provider.loadPackage")(function* (input: string, npm?: Npm.Interface) {
  const specifier = AISDKNative.packageName(input)
  const builtin = builtins.get(specifier)
  if (builtin) return yield* importPackage(specifier, specifier, builtin)
  const resolved = yield* Effect.sync(() => {
    if (specifier.startsWith("file://") || specifier.startsWith("@codeshod/ai/")) return specifier
    try {
      return import.meta.resolve(specifier)
    } catch {
      return undefined
    }
  })
  if (resolved) return yield* importPackage(specifier, resolved)
  if (!npm) {
    return yield* new LoadError({
      package: specifier,
      cause: new Error(`Provider package ${specifier} is not installed`),
    })
  }
  const parts = specifier.split("/")
  const root = specifier.startsWith("@") ? parts.slice(0, 2).join("/") : (parts[0] ?? specifier)
  const installed = yield* npm.add(root).pipe(Effect.mapError((cause) => new LoadError({ package: specifier, cause })))
  const entrypoint = yield* Effect.try({
    try: () => resolveModule(specifier, installed.directory),
    catch: (cause) => new LoadError({ package: specifier, cause }),
  })
  return yield* importPackage(specifier, entrypoint)
})

const settingsKeys = Struct.keys(Provider.Settings.schema.fields)
const providerOnlyKeys = settingsKeys.filter((key) => !(key in Model.Settings.schema.fields))

/** The provider options: every settings key Codeshod doesn't read itself. */
export function nativeSettings(settings: Settings) {
  return Struct.omit(settings, settingsKeys)
}

/** Settings a model inherits from its provider. */
export function modelSettings(settings: Settings | undefined) {
  return settings && Struct.omit(settings, providerOnlyKeys)
}

const decodeTimeout = Schema.decodeUnknownOption(HttpTimeout)

/** Applied to `headerTimeout` when provider settings leave it unset or invalid. */
export const DEFAULT_TIMEOUT_MS = 300_000

/**
 * Applied to `chunkTimeout` when provider settings leave it unset or invalid. Some providers, such as DeepSeek, have
 * specifically asked clients to allow at least 15 minutes, because their models can stream nothing for minutes while
 * they reason.
 */
export const DEFAULT_CHUNK_TIMEOUT_MS = 900_000

/** One timeout setting without a default; invalid values are dropped. */
export function timeout(value: unknown) {
  return Option.getOrUndefined(decodeTimeout(value))
}

/** Request timeouts from provider settings, resolved for every route. `timeout` has no default. */
export function timeouts(settings: Readonly<Record<string, unknown>>) {
  return {
    timeout: timeout(settings.timeout),
    headerTimeout: timeout(settings.headerTimeout) ?? DEFAULT_TIMEOUT_MS,
    chunkTimeout: timeout(settings.chunkTimeout) ?? DEFAULT_CHUNK_TIMEOUT_MS,
  }
}

const decodeEncoding = Schema.decodeUnknownOption(Provider.Encoding)

/** Request body encoding from provider or model settings; invalid values are dropped. */
export function encoding(settings: Readonly<Record<string, unknown>>) {
  return Option.getOrUndefined(decodeEncoding(settings.encoding))
}

const decodeTls = Schema.decodeUnknownOption(Provider.Tls)

/** Client certificate from provider settings. An empty `cert` or `key`, such as a missing `{file:}`, leaves it unset. */
export function tls(settings: Readonly<Record<string, unknown>>) {
  const value = Option.getOrUndefined(decodeTls(settings.tls))
  return value?.cert && value.key ? value : undefined
}

export const Request = Provider.Request
export type Request = Provider.Request

export const Compaction = Provider.Compaction
export type Compaction = Provider.Compaction

export const Cache = Provider.Cache
export type Cache = Provider.Cache

export const Transport = Provider.Transport
export type Transport = Provider.Transport

export const Settings = Provider.Settings
export type Settings = Provider.Settings

export const Info = Provider.Info
export type Info = Provider.Info

export type MutableInfo = DeepMutable<Info>

export { Event } from "@codeshod/schema/provider"

/** Provider metadata owns its drafts; model definitions remain immutable inputs. */
export type Definition = {
  readonly provider: Info
  readonly models: ReadonlyMap<Model.ID, Model.Info>
  readonly sourceConnection?: IntegrationConnection.Info
}

export interface Editor {
  readonly list: () => readonly Definition[]
  readonly get: (providerID: ID) => Definition | undefined
  readonly add: (definition: {
    readonly info: Info
    readonly models: readonly Model.Info[]
    readonly sourceConnection?: IntegrationConnection.Info
  }) => void
  readonly update: (providerID: ID, update: (provider: MutableInfo) => void) => void
  readonly remove: (providerID: ID) => void
  readonly models: {
    readonly set: (providerID: ID, models: readonly Model.Info[]) => void
    readonly update: (providerID: ID, modelID: Model.ID, update: (model: DeepMutable<Model.Info>) => void) => void
    readonly remove: (providerID: ID, modelID: Model.ID) => void
  }
}

export interface Snapshot {
  readonly records: ReadonlyMap<ID, Definition>
  readonly available: readonly Definition[]
  readonly providers: readonly Info[]
}

export interface Interface extends State.Transformable<Editor> {
  readonly get: (providerID: ID) => Effect.Effect<Info | undefined>
  readonly all: () => Effect.Effect<readonly Info[]>
  readonly available: () => Effect.Effect<readonly Info[]>
  /** Internal definition/access snapshot; raw model inventories never cross the HTTP API. */
  readonly snapshot: () => Effect.Effect<Snapshot>
}

export class Service extends Context.Service<Service, Interface>()("@codeshod/Provider") {}

// Every location references the same index for a shared immutable definition array.
const definitions = new WeakMap<readonly Model.Info[], Map<ID, ReadonlyMap<Model.ID, Model.Info>>>()
function index(providerID: ID, models: readonly Model.Info[]) {
  const indexes = definitions.get(models) ?? new Map<ID, ReadonlyMap<Model.ID, Model.Info>>()
  const cached = indexes.get(providerID)
  if (cached) return cached
  // Model shares these definitions without copying, so a foreign definition takes this provider's identity here.
  const result = freeze(
    new Map(models.map((model) => [model.id, model.providerID === providerID ? model : { ...model, providerID }])),
    true,
  )
  indexes.set(providerID, result)
  definitions.set(models, indexes)
  return result
}

const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const bus = yield* Bus.Service
    const integrations = yield* Integration.Service
    const location = yield* Location.Service
    const state = State.create<
      Map<
        ID,
        {
          provider: MutableInfo
          models: ReadonlyMap<Model.ID, Model.Info>
          sourceConnection?: IntegrationConnection.Info
        }
      >,
      Editor
    >({
      name: "provider",
      initial: () => new Map(),
      editor: (records) => {
        const maps = new WeakSet<ReadonlyMap<Model.ID, Model.Info>>()
        const models = new WeakSet<Model.Info>()
        const entry = (id: ID) => {
          const current = records.get(id)
          if (current) return current
          const added = { provider: Info.empty(id) as MutableInfo, models: new Map<Model.ID, Model.Info>() }
          records.set(id, added)
          maps.add(added.models)
          return added
        }
        const writable = (id: ID) => {
          const record = entry(id)
          if (maps.has(record.models)) return record.models as Map<Model.ID, Model.Info>
          const owned = new Map(record.models)
          record.models = owned
          maps.add(owned)
          return owned
        }
        return {
          list: () => Array.from(records.values()),
          get: (id) => records.get(id),
          add: (definition) => {
            records.set(definition.info.id, {
              provider: structuredClone(definition.info) as MutableInfo,
              models: index(definition.info.id, definition.models),
              sourceConnection: definition.sourceConnection,
            })
          },
          update: (id, update) => {
            const record = entry(id)
            update(record.provider)
            record.provider.id = id
            AISDKNative.rewrite(record.provider, {
              builtins: builtinPackages,
              specifier: record.provider.package,
              providerID: id,
              canonical: record.provider.canonical,
            })
          },
          remove: (id) => {
            records.delete(id)
          },
          models: {
            set: (id, values) => {
              entry(id).models = index(id, values)
            },
            update: (providerID, modelID, update) => {
              const record = entry(providerID)
              const target = writable(providerID)
              const current = target.get(modelID)
              const model = // An earlier add/set can publish and freeze an owned model within this fold.
                (
                  current && models.has(current) && !Object.isFrozen(current)
                    ? current
                    : current
                      ? structuredClone(current)
                      : Model.Info.default(providerID, modelID)
                ) as DeepMutable<Model.Info>
              update(model)
              model.id = modelID
              model.providerID = providerID
              AISDKNative.rewrite(model, {
                builtins: builtinPackages,
                specifier: model.package ?? record.provider.package,
                providerID,
                canonical: model.canonical ?? record.provider.canonical,
                modelID: model.modelID ?? modelID,
              })
              models.add(model)
              target.set(modelID, model)
            },
            remove: (providerID, modelID) => {
              if (!records.has(providerID)) return
              writable(providerID).delete(modelID)
            },
          },
        }
      },
      notify: () => notify,
    })
    // Registrations may outlive a borrowed service layer; their later disposal must
    // not query dependencies that have already closed.
    yield* Effect.addFinalizer(() => State.shutdown(state.reload()))
    let cached: { records: Snapshot["records"]; value: Snapshot } | undefined
    const snapshot = Effect.fn("Provider.snapshot")(function* () {
      while (true) {
        const revision = integrations.revision()
        const records = state.get()
        // Connection presence decides availability; resolving OAuth tokens belongs to execution.
        const connections = yield* integrations.list()
        // Either fold can disable a plugin that also contributed to the other domain.
        if (revision !== integrations.revision() || records !== state.get()) continue
        const byID = new Map(connections.map((integration) => [integration.id, integration]))
        const available = Array.from(records.values()).filter((record) => {
          if (record.provider.activation === "disabled") return false
          const integration = byID.get(record.provider.integrationID ?? Integration.ID.make(record.provider.id))
          // Never combine the previous account's discovered endpoints/models with a new connection.
          if (
            record.sourceConnection &&
            IntegrationConnection.key(record.sourceConnection) !==
              IntegrationConnection.key(integration?.connections[0])
          )
            return false
          if (record.provider.activation === "enabled") return true
          if (integration?.connections.length) return true
          return record.provider.integrationID === undefined && !integration
        })
        // A credential change that leaves the same definitions available is not a catalog change.
        if (
          cached?.records === records &&
          cached.value.available.length === available.length &&
          cached.value.available.every((record, index) => record === available[index])
        )
          return cached.value
        const value = freeze({ records, available, providers: available.map((record) => record.provider) }, true)
        cached = { records, value }
        return value
      }
    })
    let published: Snapshot | undefined
    const notify: Effect.Effect<void> = Effect.gen(function* () {
      const value = yield* snapshot()
      if (value === published) return
      published = value
      yield* bus.publish(
        Provider.Event.Updated,
        {},
        {
          location: { directory: location.directory, workspaceID: location.workspaceID },
        },
      )
    })
    yield* bus.subscribe([Integration.Event.Updated, Credential.Event.Switched]).pipe(
      Stream.runForEach(() => notify),
      Effect.forkScoped({ startImmediately: true }),
    )
    return Service.of({
      transform: state.transform,
      reload: state.reload,
      get: Effect.fn("Provider.get")((id) => Effect.sync(() => freeze(state.get().get(id)?.provider, true))),
      all: Effect.fn("Provider.all")(() =>
        Effect.sync(() => Array.from(state.get().values(), (record) => freeze(record.provider, true))),
      ),
      available: Effect.fn("Provider.available")(() => snapshot().pipe(Effect.map((value) => value.providers))),
      snapshot,
    })
  }),
)

export const node = makeLocationNode({ service: Service, layer, deps: [Bus.node, Integration.node, Location.node] })

const importPackage = Effect.fn("Provider.importPackage")(function* (
  specifier: string,
  entrypoint: string,
  load = () => importModule(entrypoint),
) {
  const module = yield* Effect.tryPromise({
    try: () => {
      const existing = packages.get(entrypoint)
      if (existing) return existing
      const loaded = load()
      packages.set(entrypoint, loaded)
      return loaded
    },
    catch: (cause) => new LoadError({ package: specifier, cause }),
  })
  if (typeof module !== "object" || module === null || typeof (module as { model?: unknown }).model !== "function") {
    return yield* new LoadError({
      package: specifier,
      cause: new Error(`Provider package ${specifier} does not export model(modelID, settings)`),
    })
  }
  return module as ProviderPackage.Definition
})
