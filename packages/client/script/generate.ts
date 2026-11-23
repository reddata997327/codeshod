import { NodeFileSystem } from "@effect/platform-node"
import { compile, emitEffectImported, emitEffectShape, emitPromise, write } from "@codeshod/httpapi-codegen"
import {
  ClientApi,
  clientNamespace,
  deprecatedClientPaths,
  effectOmitEndpoints,
  groupNames,
  promiseOmitEndpoints,
} from "@codeshod/protocol/client"
import { Agent } from "@codeshod/schema/agent"
import { Artifact } from "@codeshod/schema/artifact"
import { Automation } from "@codeshod/schema/automation"
import { Command } from "@codeshod/schema/command"
import { Config } from "@codeshod/schema/config"
import { Credential } from "@codeshod/schema/credential"
import { Event } from "@codeshod/schema/event"
import { EventLog } from "@codeshod/schema/event-log"
import { FileDiff } from "@codeshod/schema/file-diff"
import { FileSystem } from "@codeshod/schema/filesystem"
import { Form } from "@codeshod/schema/form"
import { Generate } from "@codeshod/schema/generate"
import { Instruction } from "@codeshod/schema/instruction"
import { InstructionEntry } from "@codeshod/schema/instruction-entry"
import { Integration } from "@codeshod/schema/integration"
import { Job } from "@codeshod/schema/job"
import { Location } from "@codeshod/schema/location"
import { Mcp } from "@codeshod/schema/mcp"
import { Model } from "@codeshod/schema/model"
import { Money } from "@codeshod/schema/money"
import { Permission } from "@codeshod/schema/permission"
import { PermissionSaved } from "@codeshod/schema/permission-saved"
import { Plugin } from "@codeshod/schema/plugin"
import { Project } from "@codeshod/schema/project"
import { Worktree } from "@codeshod/schema/worktree"
import { AgentAttachment, FileAttachment, Prompt, PromptMention } from "@codeshod/schema/prompt"
import { PromptInput } from "@codeshod/schema/prompt-input"
import { Provider } from "@codeshod/schema/provider"
import { Pty } from "@codeshod/schema/pty"
import { PtyTicket } from "@codeshod/schema/pty-ticket"
import { Question } from "@codeshod/schema/question"
import { Reference } from "@codeshod/schema/reference"
import { AbsolutePath, RelativePath } from "@codeshod/schema/schema"
import { Session } from "@codeshod/schema/session"
import { SessionMessage } from "@codeshod/schema/session-message"
import { SessionInbox } from "@codeshod/schema/session-inbox"
import { Shell } from "@codeshod/schema/shell"
import { Skill } from "@codeshod/schema/skill"
import { Snapshot } from "@codeshod/schema/snapshot"
import { UsageLimits } from "@codeshod/schema/usage-limits"
import { Vcs } from "@codeshod/schema/vcs"
import { WebSearch } from "@codeshod/schema/websearch"
import { Workspace } from "@codeshod/schema/workspace"
import { Effect, Schema } from "effect"
import { fileURLToPath } from "url"

