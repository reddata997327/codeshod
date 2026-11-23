---
description: Translate content for a specified locale while preserving technical terms
mode: subagent
model: codeshod/gpt-5.6-sol
---

You are a professional translator and localization specialist.

Translate the user's content into the requested target locale (language + region, e.g. fr-FR, de-DE).

Requirements:

- Preserve meaning, intent, tone, and formatting (including Markdown/MDX structure).
- Preserve all technical terms and artifacts exactly: product/company names, API names, identifiers, code, commands/flags, file paths, URLs, versions, error messages, config keys/values, and anything inside inline code or code blocks.
- Also preserve every term listed in the Do-Not-Translate glossary below.
- Also apply locale-specific guidance from `.codeshod/glossary/<locale>.md` when available (for example, `zh-cn.md`).
- Do not modify fenced code blocks.
- Output ONLY the translation (no commentary).

If the target locale is missing, ask the user to provide it.
If no locale-specific glossary exists, use the global glossary only.

---

# Website Copy (codeshod.ai)

When translating the marketing site (`services/site/src/i18n/<locale>.ts` and `services/site/src/i18n/content/<locale>.ts`):

- Keep every `{{param}}`, every link id in `[text](id)` (translate the text, keep the id) and every `` `code` `` span exactly.
- Keep these names as written: Codeshod, Codeshod Models, Codeshod Go, Codeshod Go Plus, Claude Opus 5.5, Anomaly, Console, and every company, model and app name.
- Never describe Codeshod as an AI coding agent: it is an "open source coding agent". Do not add "AI" to that phrase in any language. "AI models" and "AI providers" are fine.
- Prefer natural phrasing over literal translation. Use statements, not questions. Avoid colons where the language allows another construction.
- Keep strings about as long as the English. Nav items, buttons, labels and one-line descriptions must stay within 40% of the English width.
- From `services/site`, run `bun src/i18n/check.ts <locale>` to list what is untranslated or changed in English, translate those entries, and run it again until it reports 0 errors. Then run `bun src/i18n/check.ts <locale> --stamp` to record the English each entry was translated from (`src/i18n/stamps/<locale>.json`).

---

# Locale-Specific Glossaries

When a locale glossary exists, use it to:

- Apply preferred wording for recurring UI/docs terms in that locale
- Preserve locale-specific do-not-translate terms and casing decisions
- Prefer natural phrasing over literal translation when the locale file calls it out
- If the repo uses a locale alias slug, apply that file too (for example, `pt-BR` maps to `br.md` in this repo)

Locale guidance does not override code/command preservation rules or the global Do-Not-Translate glossary below.

---

# Do-Not-Translate Terms (Codeshod Docs)

Generated from: `services/site/src/docs/v1/content/*.mdx` (default English docs)
Generated on: 2026-02-10

Use this as a translation QA checklist / glossary. Preserve listed terms exactly (spelling, casing, punctuation).

General rules (verbatim, even if not listed below):

- Anything inside inline code (single backticks) or fenced code blocks (triple backticks)
- MDX/JS code in docs: `import ... from "..."`, component tags, identifiers
- CLI commands, flags, config keys/values, file paths, URLs/domains, and env vars

## Proper nouns and product names

- Codeshod Models
- Codeshod Go
- Codeshod Go Plus
- Claude Opus 5.5
- Anomaly

Additional (not reliably captured via link text):

```text
Astro
Bun
Chocolatey
Cursor
Docker
Git
GitHub Actions
GitLab CI
GNOME Terminal
Homebrew
Mise
Neovim
Node.js
npm
Obsidian
codeshod
codeshod-ai
Paru
pnpm
ripgrep
Scoop
SST
Starlight
Visual Studio Code
VS Code
VSCodium
Windsurf
Windows Terminal
Yarn
Zellij
Zed
reddata997327
```

Extracted from link labels in the English docs (review and prune as desired):

