- After changing the public Protocol or Server `HttpApi`, run `bun run generate` from `packages/client`. Do not edit generated client files directly.
- Keep runtime dependencies directed from Schema to Core and Protocol, then from Core and Protocol to Server. Client runtime code may depend on Schema and Protocol but never Core or Server; `sdk` composes Client, Core, and Server.
- This repository does not use Changesets. Do not add `.changeset` files; follow the existing release workflow instead.
- The default branch is `dev`. Base branches and worktrees on `origin/dev`, target PRs at `dev`, and diff against `origin/dev` unless told otherwise.

## Live TUI Testing

- Run `bun run dev:live` from a development worktree to test its TUI against the currently elected `codeshod` background server and live sessions.
- Pass a directory after the script when needed, for example `bun run dev:live /path/to/project`.
- The script discovers the server with `codeshod service status`, injects its private local credential from `codeshod service get password`, and uses the `dev` TUI storage channel so tabs and other client-local state match the installed client.
- Prefer `dev:live` over plain `bun run dev` for this workflow. An implicit managed-service connection may replace the live server when the worktree client version differs; explicit `--server` warns and continues without replacing it.

## TUI Stories

- When a user asks for a TUI story, add a fixture-driven story under `packages/tui/src/feature-plugins/system/storybook` and register it in `index.tsx`.
- Render the real production component rather than a visual copy. Keep submissions and other side effects local to the story so it is safe to explore repeatedly.
- Expose the meaningful state dimensions through story keybindings and list them in `StoryFooter`; include a reset command when combinations can leave the fixture in a confusing state.
- Run a specific story with `CODESHOD_STORY=<story-id> bun run dev:live` from the development worktree, and exercise narrow and wide terminal sizes when layout is relevant.

## TUI Theme Tokens

- Choose theme tokens by semantic role, not by their current color. Do not use raw `theme.hue` values or borrow an unrelated semantic token to achieve a preferred appearance.
- Use `text.feedback` and `background.feedback` only for outcome or status feedback such as errors, warnings, success messages, and informational messages. Use `formfield` states for form-control text, ordinals, and selection markers, and `action` states for actions.
- If the theme does not expose a token for the required semantic role, extend the theme schema, defaults, resolution, and types with that role before using it in a component. Do not repurpose the nearest-looking existing token.
- When changing the public theme token surface, verify the built-in light and dark defaults and the custom-theme fallback path in addition to the affected TUI component.

## Branch Names

Use a short branch name of at most three words, separated by hyphens. Do not use slashes or type prefixes such as `feat/` or `fix/`.

Examples: `session-recovery`, `fix-scroll-state`, `regenerate-sdk`.

## Commits and PR Titles

Use conventional commit-style messages and PR titles: `type(scope): summary`.

Valid types are `feat`, `fix`, `docs`, `chore`, `refactor`, and `test`. Scopes are optional; use the affected package or area when helpful, e.g. `core`, `codeshod`, `tui`, `app`, `desktop`, `sdk`, or `plugin`.

Examples: `fix(tui): simplify thinking toggle styling`, `docs: update contributing guide`, `chore(sdk): regenerate types`.

## Style Guide

### General Principles

- Keep things in one function unless composable or reusable
- Validate unknown values once at the boundary that owns them. Pass typed values inward instead of repeating `typeof value === "object"` and property-existence checks. Do not defensively revalidate values already guaranteed by a schema, constructor, or internal type.
- Do not extract single-use helpers preemptively. Inline the logic at the call site unless the helper is reused, hides a genuinely complex boundary, or has a clear independent name that improves the caller.
- Before adding complexity for a speculative or vanishingly unlikely race or security edge case, explain the concrete failure mode, likelihood, and complexity cost to the user and get their buy-in. Do not silently expand scope for theoretical robustness.
- Avoid `try`/`catch` where possible
- Avoid using the `any` type
- Use Bun APIs when possible, like `Bun.file()`
- Rely on type inference when possible; avoid explicit type annotations or interfaces unless necessary for exports or clarity
- Prefer functional array methods (flatMap, filter, map) over for loops; use type guards on filter to maintain type inference downstream
- In `src/config`, follow the existing self-export pattern at the top of the file (for example `export * as ConfigAgent from "./agent.js"`) when adding a new config module.
- In Effect generators, bind services to named variables before calling methods. Do not use nested service yields such as `yield* (yield* Foo.Service).bar()`.

