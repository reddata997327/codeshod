import { describe, expect } from "bun:test"
import { Bus } from "@codeshod/core/bus"
import { Config } from "@codeshod/core/config"
import { ConfigWebSearchPlugin } from "@codeshod/core/config/plugin/websearch"
import { Plugin } from "@codeshod/core/plugin"
import { PluginHost } from "@codeshod/core/plugin/host"
import { WebSearch } from "@codeshod/core/websearch"
import { Document, Event, Info } from "@codeshod/schema/config"
import { ConfigWebSearch } from "@codeshod/schema/config/websearch"
import { Effect } from "effect"
import { waitUntil } from "../lib/eventually"
import { testEffect } from "../lib/effect"
import { PluginTestLayer } from "../plugin/fixture"

const it = testEffect(PluginTestLayer)

describe("ConfigWebSearchPlugin.Plugin", () => {
  it.live("reloads changed default selection", () =>
    Effect.gen(function* () {
      const websearch = yield* WebSearch.Service
      const bus = yield* Bus.Service
      const config = yield* Config.Test
      const plugins = yield* Plugin.Service
      yield* websearch.transform((editor) =>
        editor.add({ id: WebSearch.ID.make("test"), name: "Test", execute: () => Effect.succeed([]) }),
      )
      yield* ConfigWebSearchPlugin.Plugin.effect(yield* PluginHost.make(plugins, "test"))

      expect((yield* websearch.default().pipe(Effect.flip))._tag).toBe("WebSearch.Disabled")

      yield* config.setEntries([configured(new ConfigWebSearch.Info({ provider: "random" }))])
      yield* bus.publish(Event.Updated, {})
      yield* waitUntil(
        websearch.default().pipe(
          Effect.map((provider) => provider?.id === WebSearch.ID.make("test")),
          Effect.orElseSucceed(() => false),
        ),
      )
    }).pipe(Effect.provide(Config.testLayer([configured(false)]))),
  )
})

function configured(websearch: ConfigWebSearch.Selection): Document {
  return new Document({ type: "document", info: new Info({ websearch }) })
}