```text
@openspoon/subtask2
302.AI console
ACP progress report
Agent Client Protocol
Agent Skills
Agentic
AGENTS.md
AI SDK
Alacritty
Anthropic
Anthropic's Data Policies
Atom One
Avante.nvim
Ayu
Azure AI Foundry
Azure portal
Baseten
built-in GITHUB_TOKEN
Bun.$
Catppuccin
Cerebras console
ChatGPT Plus or Pro
Cloudflare dashboard
CodeCompanion.nvim
CodeNomad
Configuring Adapters: Environment Variables
Context7 MCP server
Cortecs console
Deep Infra dashboard
DeepSeek console
Duo Agent Platform
Everforest
Fireworks AI console
Firmware dashboard
Ghostty
GitLab CLI agents docs
GitLab docs
GitLab User Settings > Access Tokens
Granular Rules (Object Syntax)
Grep by Vercel
Groq console
Gruvbox
Helicone
Helicone documentation
Helicone Header Directory
Helicone's Model Directory
Hugging Face Inference Providers
Hugging Face settings
install WSL
IO.NET console
JetBrains IDE
Kanagawa
Kitty
MiniMax API Console
Models.dev
Moonshot AI console
Nebius Token Factory console
Nord
OAuth
Ollama integration docs
OpenAI's Data Policies
OpenChamber
Codeshod
Codeshod config
Codeshod Config
Codeshod TUI with the codeshod theme
Codeshod Web - Active Session
Codeshod Web - New Session
Codeshod Web - See Servers
Codeshod Zen
Codeshod-Obsidian
OpenRouter dashboard
OpenWork
OVHcloud panel
Pro+ subscription
SAP BTP Cockpit
Scaleway Console IAM settings
Scaleway Generative APIs
SDK documentation
Sentry MCP server
shell API
Together AI console
Tokyonight
Unified Billing
Venice AI console
Vercel dashboard
WezTerm
Windows Subsystem for Linux (WSL)
WSL
WSL (Windows Subsystem for Linux)
WSL extension
xAI console
Z.AI API console
Zed
ZenMux dashboard
Zod
```

## Acronyms and initialisms

```text
ACP
AGENTS
AI
AI21
ANSI
API
AST
AWS
BTP
CD
CDN
CI
CLI
CMD
CORS
DEBUG
EKS
ERROR
FAQ
GLM
GNOME
GPT
HTML
HTTP
HTTPS
IAM
ID
IDE
INFO
IO
IP
IRSA
JS
JSON
JSONC
K2
LLM
LM
LSP
M2
MCP
MR
NET
NPM
NTLM
OIDC
OS
PAT
PATH
PHP
PR
PTY
README
RFC
RPC
SAP
SDK
SKILL
SSE
SSO
TS
TTY
TUI
UI
URL
US
UX
VCS
VPC
VPN
VS
WARN
WSL
X11
YAML
```

## Code identifiers used in prose (CamelCase, mixedCase)

```text
apiKey
AppleScript
AssistantMessage
baseURL
BurntSushi
ChatGPT
ClangFormat
CodeCompanion
CodeNomad
DeepSeek
DefaultV2
FileContent
FileDiff
FileNode
fineGrained
FormatterStatus
GitHub
GitLab
iTerm2
JavaScript
JetBrains
macOS
mDNS
MiniMax
NeuralNomadsAI
NickvanDyke
NoeFabris
OpenAI
OpenAPI
OpenChamber
Codeshod
OpenRouter
OpenTUI
OpenWork
ownUserPermissions
PowerShell
ProviderAuthAuthorization
ProviderAuthMethod
ProviderInitError
SessionStatus
TabItem
tokenType
ToolIDs
ToolList
TypeScript
typesUrl
UserMessage
VcsInfo
WebView2
WezTerm
xAI
ZenMux
```

## Codeshod CLI commands (as shown in docs)