Reduce total variable count by inlining when a value is only used once.

```ts
// Good
const journal = await Bun.file(path.join(dir, "journal.json")).json()

// Bad
const journalPath = path.join(dir, "journal.json")
const journal = await Bun.file(journalPath).json()
```

### Destructuring

Avoid unnecessary destructuring. Use dot notation to preserve context.

```ts
// Good
obj.a
obj.b

// Bad
const { a, b } = obj
```

### Imports

- Never alias imports. Do not use `import { foo as bar } from "..."` or renamed imports like `resolve as pathResolve`.
- Never use type-position `import("...")` references such as `Schema.declare<import("@codeshod/plugin/effect/plugin").Plugin["effect"]>`. Only when two imports genuinely collide on a name and no other option exists, an aliased type import (`import type { Plugin as PluginDefinition } from "..."`) is permitted as a last resort — still strongly preferred not to.
- Never use star imports. Do not use `import * as Foo from "..."` or `import type * as Foo from "..."`.
- If a namespace-style value is needed, import the module's own exported namespace by name, for example `import { Project } from "@codeshod/core/project"`, then reference `Project.ID`.
- Prefer dynamic imports for heavy modules that are only needed in selected code paths, especially in startup-sensitive entrypoints. Destructure dynamic import bindings near the top of the narrowest scope that needs them so they read like normal imports. Avoid inline chains such as `await import("./module").then((mod) => mod.value())` or `(await import("./module")).value()`. Keep branch-specific imports inside the branch that needs them to preserve lazy loading.

### Variables

Prefer `const` over `let`. Use ternaries or early returns instead of reassignment.

```ts
// Good
const foo = condition ? 1 : 2

// Bad
let foo
if (condition) foo = 1
else foo = 2
```

### Control Flow

Avoid `else` statements. Prefer early returns.

```ts
// Good
function foo() {
  if (condition) return 1
  return 2
}

// Bad
function foo() {
  if (condition) return 1
  else return 2
}
```

### Complex Logic

When a function has several validation branches or supporting details, make the main function read as the happy path and move supporting details into small helpers below it.

```ts
// Good
export function loadThing(input: unknown) {
  const config = requireConfig(input)
  const metadata = readMetadata(input)
  return createThing({ config, metadata })
}

function requireConfig(input: unknown) {
  ...
}
```

- Keep helpers close to the code they support, below the main export when that improves readability.
- Do not over-abstract simple expressions into many single-use helpers; extract only when it names a real concept like `requireConfig` or `readMetadata`.
- Do not return `Effect` from helpers unless they actually perform effectful work. Synchronous parsing, validation, and option building should stay synchronous.
- Prefer Effect schema helpers such as `Schema.UnknownFromJsonString` and `Schema.decodeUnknownOption` over manual `JSON.parse` wrapped in `Effect.try` when parsing untrusted JSON strings.
- Add comments for non-obvious constraints and surprising behavior, not for obvious assignments or control flow.

### Schema Definitions (Drizzle)

Use snake_case for field names so column names don't need to be redefined as strings.

```ts
// Good
const table = sqliteTable("session", {
  id: text().primaryKey(),
  project_id: text().notNull(),
  created_at: integer().notNull(),
})

// Bad
const table = sqliteTable("session", {
  id: text("id").primaryKey(),
  projectID: text("project_id").notNull(),
  createdAt: integer("created_at").notNull(),
})
```

### Experimental API

