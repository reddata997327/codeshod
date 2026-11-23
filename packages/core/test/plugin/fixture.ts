import { Agent } from "@codeshod/core/agent"
import { App } from "@codeshod/core/app"
import { Artifact } from "@codeshod/core/artifact"
import { BlobStore } from "@codeshod/core/blob-store"
import { AISDK } from "@codeshod/core/aisdk"
import { Command } from "@codeshod/core/command"
import { Config } from "@codeshod/core/config"
import { Credential } from "@codeshod/core/credential"
import { Database } from "@codeshod/core/database/database"
import { Environment } from "@codeshod/core/environment/index"
import { FileAccess } from "@codeshod/core/file-access"
import { Flag } from "@codeshod/core/flag"
import { LayerNodePlatform } from "@codeshod/util/effect/app-node-platform"
import { AppProcess } from "@codeshod/util/process"
import { LayerNode } from "@codeshod/util/effect/layer-node"
import { Bus } from "@codeshod/core/bus"
import { FileSystem } from "@codeshod/core/filesystem"
import { FSUtil } from "@codeshod/util/fs-util"
import { Global } from "@codeshod/util/global"
import { Form } from "@codeshod/core/form"
import { Generate } from "@codeshod/core/generate"
import { InstructionDiscovery } from "@codeshod/core/instruction-discovery"
import { Integration } from "@codeshod/core/integration"
import { Job } from "@codeshod/core/job"
import { KV } from "@codeshod/core/kv"
import { Location } from "@codeshod/core/location"
import { Mcp } from "@codeshod/core/mcp/index"
import { Model } from "@codeshod/core/model"
import { Npm } from "@codeshod/util/npm"
import { Plugin } from "@codeshod/core/plugin"
import { PluginHooks } from "@codeshod/core/plugin/hooks"
import { Provider } from "@codeshod/core/provider"
import { Session } from "@codeshod/core/session"
import { SharedCache } from "@codeshod/core/shared-cache"
import { InstructionEntry } from "@codeshod/core/session/instruction-entry"
import { PersistentPty } from "@codeshod/core/persistent-pty"
import { LocationServiceMap } from "@codeshod/core/location-service-map"
import { AppNodeBuilder } from "@codeshod/core/effect/app-node-builder"
import { Permission } from "@codeshod/core/permission"
import { Reference } from "@codeshod/core/reference"
import { Rpc } from "@codeshod/core/rpc"
import { Skill } from "@codeshod/core/skill"
import { SkillDiscovery } from "@codeshod/core/skill/discovery"
import { Watcher } from "@codeshod/core/filesystem/watcher"
import { Tool } from "@codeshod/core/tool"
import { Vcs } from "@codeshod/core/vcs"
import { VideoGeneration } from "@codeshod/core/video-generation"
import { WebSearch } from "@codeshod/core/websearch"
import { Worktree } from "@codeshod/core/worktree"
import { WorktreeStrategies } from "@codeshod/core/worktree/strategies"
import { Effect, Layer } from "effect"
import { tempLocationLayer } from "../fixture/location"
import { emptyMcpLayer } from "../fixture/mcp"
import { offlineModels } from "../fixture/models"

const npmLayer = Layer.succeed(
  Npm.Service,
  Npm.Service.of({
    add: (name) => Effect.succeed({ directory: "", name }),
    resolve: (name) => Effect.succeed({ directory: "", name }),
    check: () => Effect.succeed(false),
    update: (name) => Effect.succeed({ directory: "", name }),
    follows: () => Effect.succeed(false),
    reject: () => Effect.succeed(false),
    which: () => Effect.undefined,
  }),
)

const generateLayer = Layer.succeed(
  Generate.Service,
  Generate.Service.of({
    text: () => Effect.succeed(""),
    image: () => Effect.die("unused"),
    decisions: () => Effect.die("unused"),
    video: {
      start: () => Effect.die("unused"),
      status: () => Effect.die("unused"),
      result: () => Effect.die("unused"),
      cancel: () => Effect.die("unused"),
    },
  }),
)

const configLayer = Config.testLayer()

const permissionLayer = Layer.succeed(
  Permission.Service,
  Permission.Service.of({
    close: Effect.void,
    ask: (input) => Effect.succeed({ id: input.id ?? Permission.ID.create(), effect: "ask" }),
    assert: () => Effect.void,
    assertNotDenied: () => Effect.void,
    allows: () => Effect.succeed(false),
    reply: () => Effect.void,
    get: () => Effect.succeed(undefined),
    forSession: () => Effect.succeed([]),
    list: () => Effect.succeed([]),
    nested: () => Effect.void,
  }),
)

export const makePluginTestLayer = (
  permission = permissionLayer,
  generate = generateLayer,
  replacements: LayerNode.Replacements = [],
) =>
  AppNodeBuilder.build(
    LayerNode.group([
      App.node,
      AppProcess.node,
      FileSystem.node,
      FSUtil.node,
      Location.node,
      Npm.node,
      Credential.node,
      Config.node,
      Flag.node,
      Database.node,
      Environment.node,
      FileAccess.node,
      Global.node,
      Bus.node,
      Form.node,
      Generate.node,
      LayerNodePlatform.httpClient,
      Plugin.node,
      Agent.node,
      Artifact.node,
      AISDK.node,
      BlobStore.node,
      Provider.node,
      Model.node,
      Command.node,
      InstructionDiscovery.node,
      Integration.node,
      Job.node,
      KV.node,
      Mcp.node,
      Session.node,
      SharedCache.node,
      InstructionEntry.node,
      PersistentPty.node,
      LocationServiceMap.node,
      Permission.node,
      PluginHooks.node,
      Reference.node,
      Rpc.node,
      Skill.node,
      SkillDiscovery.node,
      Tool.node,
      Vcs.node,
      VideoGeneration.node,
      Watcher.node,
      WebSearch.node,
      Worktree.node,
      WorktreeStrategies.node,
    ]),
    [
      Location.node.replace(tempLocationLayer),
      Npm.node.replace(npmLayer),
      Config.node.replace(configLayer),
      Mcp.node.replace(emptyMcpLayer),
      Generate.node.replace(generate),
      Permission.node.replace(permission),
      offlineModels,
      ...replacements,
    ],
  ).pipe(Layer.provideMerge(configLayer))

export const PluginTestLayer = makePluginTestLayer()