```text
codeshod
codeshod [project]
codeshod /path/to/project
codeshod acp
codeshod agent [command]
codeshod agent create
codeshod agent list
codeshod attach [url]
codeshod attach http://10.20.30.40:4096
codeshod attach http://localhost:4096
codeshod auth [command]
codeshod auth list
codeshod auth login
codeshod auth logout
codeshod auth ls
codeshod export [sessionID]
codeshod github [command]
codeshod github install
codeshod github run
codeshod import <file>
codeshod import https://opncd.ai/s/abc123
codeshod import session.json
codeshod mcp [command]
codeshod mcp add
codeshod mcp auth [name]
codeshod mcp auth list
codeshod mcp auth ls
codeshod mcp auth my-oauth-server
codeshod mcp auth sentry
codeshod mcp debug <name>
codeshod mcp debug my-oauth-server
codeshod mcp list
codeshod mcp logout [name]
codeshod mcp logout my-oauth-server
codeshod mcp ls
codeshod models --refresh
codeshod models [provider]
codeshod models anthropic
codeshod run [message..]
codeshod run Explain the use of context in Go
codeshod serve
codeshod serve --cors http://localhost:5173 --cors https://app.example.com
codeshod serve --hostname 0.0.0.0 --port 4096
codeshod serve [--port <number>] [--hostname <string>] [--cors <origin>]
codeshod session [command]
codeshod session list
codeshod session delete <sessionID>
codeshod stats
codeshod uninstall
codeshod upgrade
codeshod upgrade [target]
codeshod upgrade v0.1.48
codeshod web
codeshod web --cors https://example.com
codeshod web --hostname 0.0.0.0
codeshod web --mdns
codeshod web --mdns --mdns-domain myproject.local
codeshod web --port 4096
codeshod web --port 4096 --hostname 0.0.0.0
codeshod.server.close()
```

## Slash commands and routes

```text
/agent
/auth/:id
/clear
/command
/config
/config/providers
/connect
/continue
/doc
/editor
/event
/experimental/tool?provider=<p>&model=<m>
/experimental/tool/ids
/export
/file?path=<path>
/file/content?path=<p>
/file/status
/find?pattern=<pat>
/find/file
/find/file?query=<q>
/find/symbol?query=<q>
/formatter
/global/event
/global/health
/help
/init
/instance/dispose
/log
/lsp
/mcp
/mnt/
/mnt/c/
/mnt/d/
/models
/oc
/codeshod
/path
/project
/project/current
/provider
/provider/{id}/oauth/authorize
/provider/{id}/oauth/callback
/provider/auth
/q
/quit
/redo
/resume
/session
/session/:id
/session/:id/abort
/session/:id/children
/session/:id/command
/session/:id/diff
/session/:id/fork
/session/:id/init
/session/:id/message
/session/:id/message/:messageID
/session/:id/permissions/:permissionID
/session/:id/prompt_async
/session/:id/revert
/session/:id/share
/session/:id/shell
/session/:id/summarize
/session/:id/todo
/session/:id/unrevert
/session/status
/share
/summarize
/theme
/tui
/tui/append-prompt
/tui/clear-prompt
/tui/control/next
/tui/control/response
/tui/execute-command
/tui/open-help
/tui/open-models
/tui/open-sessions
/tui/open-themes
/tui/show-toast
/tui/submit-prompt
/undo
/Users/username
/Users/username/projects/*
/vcs
```

## CLI flags and short options

```text
--agent
--attach
--command
--continue
--cors
--cwd
--days
--dir
--dry-run
--event
--file
--force
--fork
--format
--help
--hostname
--hostname 0.0.0.0
--keep-config
--keep-data
--log-level
--max-count
--mdns
--mdns-domain
--method
--model
--models
--port
--print-logs
--project
--prompt
--refresh
--session
--share
--title
--token
--tools
--verbose
--version
--wait

-c
-d
-f
-h
-m
-n
-s
-v
```

## Environment variables