- An experimental endpoint lives at `/api/experimental/<group>/...`, its OpenAPI identifier is `experimental.<group>.<method>`, and it lands in the SDK as `client.experimental.<group>.<method>`. Its description says "Experimental: may change without compatibility guarantees."
- `packages/protocol/test/experimental-identifiers.test.ts` enforces the path and identifier match in both directions; the SDK namespace follows from the path.
- An experimental field or parameter on a stable endpoint goes under an `experimental` key (`experimental.<name>`), the same way config does (`config.experimental.*`).
- New endpoints and new default behaviors start experimental.
- To graduate one, move the route out of `/api/experimental`, drop the `experimental.` prefix, and note it in `CHANGELOG.md`.
- Experimental HTTP routes change without aliases: rename or remove the route, then update the callers.
- A breaking move of shipped SDK or plugin API (including moving it under `experimental`) keeps the old path and type names as deprecated aliases of the new ones until the next minor, each marked `@deprecated` with the replacement and "Removed in the next minor". Generated SDK moves get them from the codegen (`compile(..., { aliases: true })` in `packages/client/script/generate.ts`), not by hand.
- Experimental plugin hooks are named `experimental.*` (`experimental.ws.handshake`).

### Feature Flags

- When you open a PR, decide whether the change needs a flag: new user-visible behavior, risky core changes, and anything not ready to release get one; fixes, refactors, docs and tests do not.
- Gate risky behavior, or behavior that lands over several PRs, with a key and a description in `packages/schema/src/config/flag.ts`, and read it with `Flag.enabled("<key>")` from `@codeshod/core/flag`.
- Flags default to on in local and dev builds and off in releases, except `optInOnly` flags (such as `todo`), which require an explicit `CODESHOD_FLAGS=<key>` or `experimental.<key>: true` in every build.
- Say in the PR body which flag guards the change. The reserved switches `CODESHOD_FLAGS=all` and `experimental.all_flags: true` skip opt-in-only flags; use `all,-<key>` or `experimental.<key>: false` to opt out within the respective source.
- Ship a feature by deleting its flag and the checks that read it.

## Testing

- Avoid mocks as much as possible, you shouldn't be using globalThis.\* at all unless it's the only option.
- Test actual implementation, do not duplicate logic into tests
- Tests cannot run from repo root (guard: `do-not-run-tests-from-root`); run from package directories such as `packages/core`.
- Before writing or changing tests, read the matching skill in `.codeshod/skills`: `unit-tests` (bun test) or `tui-tests` (OpenTUI renderer tests). They cover what has made tests slow or flaky in CI.

## Checks

