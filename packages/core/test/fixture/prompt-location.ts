import type { FileSystem } from "@codeshod/core/filesystem"
import { Bus } from "@codeshod/core/bus"
import { Image } from "@codeshod/core/image"
import { LocationServiceMap } from "@codeshod/core/location-service-map"
import type { LocationServices } from "@codeshod/core/location-services"
import { Plugin } from "@codeshod/core/plugin"
import { PluginHooks } from "@codeshod/core/plugin/hooks"
import { Skill } from "@codeshod/core/skill"
import type { Location } from "@codeshod/schema/location"
import { makeGlobalNode } from "@codeshod/util/effect/app-node"
import { LayerNode } from "@codeshod/util/effect/layer-node"
import { Effect, Layer, LayerMap } from "effect"

// Plain-prompt unit fixtures use virtual directories.
export const promptLocationNode = makeGlobalNode({
  service: LocationServiceMap.Service,
  layer: Layer.effect(
    LocationServiceMap.Service,
    Effect.gen(function* () {
      const bus = yield* Bus.Service
      return yield* LayerMap.make(
        (_ref: Location.Ref) =>
          LayerNode.compile(LayerNode.group([PluginHooks.node, Image.node, Skill.node, Plugin.node]), {
            replacements: [
              Bus.node.replace(Layer.succeed(Bus.Service, bus)),
              Plugin.node.replace(Layer.mock(Plugin.Service, { awaitActivation: Effect.void })),
            ],
          }) as unknown as Layer.Layer<LocationServices, FileSystem.DirectoryNotFoundError>,
      )
    }),
  ),
  deps: [Bus.node],
})