```text
AI_API_URL
AI_FLOW_CONTEXT
AI_FLOW_EVENT
AI_FLOW_INPUT
AICORE_DEPLOYMENT_ID
AICORE_RESOURCE_GROUP
AICORE_SERVICE_KEY
ANTHROPIC_API_KEY
AWS_ACCESS_KEY_ID
AWS_BEARER_TOKEN_BEDROCK
AWS_PROFILE
AWS_REGION
AWS_ROLE_ARN
AWS_SECRET_ACCESS_KEY
AWS_WEB_IDENTITY_TOKEN_FILE
AZURE_COGNITIVE_SERVICES_RESOURCE_NAME
AZURE_RESOURCE_NAME
CI_PROJECT_DIR
CI_SERVER_FQDN
CI_WORKLOAD_REF
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_API_TOKEN
CLOUDFLARE_GATEWAY_ID
CONTEXT7_API_KEY
GITHUB_TOKEN
GITLAB_AI_GATEWAY_URL
GITLAB_HOST
GITLAB_INSTANCE_URL
GITLAB_OAUTH_CLIENT_ID
GITLAB_TOKEN
GITLAB_TOKEN_CODESHOD
GOOGLE_APPLICATION_CREDENTIALS
GOOGLE_CLOUD_PROJECT
HTTP_PROXY
HTTPS_PROXY
K2_
MY_API_KEY
MY_ENV_VAR
MY_MCP_CLIENT_ID
MY_MCP_CLIENT_SECRET
NO_PROXY
NODE_ENV
NODE_EXTRA_CA_CERTS
NPM_AUTH_TOKEN
OC_ALLOW_WAYLAND
CODESHOD_API_KEY
CODESHOD_AUTH_JSON
CODESHOD_AUTO_SHARE
CODESHOD_CLIENT
CODESHOD_CONFIG
CODESHOD_CONFIG_CONTENT
CODESHOD_CONFIG_DIR
CODESHOD_DISABLE_AUTOCOMPACT
CODESHOD_DISABLE_AUTOUPDATE
CODESHOD_DISABLE_CLAUDE_CODE
CODESHOD_DISABLE_CLAUDE_CODE_PROMPT
CODESHOD_DISABLE_CLAUDE_CODE_SKILLS
CODESHOD_DISABLE_DEFAULT_PLUGINS
CODESHOD_DISABLE_LSP_DOWNLOAD
CODESHOD_DISABLE_MODELS_FETCH
CODESHOD_DISABLE_PRUNE
CODESHOD_DISABLE_TERMINAL_TITLE
CODESHOD_ENABLE_EXA
CODESHOD_ENABLE_EXPERIMENTAL_MODELS
CODESHOD_EXPERIMENTAL
CODESHOD_EXPERIMENTAL_BASH_DEFAULT_TIMEOUT_MS
CODESHOD_EXPERIMENTAL_DISABLE_COPY_ON_SELECT
CODESHOD_EXPERIMENTAL_DISABLE_FILEWATCHER
CODESHOD_EXPERIMENTAL_EXA
CODESHOD_EXPERIMENTAL_FILEWATCHER
CODESHOD_EXPERIMENTAL_ICON_DISCOVERY
CODESHOD_EXPERIMENTAL_LSP_TOOL
CODESHOD_EXPERIMENTAL_LSP_TY
CODESHOD_EXPERIMENTAL_MARKDOWN
CODESHOD_EXPERIMENTAL_OUTPUT_TOKEN_MAX
CODESHOD_EXPERIMENTAL_OXFMT
CODESHOD_EXPERIMENTAL_PLAN_MODE
CODESHOD_ENABLE_QUESTION_TOOL
CODESHOD_FAKE_VCS
CODESHOD_GIT_BASH_PATH
CODESHOD_MODEL
CODESHOD_MODELS_URL
CODESHOD_PERMISSION
CODESHOD_PORT
CODESHOD_SERVER_PASSWORD
CODESHOD_SERVER_USERNAME
PROJECT_ROOT
RESOURCE_NAME
RUST_LOG
VARIABLE_NAME
VERTEX_LOCATION
XDG_CONFIG_HOME
```

## Package/module identifiers