- Run `bun run check` from the repository root as the canonical full lint and type-check verification.
- During focused iteration, run `bun typecheck` from the affected package directory (for example, `packages/core`). Never run `tsc` directly.
- Local `typecheck` scripts use `bun check`. CI and package publishing run `typecheck:tsc`, which uses the official TypeScript compiler (`@typescript/native`). When the two disagree, `tsc` is the source of truth; reproduce with `bun run typecheck:tsc` from the package directory.
- `bun check` aims to match TypeScript 7.1, not the `7.0.2` that `process.versions.typescript` reports (oven-sh/bun#46536). When `bun check` and `tsc` from the pinned `@typescript/native` report different errors, file a minimal, dependency-free repro at https://github.com/oven-sh/bun/issues, with the output of both. `bun check` writes no declaration files, so declaration-emit errors such as TS5088 or TS2883 are expected to appear only in `tsc`; do not report those.

## Plugin Loading

- Plugins load asynchronously. Server handlers never wait for them (`Plugin.awaitActivation`), never retry until something appears, and never turn slow plugins into a timeout or 503. This applies to reads and to actions such as `generate.*`, `rpc.call`, `vcs.init` and `websearch.query`.
- The server answers with what is loaded now: lists may be empty or partial on a cold Location, and an action whose model, provider or RPC hasn't loaded yet fails with not-found. That is expected, not a bug to fix on the server.
- Clients are responsible for making sure what they need is loaded before they call. Long-lived clients refresh on the matching `*.updated` event (`model.updated`, `agent.updated`, `skill.updated`, `integration.updated`, `plugin.updated`, ...). One-shot clients (CLI commands, ACP, SDK callers) wait on their side, for example by polling `plugin.list` or the entry they need. See `packages/cli/src/services/plugin-startup.ts`.
- Running the hooks that are registered and waiting for their result is fine (for example `hooks.trigger("session", "http.request", ...)`). What is not allowed is waiting for plugins to load first: if the plugin that adds a hook hasn't loaded yet, the call runs without that hook.

## Built-in `nmap` tool

- The `nmap` tool is a first-party built-in, registered under plugin id `codeshod.tool.nmap` in `packages/core/src/plugin/internal.ts`. It is NOT an MCP server and not a shell-out to system `nmap`. The scanner is a pure-Rust binary (`rnmap`) shipped under `packages/cli/assets/rnmap/bin/rnmap-<platform>-<arch>` with its Rhai script library at `packages/cli/assets/rnmap/scripts/`.
- The tool plugin (`packages/core/src/tool/plugin/nmap.ts`) builds a typed argv from the input schema, runs the binary with a wall-clock timeout, parses the JSON report (schema 1.0), and returns it as the structured `output` plus a human-readable summary as model content.
- Binary resolution order: `CODESHOD_RNMAP_BIN` env → `<cli assets>/rnmap/bin/rnmap-<platform>-<arch>` → `<codeshod executable dir>/rnmap` → `/usr/lib/codeshod/rnmap` → `rnmap` on `PATH`. Rhai script directory follows the same precedence with `CODESHOD_RNMAP_SCRIPTS`.
- The scanner auto-falls back from raw-socket scans (SYN/ACK/FIN/Xmas/Null, OS fingerprint) to TCP connect scan when run without root or `CAP_NET_RAW`. The fallback warning surfaces as a second model content item.
- Permissions assert `action: "nmap"` against the comma-joined target list as `resources`, with the full scan shape in `metadata`. Repository rules typically allow RFC1918 and localhost; external targets require approval.
- The tool is not exposed in Code Mode (`options.codemode: false`) because it is a network action tool, not a read-only filesystem operation.
- When extending the tool: keep the typed input surface narrow. Do not add a free-form `extraArgs` string field — it would break JSON parsing guarantees and bypass permission metadata.
- Source for the Rust binary lives outside this monorepo at `https://github.com/reddata997327/codeshod` `packages/process-daemon` sibling project; rebuilds land in `packages/cli/assets/rnmap/bin/` via the release workflow. See `packages/cli/assets/rnmap/README.md` for the rnmap CLI reference.

## Built-in `msfx` tool

- The `msfx` tool is a first-party built-in, registered under plugin id `codeshod.tool.msfx` in `packages/core/src/plugin/internal.ts`. It is NOT an MCP server and NOT a shell-out to system `metasploit-framework`. The framework is a pure-Rust binary (`msfx`) shipped under `packages/cli/assets/msfx/bin/msfx-<platform>-<arch>` (674 KB stripped, no C deps, std-only + serde).
- The tool plugin (`packages/core/src/tool/plugin/msfx.ts`) exposes a single `operation` parameter (`modules.list` | `module.info` | `module.run` | `payload.generate` | `pattern.create` | `pattern.offset` | `search`) and builds the right argv for each: `msfx modules --json`, `msfx -q -x "use M; set K V; ...; run; exit"`, `msfx venom -p P -f F -L H -P P`, `msfx tools pattern-create N`, or `msfx -q -x "search K; exit"`.
- The tool does NOT expose `msfx rpc` (the long-lived JSON-lines RPC server). It cannot be kept alive across tool calls. Every action is one-shot through `console -q -x "..."` or the `venom`/`tools`/`modules` subcommands.
- Binary resolution order: `CODESHOD_MSFX_BIN` env → `<cli assets>/msfx/bin/msfx-<platform>-<arch>` → `<codeshod executable dir>/msfx` → `/usr/lib/codeshod/msfx` → `msfx` on `PATH`.
- Shell escaping: the `-x` argument is wrapped in OUTER double quotes for the spawning shell. Inside those quotes, single quotes are NOT special, so option values must NOT be single-quoted (a value like `'22,80,443'` would be passed to the msfx console as a literal with embedded single quotes and break `parse_ports`). Use `escapeForDoubleQuoted` instead, which escapes only `"`, `$`, `` ` ``, `\`, `!` — the characters that are special inside a double-quoted shell string.
- Permissions assert `action: "msfx"` against an operation-specific resource: the module name for `module.run`/`module.info`, the payload name for `payload.generate`, the keyword for `search`, the operation name otherwise. The full `options` object is included in `metadata` so approval prompts show the user exactly what will run (RHOSTS, PORTS, LHOST, LPORT, etc.).
- Exit codes: `0` ok, `1` generic error, `2` unknown command / bad args. The tool does NOT fail on exit 1 or 2 — the agent still gets stdout/stderr to reason about. Only timeout and process-spawn failures fail at the `runMsfx` layer.
- The tool is not exposed in Code Mode (`options.codemode: false`) — it is a network exploitation tool, not a read-only filesystem operation.
- Source for the Rust binary lives in the `rustmsf` upstream project; rebuilds land in `packages/cli/assets/msfx/bin/` via the release workflow. See `packages/cli/assets/msfx/README.md` for the msfx CLI reference.

## Built-in `shark` tool

- The `shark` tool is a first-party built-in, registered under plugin id `codeshod.tool.shark` in `packages/core/src/plugin/internal.ts`. It is NOT an MCP server and NOT a shell-out to system `tshark`/`wireshark`. The analyzer is a pure-Rust binary (`shark`) shipped under `packages/cli/assets/shark/bin/shark-<platform>-<arch>` (1.1 MB stripped, no C deps, std-only + serde + nom + chrono + clap + libc).
- The tool plugin (`packages/core/src/tool/plugin/shark.ts`) exposes a single `operation` parameter (`tshark` | `protocol_hierarchy` | `conversations` | `capinfos` | `captype` | `editcap` | `mergecap` | `reordercap` | `dumpcap` | `randpkt` | `list_fields`) and builds the right argv for each: `shark tshark --read F -Y FILTER -e FIELD -c N`, `shark capinfos --file F`, `shark editcap --input I --output O -s 64 -d --start 1 --count 50`, `shark mergecap --inputs A B --output O`, `shark randpkt --output O -c 10 -t dns -S 42`, etc.
- The tool does NOT expose `sharkd-mcp` (the long-lived JSON-RPC stdio server). The MCP crate was removed from the upstream workspace during integration — `crates/shark-mcp/` no longer exists. Every action is one-shot through the `shark <subcommand>` CLI.
- Binary resolution order: `CODESHOD_SHARK_BIN` env → `<cli assets>/shark/bin/shark-<platform>-<arch>` → `<codeshod executable dir>/shark` → `/usr/lib/codeshod/shark` → `shark` on `PATH`. Samples directory follows the same precedence with `CODESHOD_SHARK_SAMPLES`.
- Ten real Wireshark sample captures are bundled at `packages/cli/assets/shark/samples/` (arp.pcap, dhcp.pcap, dhcp.pcapng, dhcp_big_endian.pcapng, dhcp-nanosecond.pcap, dns-mdns.pcap, dns_port.pcap, http.pcap, icmp_ascii.pcapng, ipv6.pcap). Use `useSample: "http.pcap"` to resolve one from the bundled dir; otherwise pass `file: "/abs/path.pcap"`.
- Permissions assert `action: "shark"` against an operation-specific resource: the file path for read ops, the output path for write ops, the operation name for read-only ops (`list_fields`). The full operation shape is in `metadata`.
- Exit codes: `0` ok, `1` error (file not found, bad filter, AF_PACKET permission, etc.). The tool does NOT fail the call on exit 1 — the agent still gets stderr to reason about. Only timeout and process-spawn errors fail at the `runShark` layer.
- The tool is not exposed in Code Mode (`options.codemode: false`) — it is a network packet analysis tool, not a read-only filesystem operation. (Read-only pcap analysis is safe, but live capture is not, so the whole tool is excluded from Code Mode for consistency with nmap/msfx.)
- Supported protocols: Ethernet, VLAN, ARP, IPv4, IPv6, TCP, UDP, ICMP, ICMPv6, DNS, mDNS, LLMNR, HTTP. ~110 dissectable fields — use `operation: "list_fields"` to enumerate.
- Live capture (`dumpcap`) is Linux AF_PACKET only and requires root or `CAP_NET_RAW`. Without privileges it fails gracefully with a clear error message. Reading and analyzing capture files is unprivileged and works everywhere.
- Source for the Rust binary lives in the `shark-rs` upstream project; rebuilds land in `packages/cli/assets/shark/bin/` via the release workflow. See `packages/cli/assets/shark/README.md` for the shark CLI reference.

## Built-in `rustango` tool

- The `rustango` tool is a first-party built-in, registered under plugin id `codeshod.tool.rustango` in `packages/core/src/plugin/internal.ts`. It is NOT an MCP server and NOT a shell-out to system `django-admin`/`manage.py`. The framework is a pure-Rust binary (`rustango`) shipped under `packages/cli/assets/rustango/bin/rustango-<platform>-<arch>` (2.3 MB stripped, no C deps, std-only + tokio + axum + serde + RustCrypto + chrono + uuid + flate2 + thiserror).
- **Only the stripped binary is bundled** — the rustango source is intentionally NOT in the codeshod tree. Rebuilds land in `packages/cli/assets/rustango/bin/` via the release workflow from the upstream `rustango` project.
- The tool plugin (`packages/core/src/tool/plugin/rustango.ts`) exposes a single `operation` parameter (`version` | `help` | `check` | `startproject` | `startapp` | `makemigrations` | `migrate` | `showmigrations` | `createsuperuser` | `clearsessions` | `runserver`) and builds the right argv for each: `rustango check`, `rustango startproject NAME DIR`, `rustango makemigrations core`, `rustango createsuperuser -u NAME -p PW`, `rustango runserver 127.0.0.1:8000`, etc.
- Binary resolution order: `CODESHOD_RUSTANGO_BIN` env → `<cli assets>/rustango/bin/rustango-<platform>-<arch>` → `<codeshod executable dir>/rustango` → `/usr/lib/codeshod/rustango` → `rustango` on `PATH`.
- Env overrides: `database` and `migrationsDir` input fields translate to `RUSTANGO_DB` and `RUSTANGO_MIGRATIONS_DIR` env vars on the subprocess. Use `database: "memory"` (default, ephemeral) or `database: "json:/path/to/db.json"` (persistent JSON-file backend).
- Permissions assert `action: "rustango"` against an operation-specific resource: project name for `startproject`, app name for `startapp`, username for `createsuperuser`, bind address for `runserver`, operation name for read-only ops. The full operation shape is in `metadata`. **The password for `createsuperuser` is intentionally NOT included in metadata** — it is passed to the subprocess via argv (the only way rustango accepts it) but it is not logged in approval prompts.
- Exit codes: `0` ok, `1` server error or scaffold failure, `2` unknown command or bad args. The tool does NOT fail the call on exit 1 or 2 — the agent still gets stdout/stderr to reason about. Only timeout and process-spawn errors fail at the `runRustango` layer.
- The tool is not exposed in Code Mode (`options.codemode: false`) — it scaffolds projects and runs dev servers, not a read-only filesystem operation.
- Timeout defaults: 30 s for one-shot commands, 15 s for `runserver` (max 60 s for runserver, max 300 s for everything else). When `runserver` hits the timeout, the tool treats it as success with whatever output was captured — the dev server is expected to run until killed.
- For continuous dev server work, the user should run rustango directly in a terminal. The tool is best used for: scaffolding, management commands, and quick "does this project boot?" smoke tests.
- Auth hashes are Django-compatible PBKDF2-SHA256 in `pbkdf2_sha256$<iter>$<salt>$<base64 digest>` wire format — a hash produced by Django's `make_password()` verifies here and vice versa.

## Built-in `rocc` tool

- The `rocc` tool is a first-party built-in, registered under plugin id `codeshod.tool.rocc` in `packages/core/src/plugin/internal.ts`. It is NOT an MCP server and NOT a shell-out to any external tool. rocc is a pure-Rust registry of offensive security primitives, chains, harnesses, products, and build tools — **7 binaries** shipped under `packages/cli/assets/rocc/bin/` (2.8 MB total, **zero external dependencies**, every crate is std-only).
- **Only the stripped binaries are bundled** — the rocc source is intentionally NOT in the codeshod tree. Rebuilds land in `packages/cli/assets/rocc/bin/` via the release workflow from the upstream `rocc` project.
- The tool plugin (`packages/core/src/tool/plugin/rocc.ts`) exposes a `binary` selector (`rocc-substrate` | `rocc-primitives` | `rocc-compose` | `rocc-conformance` | `rocc-products` | `rocc-tools` | `rocc-bench`) plus `subcommand` and `args`. The plugin resolves the binary path, builds the argv, runs the subprocess with a wall-clock timeout, and returns the parsed output.
- Binary resolution: `CODESHOD_ROCC_BIN_DIR` env → `<cli assets>/rocc/bin` → `<codeshod executable dir>/rocc-bin` → `/usr/lib/codeshod/rocc-bin`. Each binary is looked up as `<name>-<platform>-<arch>` first, then plain `<name>`.
- Permissions assert `action: "rocc"` against the binary name as the resource. The full operation shape (binary, subcommand, args) is in `metadata`. Repository rules typically allow all read-only operations (substrate, primitives, compose, conformance, products list/demo, tools targets/emit) and ask before write operations (tools pack/obf, bench write).
- Exit codes: `0` ok, `1` conformance failure (a primitive is not "done" — meaningful information from rocc-conformance), `2` unknown command / bad args. The tool does NOT fail the call on any of these — the agent still gets stdout/stderr to reason about.
- The tool is not exposed in Code Mode (`options.codemode: false`) — it is an offensive security research tool, not a read-only filesystem operation.
- Timeout defaults: 30 s default, 300 s max. The conformance gate may take longer (up to ~15 s for the full LLL lattice reduction in the ecdsa-nonce primitive); bump the timeout if needed.
- **Authorized security research and education only.** The rocc primitives prove bounds (nonce-reuse key recovery, CL/TE desync, JWT alg:none forgery, race-window success probability, k-anonymity breaches); they do not attack targets. The AMBIGUITY ledger (rocc-substrate) is reference material with RFC citations.

## Built-in `enigma` tool

- The `enigma` tool is a first-party built-in, registered under plugin id `codeshod.tool.enigma` in `packages/core/src/plugin/internal.ts`. It is NOT an MCP server and NOT a shell-out to any external unpacker. enigma-rs is a pure-Rust static unpacker and devirtualizer for the Enigma Protector packer — a single binary shipped under `packages/cli/assets/enigma/bin/enigma-rs-<platform>-<arch>` (9.1 MB stripped, std-only + anyhow + clap + crc32fast + iced-x86 + indicatif + md5 + optional cubecl CUDA/WGPU backends).
- **Only the stripped binary is bundled** — the enigma-rs source is intentionally NOT in the codeshod tree. Rebuilds land in `packages/cli/assets/enigma/bin/` via the release workflow from the upstream `enigma_rs` project.
- The tool plugin (`packages/core/src/tool/plugin/enigma.ts`) exposes an `operation` parameter (`unpack` | `runtime` | `scan` | `devirt`) plus `input`, `rva`, `output`, `backend`, `timeout`. The plugin resolves the binary path, builds the argv, runs the subprocess, and returns the parsed output.
- Binary resolution order: `CODESHOD_ENIGMA_BIN` env → `<cli assets>/enigma/bin/enigma-rs-<platform>-<arch>` → `<codeshod executable dir>/enigma-rs` → `/usr/lib/codeshod/enigma-rs` → `enigma-rs` on `PATH`.
- **x86 (32-bit PE) only — x64 not supported.** The bundled binary is built WITHOUT CUDA support (the codeshod sandbox has no NVIDIA GPU). The WGPU backend is included but requires a compatible GPU + driver at runtime. The CPU backend always works but is slow (2³² keyspace takes hours-to-days per binary).
- Permissions assert `action: "enigma"` against the input file path (read) or output path (write). For `unpack`, the "output" is the adjacent `unpack/` directory, so the input path is the resource. For `devirt`, the metadata includes the RVA so approval prompts show which function is being lifted.
- Exit codes: `0` ok, `1` error (bad args, PE parse failure, unpack failure, devirt failure). The tool does NOT fail the call on exit 1 — the agent still gets stdout/stderr to reason about. Only timeout and process-spawn errors fail at the `runEnigma` layer.
- Timeout defaults: 30 s default / 300 s max for read ops (scan, runtime, devirt); 10 min default / 30 min max for unpack (the salt search is expensive even on GPU).
- The tool is not exposed in Code Mode (`options.codemode: false`) — it unpacks protected binaries, not a read-only filesystem operation.
- **Authorized use only.** Only unpack binaries you own or have explicit written permission to analyze. Unpacking protected software you do not own may violate copyright or anti-circumvention laws (DMCA §1201 in the US, similar laws elsewhere). The tool is for security research, malware analysis, and reverse-engineering education.

## Session Core

- Keep durable events minimal: record irreducible new facts and do not repeat state derivable by folding the ordered aggregate history. Enrich projections and read models with previous or derived state when consumers need self-contained views.
- Keep durable prompt admission separate from model execution. `Session.prompt(...)` publishes `session.inbox.enqueued`, whose projection inserts one durable `session_inbox` row, before scheduling advisory `SessionExecution.wake(sessionID)` unless `resume: false` requests admit-only behavior. Delivery publishes `session.inbox.delivered`; its projection consumes the inbox row and inserts the visible message in the same transaction. `session_inbox` stores only unconsumed work.
- Reusing a Session ID adopts the existing Session. Reusing a user or synthetic inbox item ID is idempotent when Session and type match: the first admission wins and the retried payload, metadata, and delivery mode are ignored, whether the item is still pending or already delivered (reconciled from the projected message without retained enqueue history). Cross-Session or cross-type reuse fails. Control items keep their operation-specific conflict behavior.
- Keep `SessionExecution` process-global and Session-ID based. Its local implementation owns the process-local Session coordinator and discovers placement through `SessionStore` plus `LocationServiceMap.get(session.location)` only when a drain starts; no layer should take a Session ID. Interruption targets the active process-local ownership chain for that Session; interruption of a known but idle or locally unowned Session is a no-op, while the public API rejects an unknown Session.
- Keep `SessionRunner`, model resolution, tool registry, permissions, and filesystem Location-scoped. Omitted `Location.workspaceID` means implicit-local placement; explicit workspace identity remains reserved for future placement semantics.
- Each step is one explicit `llm.stream` call that continues from reloaded history. Do not add an in-memory tool loop.
- Keep local Session drains process-local until clustering is implemented. `SessionRunCoordinator` joins explicit same-Session resumes, coalesces prompt wakeups, and allows different Sessions to run concurrently. A write-ahead execution claim marks a process-local busy period for restart recovery: terminal completion, failure, or user interruption releases it, while shutdown interruption and process death preserve it. Startup recovery resumes claimed Sessions with durable per-execution attempt accounting. Running subagent Jobs own recovery of the children they represent. The claim is a recovery marker, not clustered ownership, fencing, or an exactly-once guarantee.
- Keep delivery vocabulary explicit. Prompts steer by default. At safe step boundaries, steered compaction takes priority up to the first steered move control; other steers retain enqueue order. At an idle boundary, steers take priority; otherwise exactly one queued item delivers before the runner reevaluates continuation. Inbox items may be cancelled or changed between queue and steer before delivery. Promoting new user input resets the selected agent's step allowance; a batch of steers resets it once.
- One step is one logical LLM call; its durable record covers only the model-visible span. Do not write "provider turn", and do not use bare "turn" for a single call: "turn" is reserved for the future assistant-turn unit containing all steps from prompt promotion until the session would go idle.
- Keep event replay ownership separate from clustered Session execution ownership.
