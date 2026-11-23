// TODO: Keep additional network capabilities inside Schema and Protocol as the client grows; /effect must never import
// Core or Server. Preserve these datatype exports so internal model reorganizations do not require caller migrations.
import type { Effect } from "effect"
import type { Codeshod } from "./client.js"

export * from "./generated/index"
export { Codeshod } from "./client.js"
export type {
  AgentApi,
  AppApi,
  CommandApi,
  ConfigApi,
  EventApi,
  IntegrationApi,
  ModelApi,
  PluginApi,
  ProviderApi,
  ReferenceApi,
  RpcApi,
  RpcClient,
  WebSearchApi,
  SessionApi,
  SkillApi,
} from "./api.js"
export { Agent } from "@codeshod/schema/agent"
export { Command } from "@codeshod/schema/command"
export { Config } from "@codeshod/schema/config"
export { Credential } from "@codeshod/schema/credential"
export { Event } from "@codeshod/schema/event"
export { EventLog } from "@codeshod/schema/event-log"
export { FileSystem } from "@codeshod/schema/filesystem"
export { Form } from "@codeshod/schema/form"
export { Integration } from "@codeshod/schema/integration"
export { Location } from "@codeshod/schema/location"
export { Model } from "@codeshod/schema/model"
export { Permission } from "@codeshod/schema/permission"
export { PermissionSaved } from "@codeshod/schema/permission-saved"
export { Project } from "@codeshod/schema/project"
export { Worktree } from "@codeshod/schema/worktree"
export { Vcs } from "@codeshod/schema/vcs"
export { Provider } from "@codeshod/schema/provider"
export { Pty } from "@codeshod/schema/pty"
export { Question } from "@codeshod/schema/question"
export { Reference } from "@codeshod/schema/reference"
export { WebSearch } from "@codeshod/schema/websearch"
export { AbsolutePath, RelativePath } from "@codeshod/schema/schema"
export { Session } from "@codeshod/schema/session"
export { SessionInbox } from "@codeshod/schema/session-inbox"
export { SessionMessage } from "@codeshod/schema/session-message"
export { Skill } from "@codeshod/schema/skill"
export { Prompt } from "@codeshod/schema/prompt"
export { PromptInput } from "@codeshod/schema/prompt-input"
export type { CodeshodEvent } from "@codeshod/protocol/groups/event"
export type CodeshodClient = Effect.Success<ReturnType<typeof Codeshod.make>>