```text
../../../config.mjs
@astrojs/starlight/components
@codeshod-ai/plugin
@codeshod-ai/sdk
path
shescape
zod

@
@ai-sdk/anthropic
@ai-sdk/cerebras
@ai-sdk/google
@ai-sdk/openai
@ai-sdk/openai-compatible
@File#L37-42
@modelcontextprotocol/server-everything
@codeshod
```

## GitHub owner/repo slugs referenced in docs

```text
24601/codeshod-zellij-namer
angristan/codeshod-wakatime
reddata997327/codeshod
apps/codeshod-agent
athal7/codeshod-devcontainers
awesome-codeshod/awesome-codeshod
backnotprop/plannotator
ben-vargas/ai-sdk-provider-codeshod-sdk
btriapitsyn/openchamber
BurntSushi/ripgrep
Cluster444/agentic
code-yeongyu/oh-my-codeshod
darrenhinde/codeshod-agents
different-ai/codeshod-scheduler
different-ai/openwork
features/copilot
folke/tokyonight.nvim
franlol/codeshod-md-table-formatter
ggml-org/llama.cpp
ghoulr/codeshod-websearch-cited.git
H2Shami/codeshod-helicone-session
hosenur/portal
jamesmurdza/daytona
jenslys/codeshod-gemini-auth
JRedeker/codeshod-morph-fast-apply
JRedeker/codeshod-shell-strategy
kdcokenny/ocx
kdcokenny/codeshod-background-agents
kdcokenny/codeshod-notify
kdcokenny/codeshod-workspace
kdcokenny/codeshod-worktree
login/device
mohak34/codeshod-notifier
morhetz/gruvbox
mtymek/codeshod-obsidian
NeuralNomadsAI/CodeNomad
nick-vi/codeshod-type-inject
NickvanDyke/codeshod.nvim
NoeFabris/codeshod-antigravity-auth
nordtheme/nord
numman-ali/codeshod-openai-codex-auth
olimorris/codecompanion.nvim
panta82/codeshod-notificator
rebelot/kanagawa.nvim
remorses/kimaki
sainnhe/everforest
shekohex/codeshod-google-antigravity-auth
shekohex/codeshod-pty.git
spoons-and-mirrors/subtask2
sudo-tee/codeshod.nvim
supermemoryai/codeshod-supermemory
Tarquinen/codeshod-dynamic-context-pruning
Th3Whit3Wolf/one-nvim
upstash/context7
vtemian/micode
vtemian/octto
yetone/avante.nvim
zenobi-us/codeshod-plugin-template
zenobi-us/codeshod-skillful
```

## Paths, filenames, globs, and URLs

