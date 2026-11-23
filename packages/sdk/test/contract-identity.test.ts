import { expect, test } from "bun:test"
import { EnvironmentDriver } from "@codeshod/core/environment/driver"
import { EnvironmentFiles } from "@codeshod/core/environment/files"
import { Location as CoreLocation } from "@codeshod/core/location"
import { WorkspaceDriver } from "@codeshod/core/workspace/driver"
import { SessionInbox as CoreSessionInbox } from "@codeshod/core/session/inbox"
import { SessionMessage as CoreSessionMessage } from "@codeshod/core/session/message"
import { Agent } from "@codeshod/schema/agent"
import { Config } from "@codeshod/schema/config"
import { Event } from "@codeshod/schema/event"
import { Location } from "@codeshod/schema/location"
import { Model } from "@codeshod/schema/model"
import { Project } from "@codeshod/schema/project"
import { Provider } from "@codeshod/schema/provider"
import { WebSearch } from "@codeshod/schema/websearch"
import { Session } from "@codeshod/schema/session"
import { SessionInbox } from "@codeshod/schema/session-inbox"
import { SessionMessage } from "@codeshod/schema/session-message"
import { Workspace } from "@codeshod/schema/workspace"
import { Worktree } from "@codeshod/schema/worktree"
import { Api } from "@codeshod/server/api"
import { ClientApi, clientNamespace, groupNames, promiseOmitEndpoints } from "@codeshod/protocol/client"
import { compile, emitPromise } from "@codeshod/httpapi-codegen"

const SDK = await import("../src/index")
const SDKEffect = await import("../src/effect")
const CoreAgent = await import("@codeshod/core/agent")
const CoreModel = await import("@codeshod/core/model")
const CoreProject = await import("@codeshod/core/project")
const CoreSession = await import("@codeshod/core/session")
const CoreWorktree = await import("@codeshod/core/worktree")

test("re-exports canonical contracts directly from Schema", () => {
  expect(SDK.Agent).toBe(Agent)
  expect(SDK.Config).toBe(Config)
  expect(SDK.Event).toBe(Event)
  expect(SDK.Model).toBe(Model)
  expect(SDK.WebSearch).toBe(WebSearch)
  expect(SDK.Session).toBe(Session)
  expect(SDK.Worktree).toBe(Worktree)
  expect(SDK.Workspace).toBe(Workspace)
  expect(Object.keys(SDK).sort()).toEqual([
    "AbsolutePath",
    "Agent",
    "ClientError",
    "Command",
    "Config",
    "Credential",
    "Event",
    "FileSystem",
    "Integration",
    "Location",
    "Model",
    "Codeshod",
    "Permission",
    "PermissionSaved",
    "Project",
    "Prompt",
    "PromptInput",
    "Provider",
    "Pty",
    "Question",
    "Reference",
    "RelativePath",
    "Session",
    "SessionInbox",
    "SessionMessage",
    "Skill",
    "Tool",
    "WebSearch",
    "Workspace",
    "Worktree",
  ])
})

test("Core and Server reuse the authoritative Schema and Protocol values", () => {
  expect(CoreAgent.ID).toBe(Agent.ID)
  expect(CoreLocation.Ref).toBe(Location.Ref)
  expect(CoreModel.Ref).toBe(Model.Ref)
  expect(CoreSession.Info).toBe(Session.Info)
  expect(CoreProject.Current).toBe(Project.Current)
  expect(CoreWorktree.DirectoryUnavailableError).toBeDefined()
  expect(CoreWorktree.List).toBe(Worktree.List)
  expect(CoreWorktree.Info).toBe(Worktree.Info)
  expect(CoreSessionInbox.Item).toBe(SessionInbox.Item)
  expect(CoreSessionInbox.User).toBe(SessionInbox.User)
  expect(CoreSessionInbox.Synthetic).toBe(SessionInbox.Synthetic)
  expect(CoreSessionMessage.Info).toBe(SessionMessage.Info)
  expect(CoreSessionMessage.AssistantText).toBe(SessionMessage.AssistantText)
  expect(Api.groups["server.session"].identifier).toBe("server.session")
  expect(Api.groups["server.project"].identifier).toBe("server.project")
  expect(Object.keys(ClientApi.groups)).toEqual(Object.keys(Api.groups))
  expect(Session.ID.create()).toStartWith("ses_")
  expect(String(Project.ID.global)).toBe("global")
  expect(String(Provider.ID.anthropic)).toBe("anthropic")
  expect(Workspace.ID.create()).toStartWith("wrk_")
})

test("client and Server contracts generate identically", () => {
  const server = compile(Api, { groupNames, omitEndpoints: promiseOmitEndpoints, namespace: clientNamespace })
  const client = compile(ClientApi, { groupNames, omitEndpoints: promiseOmitEndpoints, namespace: clientNamespace })

  expect(emitPromise(client)).toEqual(emitPromise(server))
})

test("re-exports workspace and environment driver contracts from @codeshod/sdk/effect", () => {
  expect(SDKEffect.WorkspaceDriver).toBe(WorkspaceDriver)
  expect(SDKEffect.EnvironmentDriver).toBe(EnvironmentDriver)
  expect(SDKEffect.EnvironmentFiles).toBe(EnvironmentFiles)
})