const promiseContract = compile(ClientApi, {
  groupNames,
  omitEndpoints: promiseOmitEndpoints,
  namespace: clientNamespace,
  aliases: deprecatedClientPaths,
})
const effectContract = compile(ClientApi, {
  groupNames,
  omitEndpoints: effectOmitEndpoints,
  namespace: clientNamespace,
  aliases: deprecatedClientPaths,
})
const effectTypeReferences = [
  ...namespaceTypes("Agent", "@codeshod/schema/agent", Agent),
  ...namespaceTypes("Artifact", "@codeshod/schema/artifact", Artifact),
  ...namespaceTypes("Automation", "@codeshod/schema/automation", Automation),
  ...namespaceTypes("Command", "@codeshod/schema/command", Command),
  ...namespaceTypes("Config", "@codeshod/schema/config", Config),
  ...namespaceTypes("Credential", "@codeshod/schema/credential", Credential),
  ...namespaceTypes("Event", "@codeshod/schema/event", Event),
  ...namespaceTypes("EventLog", "@codeshod/schema/event-log", EventLog),
  ...namespaceTypes("FileDiff", "@codeshod/schema/file-diff", FileDiff),
  ...namespaceTypes("FileSystem", "@codeshod/schema/filesystem", FileSystem),
  ...namespaceTypes("Form", "@codeshod/schema/form", Form),
  ...namespaceTypes("Generate", "@codeshod/schema/generate", Generate),
  ...namespaceTypes("Instruction", "@codeshod/schema/instruction", Instruction),
  ...namespaceTypes("InstructionEntry", "@codeshod/schema/instruction-entry", InstructionEntry),
  ...namespaceTypes("Integration", "@codeshod/schema/integration", Integration),
  ...namespaceTypes("Job", "@codeshod/schema/job", Job),
  typeReference("Location.PublicRef", "@codeshod/schema/location", Location.PublicRef),
  typeReference("Location.PublicInfo", "@codeshod/schema/location", Location.PublicInfo),
  ...namespaceTypes("Mcp", "@codeshod/schema/mcp", Mcp),
  ...namespaceTypes("Model", "@codeshod/schema/model", Model),
  ...namespaceTypes("Money", "@codeshod/schema/money", Money),
  ...namespaceTypes("Permission", "@codeshod/schema/permission", Permission),
  ...namespaceTypes("PermissionSaved", "@codeshod/schema/permission-saved", PermissionSaved),
  ...namespaceTypes("Plugin", "@codeshod/schema/plugin", Plugin),
  ...namespaceTypes("Project", "@codeshod/schema/project", Project),
  ...namespaceTypes("Worktree", "@codeshod/schema/worktree", Worktree),
  ...namespaceTypes("PromptInput", "@codeshod/schema/prompt-input", PromptInput),
  ...namespaceTypes("Provider", "@codeshod/schema/provider", Provider),
  ...namespaceTypes("Pty", "@codeshod/schema/pty", Pty),
  ...namespaceTypes("PtyTicket", "@codeshod/schema/pty-ticket", PtyTicket),
  ...namespaceTypes("Question", "@codeshod/schema/question", Question),
  ...namespaceTypes("Reference", "@codeshod/schema/reference", Reference),
  ...namespaceTypes("Session", "@codeshod/schema/session", Session),
  ...namespaceTypes("SessionMessage", "@codeshod/schema/session-message", SessionMessage),
  ...namespaceTypes("SessionInbox", "@codeshod/schema/session-inbox", SessionInbox),
  ...namespaceTypes("Shell", "@codeshod/schema/shell", Shell),
  ...namespaceTypes("Skill", "@codeshod/schema/skill", Skill),
  ...namespaceTypes("Snapshot", "@codeshod/schema/snapshot", Snapshot),
  ...namespaceTypes("UsageLimits", "@codeshod/schema/usage-limits", UsageLimits),
  ...namespaceTypes("Vcs", "@codeshod/schema/vcs", Vcs),
  ...namespaceTypes("WebSearch", "@codeshod/schema/websearch", WebSearch),
  ...namespaceTypes("Workspace", "@codeshod/schema/workspace", Workspace),
  typeReference("Prompt", "@codeshod/schema/prompt", Prompt),
  typeReference("PromptMention", "@codeshod/schema/prompt", PromptMention),
  typeReference("FileAttachment", "@codeshod/schema/prompt", FileAttachment),
  typeReference("AgentAttachment", "@codeshod/schema/prompt", AgentAttachment),
  typeReference("AbsolutePath", "@codeshod/schema/schema", AbsolutePath),
  typeReference("RelativePath", "@codeshod/schema/schema", RelativePath),
]

await Effect.runPromise(
  Effect.all(
    [
      write(
        emitPromise(promiseContract, {
          mutableOutputs: true,
        }),
        fileURLToPath(new URL("../src/promise/generated", import.meta.url)),
      ),
      write(
        emitEffectImported(effectContract, {
          module: "../../contract",
          api: "ClientApi",
          shapeModule: "../api/api.js",
        }),
        fileURLToPath(new URL("../src/effect/generated", import.meta.url)),
      ),
      write(
        emitEffectShape(effectContract, {
          typeReferences: effectTypeReferences,
          outputTypes: {
            "event.subscribe": {
              name: "CodeshodEvent",
              import: 'import type { CodeshodEvent } from "@codeshod/protocol/groups/event"',
            },
          },
        }),
        fileURLToPath(new URL("../src/effect/api", import.meta.url)),
      ),
    ],
    { concurrency: 3, discard: true },
  ).pipe(Effect.provide(NodeFileSystem.layer)),
)

function namespaceTypes(namespace: string, module: string, values: object) {
  return Object.entries(values).flatMap(([name, schema]) =>
    Schema.isSchema(schema) ? [typeReference(`${namespace}.${name}`, module, schema)] : [],
  )
}

function typeReference(name: string, module: string, schema: Schema.Top) {
  return {
    schema,
    name,
    import: `import type { ${name.split(".")[0]} } from ${JSON.stringify(module)}`,
  }
}