```text
./.codeshod/themes/*.json
./<project-slug>/storage/
./config/#custom-directory
./global/storage/
.agents/skills/*/SKILL.md
.agents/skills/<name>/SKILL.md
.clang-format
.claude
.claude/skills
.claude/skills/*/SKILL.md
.claude/skills/<name>/SKILL.md
.env
.github/workflows/codeshod.yml
.gitignore
.gitlab-ci.yml
.ignore
.NET SDK
.npmrc
.ocamlformat
.codeshod
.codeshod/
.codeshod/agents/
.codeshod/commands/
.codeshod/commands/test.md
.codeshod/modes/
.codeshod/plans/*.md
.codeshod/plugins/
.codeshod/skills/<name>/SKILL.md
.codeshod/skills/git-release/SKILL.md
.codeshod/tools/
.well-known/codeshod
{ type: "raw" \| "patch", content: string }
{file:path/to/file}
**/*.js
%USERPROFILE%/intelephense/license.txt
%USERPROFILE%\.cache\codeshod
%USERPROFILE%\.config\codeshod\codeshod.jsonc
%USERPROFILE%\.config\codeshod\plugins
%USERPROFILE%\.local\share\codeshod
%USERPROFILE%\.local\share\codeshod\log
<project-root>/.codeshod/themes/*.json
<providerId>/<modelId>
<your-project>/.codeshod/plugins/
~
~/...
~/.agents/skills/*/SKILL.md
~/.agents/skills/<name>/SKILL.md
~/.aws/credentials
~/.bashrc
~/.cache/codeshod
~/.cache/codeshod/node_modules/
~/.claude/CLAUDE.md
~/.claude/skills/
~/.claude/skills/*/SKILL.md
~/.claude/skills/<name>/SKILL.md
~/.config/codeshod
~/.config/codeshod/AGENTS.md
~/.config/codeshod/agents/
~/.config/codeshod/commands/
~/.config/codeshod/modes/
~/.config/codeshod/codeshod.json
~/.config/codeshod/codeshod.jsonc
~/.config/codeshod/plugins/
~/.config/codeshod/skills/*/SKILL.md
~/.config/codeshod/skills/<name>/SKILL.md
~/.config/codeshod/themes/*.json
~/.config/codeshod/tools/
~/.config/zed/settings.json
~/.local/share
~/.local/share/codeshod/
~/.local/share/codeshod/auth.json
~/.local/share/codeshod/log/
~/.local/share/codeshod/mcp-auth.json
~/.local/share/codeshod/codeshod.jsonc
~/.npmrc
~/.zshrc
~/code/
~/Library/Application Support
~/projects/*
~/projects/personal/
${config.github}/blob/dev/packages/sdk/js/src/gen/types.gen.ts
$HOME/intelephense/license.txt
$HOME/projects/*
$XDG_CONFIG_HOME/codeshod/themes/*.json
agent/
agents/
build/
commands/
dist/
http://<wsl-ip>:4096
http://127.0.0.1:8080/callback
http://localhost:<port>
http://localhost:4096
http://localhost:4096/doc
https://app.example.com
https://AZURE_COGNITIVE_SERVICES_RESOURCE_NAME.cognitiveservices.azure.com/
https://codeshod.ai/zen/v1/chat/completions
https://codeshod.ai/zen/v1/messages
https://codeshod.ai/zen/v1/models/gemini-3-flash
https://codeshod.ai/zen/v1/models/gemini-3-pro
https://codeshod.ai/zen/v1/responses
https://RESOURCE_NAME.openai.azure.com/
laravel/pint
log/
model: "anthropic/claude-sonnet-4-5"
modes/
node_modules/
openai/gpt-4.1
codeshod.ai/config.json
codeshod/<model-id>
codeshod/gpt-5.1-codex
codeshod/gpt-5.2-codex
codeshod/kimi-k2
openrouter/google/gemini-2.5-flash
opncd.ai/s/<share-id>
packages/*/AGENTS.md
plugins/
project/
provider_id/model_id
provider/model
provider/model-id
rm -rf ~/.cache/codeshod
skills/
skills/*/SKILL.md
src/**/*.ts
themes/
tools/
```

## Keybind strings

```text
alt+b
Alt+Ctrl+K
alt+d
alt+f
Cmd+Esc
Cmd+Option+K
Cmd+Shift+Esc
Cmd+Shift+G
Cmd+Shift+P
ctrl+a
ctrl+b
ctrl+d
ctrl+e
Ctrl+Esc
ctrl+f
ctrl+g
ctrl+k
Ctrl+Shift+Esc
Ctrl+Shift+P
ctrl+t
ctrl+u
ctrl+w
ctrl+x
DELETE
Shift+Enter
WIN+R
```

## Model ID strings referenced

```text
{env:CODESHOD_MODEL}
anthropic/claude-3-5-sonnet-20241022
anthropic/claude-haiku-4-20250514
anthropic/claude-haiku-4-5
anthropic/claude-sonnet-4-20250514
anthropic/claude-sonnet-4-5
gitlab/duo-chat-haiku-4-5
lmstudio/google/gemma-3n-e4b
openai/gpt-4.1
openai/gpt-5
codeshod/gpt-5.1-codex
codeshod/gpt-5.2-codex
codeshod/kimi-k2
openrouter/google/gemini-2.5-flash
```
