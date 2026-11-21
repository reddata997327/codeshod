# V2 Tools

Status: **Current semantic overview.** The Plugin package owns the public tool type; Core owns registration, execution, and generic output bounding.

## Tools

V2 has one structural tool value for locally executable tools. Typed tools declare schemas and execution together:

```ts
const read = Tool.make({
  description: "Read a file",
  input: Schema.Struct({ path: Schema.String }),
  output: Schema.Struct({ content: Schema.String }),
  execute: ({ path }, context) =>
    readFile(path, context).pipe(Effect.map((output) => ({ output, content: output.content }))),
})
```

One tool response may carry three values: the declared, schema-validated `output` is the ephemeral machine value Code Mode receives; `content` is the model-facing value stored durably; and optional `metadata` is compact JSON for tool-specific UI. A tool without `output` intentionally returns only model-visible `content` and optional `metadata`. Dynamic MCP and manifest tools use the same tool shape with runtime JSON Schema.

Built-ins and statically authored plugin tools use this same constructor and execution contract.

`Tool.Tool` is a transparent structural value with exactly one `execute` function. Effect schemas and schemas implementing both Standard Schema V1 and Standard JSON Schema V1 are accepted. The Tool module derives inert model-facing `LLM.ToolDefinition` values and executes tools for the registry; callers normally rely on `Tool.make` inference rather than naming the nested type.

Standard input schemas validate model input into the tool input. Standard output schemas validate the tool response's `output` into the Code Mode machine value. Effect codecs retain their native decode-input and encode-output directions.

Input and output codecs are self-contained. Schema conversion cannot require services. Tool dependencies are acquired during construction and captured by `execute`.

## Every Call Has Durable Identity

Every local tool receives the same concrete invocation context:

```ts
interface Tool.Context {
  readonly sessionID: Session.ID
  readonly agent: Agent.ID
  readonly messageID: SessionMessage.ID
  readonly callID: string
  readonly progress: (update: Progress) => Effect.Effect<void>
}
```

`messageID` is the durable ID of the assistant message containing the call. The Session runner owns this association and supplies the complete context to the registry; the registry does not infer it. `callID` carries the same invocation identifier durable events use.

Decoded tool input is passed separately to `execute`. Raw provider input and domain services do not belong in the invocation context.

Effect interruption is the cancellation mechanism. Tools may translate expected typed failures into `ToolFailure`, but must not translate interruption or defects into model-visible failures.

## Registrations Are Scoped

Tools are named when registered:

```ts
yield *
  tools.register({
    read,
    write,
    grep,
  })
```

The record key is the authored name. Registration normalizes it before deriving the effective model-facing name. A reusable tool value has no intrinsic name.

```ts
interface Tools {
  readonly register: (
    tools: Readonly<Record<string, Tool.Any>>,
    options?: Tool.RegisterOptions,
  ) => Effect.Effect<void, Tool.RegistrationError, Scope.Scope>
}
```

Registration replaces unsupported name characters with `_` and reserves `execute` for Code Mode.

A Location plugin receives only the narrow `Tools` registration capability, not the internal registry. Each activation acquires the Location's services, constructs its tools, and registers them in a fresh plugin-owned Scope.

Within one placement:

- The latest active registration for a name wins.
- Closing a registration removes only that registration.
- Closing the winner reveals the next-latest active registration.
- Mutating the caller's registration record later does not change the captured registration.

## Built-Ins Use The Same Contract

Built-ins use the same tool API while capturing trusted Location services:

```ts
const filesystem = yield * FileSystem.Service
const permission = yield * PermissionV2.Service
const tools = yield * Tools.Service

yield *
  tools.register({
    grep: Tool.make({
      description: "Search file contents",
      input: Input,
      output: Output,
      execute: (input, context) =>
        Effect.gen(function* () {
          const root = yield* filesystem.resolveRoot(input)

          yield* permission.assert({
            sessionID: context.sessionID,
            agent: context.agent,
            source: {
              type: "tool",
              messageID: context.messageID,
              callID: context.callID,
            },
            action: "grep",
            resources: [input.pattern],
            save: ["*"],
            metadata: { root: root.resource },
          })

          return yield* filesystem.grep(input, root)
        }).pipe(/* translate expected typed errors to ToolFailure */),
    }),
  })
```

Trusted tools formulate and sequence permission requests. `PermissionV2` evaluates policy and manages approval. The registry does not inject an `assertPermission` helper.

Sharing a tool type does not imply equal authority. Built-ins and trusted Location plugins may capture services that are not available to application tools.

## Requests Capture Tool Values

The Location-scoped registry owns effective lookup and execution through one request-scoped snapshot pairing advertised LLM definitions with captured tools. For each local call it:

1. Resolves one effective named registration.
2. Decodes provider input with the input codec.
3. Executes the tool with the runner-supplied context.
4. Encodes the returned output with the output codec; the encoded value is the ephemeral machine output for Code Mode.
5. Normalizes the tool response into canonical non-empty model content and optional JSON metadata.
6. Bounds the model content; validates metadata, dropping invalid or oversized values with a warning rather than failing the call.
7. Runs `execute.after` hooks with the canonical outcome and managed output paths.
8. Returns one `ToolOutcome` — completed with output, content, and optional metadata, or an error with an optional final partial snapshot — to the runner for durable publication.

Invalid input never executes the tool. Invalid output never produces a successful execution.

When an output-bearing tool omits `content`, an encoded string becomes one text item and any other encoded JSON is serialized once. A tool without `output` must provide non-empty model content.

Each model request captures the effective registration for every advertised name. Execution uses those captured tools; later registration changes affect later requests. Unknown, hook-removed, and final-Step calls fail individually through the same execution seam; the final Step retains tool definitions with `toolChoice: "none"` where the provider supports it so the cached prompt prefix survives.

Durable terminal events are self-contained: success stores exactly the non-empty model content plus optional metadata; failure stores one error plus the final bounded snapshot of partial progress. Provider replay derives its wire value from canonical content; provider-hosted payloads that a protocol requires verbatim live in provider-owned result state, never in a generic result field.

## Producers And The Registry Own Different Limits

Producers may cap capture or spool data before a complete tool result exists. For example, a process tool may retain output it cannot keep in memory. Producer limits must report their own loss accurately; they are separate from registry bounding and cannot claim to reconstruct bytes already discarded.

After tool execution, the registry bounds the model content sent to the provider: only textual parts are measured, native media remains unchanged under producer-owned limits, and the default cut keeps a head-plus-tail split with the omission marker in the middle. Oversized text is retained in managed storage and replaced with a bounded preview; if complete retention fails, execution fails operationally rather than publishing lossy success. Metadata is validated and measured independently and never becomes an unbounded side channel. Managed paths never appear in `Tool.make` or tool output schemas solely for retention bookkeeping.

`execute.after` hooks receive the canonical bounded outcome and its internal managed paths. Hooks may deliberately transform that outcome; changed content is normalized and bounded again before publication.

## Failures Preserve Interruptions

Outcomes remain distinct:

- `ToolFailure` is an expected model-visible failure.
- Interruption cancels the invocation and is not a tool result.
- Unexpected typed errors and defects follow the runner's operational failure policy.
- Unknown and invalid calls become explicit model-visible execution errors without executing a tool.

Tools translate only errors they deliberately classify as recoverable. Broad cause-catching around `execute` is invalid because it consumes interruption and defects.

## Laws

- **Single execution:** `Tool.make(config)` can execute only `config.execute`.
- **Codec boundary:** a tool observes decoded input; Code Mode observes the validated encoded output; model content and metadata come from the tool response.
- **Canonical representation:** a completed call has exactly one stored model representation; a failed call has exactly one stored error plus at most one final partial snapshot. Every other view is derived at a named boundary.
- **Metadata opt-in:** absent response metadata produces absent metadata, never a copied output.
- **Durable identity:** invocation-owned records use the exact Session, agent, assistant message, and call IDs supplied by the runner.
- **Scoped registration:** closing a Scope removes exactly its registration and reveals any prior active overlay.
- **Captured execution:** a call executes the registered tool advertised in its model request.
- **Per-call rejection:** rejecting one unavailable call cannot fail another call.
- **Storage encapsulation:** domain output does not change according to model-output bounding or retention policy.

## Built-in Network Scanner: `nmap`

Codeshod ships with a pure-Rust nmap-compatible scanner (`rnmap`) as a first-party built-in tool — not an MCP server, not a shell-out to a system `nmap` binary. The scanner binary and its Rhai script library live under `packages/cli/assets/rnmap/` and are bundled with every Codeshod installation.

| Asset | Location | Purpose |
|-------|----------|---------|
| `rnmap-linux-x64` | `packages/cli/assets/rnmap/bin/` | Stripped release binary, single static executable |
| `*.rhai` | `packages/cli/assets/rnmap/scripts/` | 24 built-in NSE-style service probes (banner_grab, ssh_version, http_title, …) |
| `README.md` | `packages/cli/assets/rnmap/` | Full rnmap CLI reference (also served at `codeshod.ai/docs/tools/nmap`) |

The tool plugin at `packages/core/src/tool/plugin/nmap.ts` registers the `nmap` built-in under plugin id `codeshod.tool.nmap`. It is wired into the internal pre-plugin list in `packages/core/src/plugin/internal.ts`, so it activates automatically in every Location and is advertised to the model on every session that has it allowed.

### Binary resolution order

The tool resolves the binary path at runtime, trying candidates in order:

1. `CODESHOD_RNMAP_BIN` env override (for packagers / dev worktrees).
2. `<cli assets>/rnmap/bin/rnmap-<platform>-<arch>` — source-tree location.
3. `<codeshod executable dir>/rnmap` — installed location (single-binary deploy).
4. `/usr/lib/codeshod/rnmap` — system install location.
5. `rnmap` on `PATH` — fallback for distro-packaged binaries.

The Rhai script directory follows the same precedence with `CODESHOD_RNMAP_SCRIPTS` and the parallel `rnmap-scripts` subdirectories.

### Input surface

The tool exposes a typed subset of the rnmap CLI — enough knobs to tune scans (targets, ports, scan type, timing, scripts, profile, TLS probe, reason detail, max-rate, NDJSON) without exposing arbitrary flag passing that could break JSON parsing. The full list is in `packages/core/src/tool/plugin/nmap.ts` `Input` schema.

### Output contract

The tool always returns the parsed rnmap JSON report (schema 1.0) as the structured `output` field, plus a human-readable `summary` as model content and a compact `metadata` object (`exitCode`, `binary`, `hostCount`, `hostsUp`, `portsOpen`, `elapsedMs`). When `ndjson: true` is requested, the tool collects the streamed host lines and final stats line and reconstructs the same JSON report shape internally.

### Permission model

Each call asserts `action: "nmap"` against the comma-joined target list as `resources`. Repository rules typically allow RFC1918 ranges and `localhost`, and ask before scanning external targets. The metadata object records every scan-shape parameter (scan type, timing, ports, scripts, profile, TLS, OS detection, traceroute, etc.) so approval prompts can show the user exactly what will run.

### Capability fallback

Raw-socket scans (SYN/ACK/FIN/Xmas/Null), OS fingerprinting, and ICMP-based host discovery require root or `CAP_NET_RAW`. When unavailable, the scanner auto-falls back to TCP connect scan and emits a warning to stderr (which the tool surfaces as a second model content item, truncated to 4 KB). The capability list in `report.scanner.capabilities` always reflects the compiled-in feature set, not the runtime privilege level.

### Exit codes

| Code | Meaning | Tool behavior |
|------|---------|---------------|
| 0 | OK — all targets up | Return parsed report |
| 1 | No targets up | Return parsed report (still has `hosts` with `state: "down"`) |
| 2 | Partial scan (some targets down) | Return parsed report |
| 3 | Generic error | `ToolFailure` with stderr |
| 4 | Bad arguments | `ToolFailure` with stderr |

### Code Mode

The `nmap` tool is not exposed in Code Mode (`options.codemode: false`) because it is a network action tool, not a read-only filesystem operation.

## Built-in Metasploit-style framework: `msfx`

Codeshod ships with `msfx`, a pure-Rust Metasploit-style exploitation framework, as a first-party built-in tool — NOT an MCP server, NOT a shell-out to system `metasploit-framework`. The stripped release binary lives at `packages/cli/assets/msfx/bin/msfx-<platform>-<arch>` (674 KB, std-only + serde, no C deps) and is bundled with every Codeshod installation.

| Asset | Location | Purpose |
|-------|----------|---------|
| `msfx-linux-x64` | `packages/cli/assets/msfx/bin/` | Stripped release binary, single static executable |
| `README.md` | `packages/cli/assets/msfx/` | Full msfx CLI reference (subcommands, modules, RPC protocol, payload formats) |

The tool plugin at `packages/core/src/tool/plugin/msfx.ts` registers the `msfx` built-in under plugin id `codeshod.tool.msfx`. It is wired into the internal pre-plugin list in `packages/core/src/plugin/internal.ts`, so it activates automatically in every Location and is advertised to the model on every session that has it allowed.

### Operation surface

The tool exposes a single `operation` parameter that selects one of seven sub-operations, each mapped to the right msfx subcommand:

| Operation | msfx subcommand | Purpose |
|-----------|-----------------|---------|
| `modules.list` | `msfx modules [--type T] --json` | List every module (or filter by type) |
| `module.info` | `msfx -q -x "use M; info; exit"` | Inspect one module's options |
| `module.run` | `msfx -q -x "use M; set K V; ...; run; exit"` | Execute a module with options |
| `payload.generate` | `msfx venom -p P -f F -L H -P P [K=V ...]` | Generate a reverse/bind shell payload |
| `pattern.create` | `msfx tools pattern-create N` | Metasploit cyclic pattern |
| `pattern.offset` | `msfx tools pattern-offset NEEDLE [MAX]` | Find offset of a captured EIP value |
| `search` | `msfx -q -x "search KW; exit"` | Keyword search over module names/titles/descriptions |

### Built-in modules (9)

| Module | Type | What it does |
|--------|------|--------------|
| `auxiliary/scanner/portscan/tcp` | scanner | concurrent TCP connect scan, thread pool |
| `auxiliary/gather/banner_grab` | scanner | greeting/probe banner capture for any TCP service |
| `auxiliary/scanner/http/http_version` | scanner | HTTP status + Server/X-Powered-By fingerprint |
| `auxiliary/scanner/ssh/ssh_version` | scanner | SSH identification banner |
| `auxiliary/handler/reverse_tcp` | handler | accepts reverse connections, registers sessions |
| `exploit/lab/stack_overflow_template` | exploit | lab-only BOF template, exploit→payload pipeline |
| `payload/single/reverse_tcp` | payload | reverse shell gen: sh / python / rust / bytes |
| `payload/single/bind_tcp` | payload | bind shell gen: sh / python / rust / bytes |
| `encoder/generic/xor` | encoder | demonstrates the encoder interface |

### What is NOT exposed

The `msfx rpc` JSON-lines TCP server is intentionally NOT exposed through this tool. It is a long-lived listener that cannot be kept alive across tool calls in an agent-driven session. The tool drives every action through one-shot subprocess invocations (`msfx modules --json`, `msfx venom -p ...`, `msfx -q -x "use ...; set ...; run; exit"`, `msfx tools pattern-create N`).

For long-lived handlers (e.g. `auxiliary/handler/reverse_tcp` with `WAIT_SEC > 30`), set up the handler outside the agent loop or accept that the tool call blocks for the wait duration.

### Shell escaping

The `-x` argument is wrapped in OUTER double quotes for the spawning shell. Inside double quotes, single quotes are NOT special — so option values must NOT be single-quoted (a value like `'22,80,443'` would be passed to the msfx console as a literal with embedded single quotes and break `parse_ports`). The tool uses `escapeForDoubleQuoted` which escapes only `"`, `$`, `` ` ``, `\`, `!` — the characters that are special inside a double-quoted shell string. Other characters (commas, slashes, colons, dots) pass through unchanged.

### Binary resolution order

Same precedence as the nmap tool, with `CODESHOD_MSFX_BIN` env override and the `msfx-<platform>-<arch>` per-platform naming convention.

### Output contract

The tool always returns a JSON object with shape `{ operation, ok, summary, data, log[], raw }`:

- `operation` — the operation that was requested (echoed back for the model)
- `ok` — boolean success indicator (exit code 0)
- `summary` — human-readable one-line summary, or the last `[*]` log line for `module.run`
- `data` — operation-specific structured payload (module list, parsed search hits, generated payload text, pattern offset, etc.)
- `log` — array of stdout lines (the console output the module produced)
- `raw` — `{ exitCode, stdout, stderr }` truncated to 16 KB / 4 KB for debugging

### Permission model

Each call asserts `action: "msfx"` against an operation-specific resource: the module name for `module.run`/`module.info`, the payload name for `payload.generate`, the keyword for `search`, the operation name otherwise. The full `options` object is included in `metadata` so approval prompts show the user exactly what will run (RHOSTS, PORTS, LHOST, LPORT, etc.). Repository rules typically allow RFC1918 ranges, localhost, and lab targets; external targets and payload generation require approval.

### Exit codes

| Code | Meaning | Tool behavior |
|------|---------|---------------|
| 0 | OK | Return parsed result |
| 1 | Generic error | Return parsed result with `ok: false` and stderr surfaced |
| 2 | Unknown command / bad args | Return parsed result with `ok: false` and stderr surfaced |

The tool does NOT fail on exit 1 or 2 — the agent still gets stdout/stderr to reason about. Only timeout and process-spawn failures fail at the `runMsfx` layer.

### Code Mode

The `msfx` tool is not exposed in Code Mode (`options.codemode: false`) because it is a network exploitation tool, not a read-only filesystem operation.

## Built-in headless Wireshark: `shark`

Codeshod ships with `shark`, a pure-Rust Wireshark-style packet capture analyzer, as a first-party built-in tool — NOT an MCP server, NOT a shell-out to system `tshark`/`wireshark`. The original `sharkd-mcp` JSON-RPC stdio server was **removed** during integration; every action is now one-shot through the `shark <subcommand>` CLI.

| Asset | Location | Purpose |
|-------|----------|---------|
| `shark-linux-x64` | `packages/cli/assets/shark/bin/` | Stripped release binary, single static executable (1.1 MB) |
| `*.pcap` / `*.pcapng` | `packages/cli/assets/shark/samples/` | Ten real Wireshark sample captures (http, dns-mdns, dhcp, arp, ipv6, icmp, …) |
| `README.md` | `packages/cli/assets/shark/` | Full shark CLI reference (subcommands, dissectors, display filter subset, field registry) |

The tool plugin at `packages/core/src/tool/plugin/shark.ts` registers the `shark` built-in under plugin id `codeshod.tool.shark`. It is wired into the internal pre-plugin list in `packages/core/src/plugin/internal.ts`, so it activates automatically in every Location and is advertised to the model on every session that has it allowed.

### Operation surface

The tool exposes a single `operation` parameter that selects one of 11 sub-operations, each mapped to the right `shark <subcommand>`:

| Operation | shark subcommand | Purpose |
|-----------|------------------|---------|
| `tshark` | `shark tshark --read F -Y FILTER -e FIELD -c N --skip M` | Read packets, apply display filter, extract fields |
| `protocol_hierarchy` | `shark tshark --read F --phs` | -z io,phs stats (packets/bytes per protocol, nested tree) |
| `conversations` | `shark tshark --read F --conversations tcp,ip` | Who-talked-to-whom stats |
| `capinfos` | `shark capinfos --file F` | File metadata: format, packet count, duration, rates, link type |
| `captype` | `shark captype --file F` | Identify capture file format |
| `editcap` | `shark editcap --input I --output O -s 64 -d --start 1 --count 50 -I` | Edit: snaplen, dedup, range selection |
| `mergecap` | `shark mergecap --inputs A B --output O` | Merge multiple captures chronologically |
| `reordercap` | `shark reordercap --input I --output O` | Sort packets by timestamp |
| `dumpcap` | `shark dumpcap --output O -i IFACE -c N -a SEC -Y FILTER -D` | LIVE capture via AF_PACKET (Linux, root/CAP_NET_RAW) |
| `randpkt` | `shark randpkt --output O -c N -t TYPE -S SEED` | Generate deterministic test packets |
| `list_fields` | `shark list-fields --prefix dns.` | Enumerate dissectable field names (~110 fields) |

### Supported protocols

Ethernet, VLAN, ARP, IPv4, IPv6, TCP, UDP, ICMP, ICMPv6, DNS, mDNS, LLMNR, HTTP. The dissectors are pure-Rust, no libpcap.

### Sample captures

Ten real Wireshark sample captures are bundled at `packages/cli/assets/shark/samples/`:

| File | Format | What it contains |
|------|--------|------------------|
| `arp.pcap` | pcap (microsecond) | Frame Relay DLT107 — opaque data, validates no false dissection |
| `dhcp.pcap` | pcap (microsecond) | DHCP over UDP |
| `dhcp-nanosecond.pcap` | pcap (nanosecond) | Same DHCP capture, nanosecond timestamps |
| `dhcp.pcapng` | pcapng | DHCP in pcapng format |
| `dhcp_big_endian.pcapng` | pcapng (big-endian) | Validates BE pcapng reader |
| `dns-mdns.pcap` | pcap (microsecond) | 587 packets — DNS, mDNS, ICMP, ICMPv6, ARP, IPv6 |
| `dns_port.pcap` | pcap (microsecond) | DNS over non-standard port |
| `http.pcap` | pcap (microsecond) | HTTP HEAD request to windowsupdate.microsoft.com |
| `icmp_ascii.pcapng` | pcapng | ICMP packets with ASCII payload |
| `ipv6.pcap` | pcap (microsecond) | IPv6 traffic |

Use `useSample: "http.pcap"` in the tool input to resolve one without an absolute path.

### What is NOT exposed

The `sharkd-mcp` JSON-RPC stdio server is intentionally NOT exposed through this tool. The `crates/shark-mcp/` directory was removed from the upstream workspace during integration. Every action is one-shot through the `shark <subcommand>` CLI.

For long-lived live capture (dumpcap with no count/duration cap), set up the capture outside the agent loop or accept that the tool call blocks for the duration.

### Binary + samples resolution order

Same precedence as the nmap/msfx tools, with `CODESHOD_SHARK_BIN` env override and the `shark-<platform>-<arch>` per-platform naming convention. Samples directory follows the same precedence with `CODESHOD_SHARK_SAMPLES`.

### Output contract

The tool always returns a JSON object with shape `{ operation, ok, summary, data, raw }`:

- `operation` — the operation that was requested (echoed back for the model)
- `ok` — boolean success indicator (exit code 0)
- `summary` — human-readable one-line summary, operation-specific (e.g. `"matched 5 of 587 packets, returned 5"` for tshark)
- `data` — the parsed JSON output from shark (packet list, stats, file info, edit counts, etc.)
- `raw` — `{ exitCode, stdout, stderr }` truncated to 32 KB / 4 KB for debugging

### Permission model

Each call asserts `action: "shark"` against an operation-specific resource: the file path for read ops (`tshark`, `capinfos`, `captype`, `protocol_hierarchy`, `conversations`), the output path for write ops (`editcap`, `mergecap`, `reordercap`, `dumpcap`, `randpkt`), the operation name for read-only ops (`list_fields`). The full operation shape is included in `metadata` so approval prompts show the user exactly what will run.

### Exit codes

| Code | Meaning | Tool behavior |
|------|---------|---------------|
| 0 | OK | Return parsed JSON with `ok: true` |
| 1 | Error (file not found, bad filter, AF_PACKET permission, etc.) | Return parsed result with `ok: false` and stderr surfaced |

The tool does NOT fail the call on exit 1 — the agent still gets stderr to reason about. Only timeout and process-spawn errors fail at the `runShark` layer.

### Code Mode

The `shark` tool is not exposed in Code Mode (`options.codemode: false`) — it is a network packet analysis tool. Read-only pcap analysis is safe, but live capture is not, so the whole tool is excluded from Code Mode for consistency with nmap/msfx.

## Built-in Django-style web framework: `rustango`

Codeshod ships with `rustango`, a pure-Rust Django-style batteries-included web framework, as a first-party built-in tool — NOT an MCP server, NOT a shell-out to system `django-admin`/`manage.py`. **Only the stripped release binary is bundled** (2.3 MB at `packages/cli/assets/rustango/bin/rustango-<platform>-<arch>`, no C deps, std-only + tokio + axum + serde + RustCrypto + chrono + uuid + flate2 + thiserror). The rustango source is intentionally NOT in the codeshod tree — rebuilds land in `packages/cli/assets/rustango/bin/` via the release workflow from the upstream `rustango` project.

The tool plugin at `packages/core/src/tool/plugin/rustango.ts` registers the `rustango` built-in under plugin id `codeshod.tool.rustango`. It is wired into the internal pre-plugin list in `packages/core/src/plugin/internal.ts`, so it activates automatically in every Location and is advertised to the model on every session that has it allowed.

### Operation surface

The tool exposes a single `operation` parameter that selects one of 11 management commands mirroring Django's `manage.py`:

| Operation | rustango subcommand | Purpose |
|-----------|---------------------|---------|
| `version` | `rustango version` | Print the framework version |
| `help` | `rustango help` | Show the help text |
| `check` | `rustango check` | Validate configuration: backend, debug, admin, models, routes, middleware |
| `startproject` | `rustango startproject NAME [DIR]` | Scaffold a new project (Cargo.toml + src/main.rs + templates/ + settings.toml) |
| `startapp` | `rustango startapp NAME [DIR]` | Scaffold a new app inside a project (models.rs + views.rs + templates/) |
| `makemigrations` | `rustango makemigrations [APP]` | Detect schema changes, write migration files |
| `migrate` | `rustango migrate [APP]` | Apply pending migrations |
| `showmigrations` | `rustango showmigrations` | List applied/pending migrations |
| `createsuperuser` | `rustango createsuperuser -u NAME -p PW` | Create or reset a superuser (Django-compatible PBKDF2-SHA256 hash) |
| `clearsessions` | `rustango clearsessions` | Purge expired sessions |
| `runserver` | `rustango runserver [ADDR]` | Start the dev HTTP server (default 127.0.0.1:8000, 15-second default timeout) |

### What rustango implements (Django-parity surface)

The rustango binary bundles the full Django architecture:

- **Settings** — builder pattern + TOML overlay (`settings.toml`)
- **URL routing** — with path converters (`<int:id>`, `<str:name>`, `<path:rest>`, etc.)
- **Views** — function views + class-based views
- **Templates** — Django Template Language (DTL) with filters
- **ORM** — model/ORM layer with migrations (in-memory or JSON-file backend)
- **Forms** — with validation
- **Sessions** — with expiration
- **Authentication** — PBKDF2-SHA256 in Django wire format (`pbkdf2_sha256$<iter>$<salt>$<base64 digest>`)
- **CSRF** — with csrf_exempt support
- **Flash messages**, **middleware** (request + response phases), **auto-generated admin site**
- **i18n catalogs**, **cache framework**, **static files**
- **Management CLI** — the 11 commands above
- **Optional contrib.ai LLM/agent module** — feature-gated, NOT in this binary (compiled without `--features ai`)

### What is NOT exposed

The rustango binary's `runserver` is a single-process dev server — **production serving is out of scope**. The tool caps `runserver` at 60 seconds per call (default 15 s) so the agent can verify a scaffolded project boots and curl an endpoint, then return. For continuous dev work, the user should run rustango directly in a terminal.

The `contrib.ai` LLM/agent module is feature-gated and NOT compiled into the bundled binary. If the user needs it, they should build rustango from source with `--features ai`.

### Binary resolution order

Same precedence as the nmap/msfx/shark tools, with `CODESHOD_RUSTANGO_BIN` env override and the `rustango-<platform>-<arch>` per-platform naming convention.

### Env overrides

The tool translates two input fields into env vars on the subprocess:

| Input field | Env var | Purpose |
|-------------|---------|---------|
| `database` | `RUSTANGO_DB` | Database spec: `memory` (default, ephemeral), `json:<path>` (persistent JSON file), or a backend URL |
| `migrationsDir` | `RUSTANGO_MIGRATIONS_DIR` | Migrations directory (default: `migrations`) |

### Output contract

The tool always returns a JSON object with shape `{ operation, ok, summary, stdout, stderr, data, raw }`:

- `operation` — the operation that was requested (echoed back for the model)
- `ok` — boolean success indicator (exit code 0)
- `summary` — human-readable one-line summary, operation-specific (e.g. `"Project scaffolded at /path/mydemo"` for startproject, `"Superuser 'root' created (pk 1)"` for createsuperuser)
- `stdout` — the raw subprocess stdout (truncated to 32 KB)
- `stderr` — the raw subprocess stderr (truncated to 4 KB)
- `data` — operation-specific structured payload (`{ projectPath }` for startproject, `{ appName, appPath }` for startapp, `{ changesDetected, migrationPath, opsCount }` for makemigrations, `{ applied: [...] }` for migrate, `{ username, pk }` for createsuperuser, `{ deleted }` for clearsessions, `{ config: {...} }` for check, etc.)
- `raw` — `{ exitCode, argv, binary }` for debugging

### Permission model

Each call asserts `action: "rustango"` against an operation-specific resource: project name for `startproject`, app name for `startapp`, username for `createsuperuser`, bind address for `runserver`, operation name for read-only ops (`version`, `help`, `check`, `makemigrations`, `migrate`, `showmigrations`, `clearsessions`). The full operation shape is included in `metadata`.

**The password for `createsuperuser` is intentionally NOT included in `metadata`** — it is passed to the subprocess via argv (the only way rustango accepts it) but it is not logged in approval prompts.

### Exit codes

| Code | Meaning | Tool behavior |
|------|---------|---------------|
| 0 | OK | Return parsed JSON with `ok: true` |
| 1 | Server error or scaffold failure | Return parsed result with `ok: false` and stderr surfaced |
| 2 | Unknown command or bad args | Return parsed result with `ok: false` and stderr surfaced |

The tool does NOT fail the call on exit 1 or 2 — the agent still gets stdout/stderr to reason about. Only timeout and process-spawn errors fail at the `runRustango` layer.

For `runserver` specifically, hitting the wall-clock timeout is the **expected** way to stop — the tool treats it as success with whatever output was captured (the dev server is designed to run until killed).

### Timeout defaults

| Operation class | Default | Max |
|-----------------|---------|-----|
| One-shot commands (version, help, check, makemigrations, migrate, showmigrations, createsuperuser, clearsessions) | 30 s | 300 s |
| Scaffolding (startproject, startapp) | 30 s | 300 s |
| `runserver` | 15 s | 60 s |

### Code Mode

The `rustango` tool is not exposed in Code Mode (`options.codemode: false`) — it scaffolds projects and runs dev servers, not a read-only filesystem operation.

## Built-in registry of offensive capability: `rocc`

Codeshod ships with `rocc`, a pure-Rust registry of offensive security primitives, chains, harnesses, products, and build tools, as a first-party built-in — NOT an MCP server, NOT a shell-out to any external tool. **Only the 7 stripped release binaries are bundled** (2.8 MB total at `packages/cli/assets/rocc/bin/`, **zero external dependencies** — every crate is std-only). The rocc source is intentionally NOT in the codeshod tree; rebuilds land via the release workflow from the upstream `rocc` project.

rocc decomposes every offensive act into irreducible primitives, each with a substrate bound (physics/math/semantics/economics) and a conformance gate. Nothing is "done" until `rocc-conformance` says so.

The tool plugin at `packages/core/src/tool/plugin/rocc.ts` registers the `rocc` built-in under plugin id `codeshod.tool.rocc`. It is wired into the internal pre-plugin list in `packages/core/src/plugin/internal.ts`, so it activates automatically in every Location and is advertised to the model on every session that has it allowed.

### Binary selector

Unlike the other built-ins (nmap/msfx/shark/rustango) which each wrap a single binary, rocc is a workspace with 7 binaries. The tool exposes a `binary` selector plus `subcommand` and `args`:

| Binary | Subcommands | Purpose |
|--------|-------------|---------|
| `rocc-substrate` | `ambiguity` | The AMBIGUITY ledger: CL/TE, double-CL, obfuscated-TE, etc. with RFC references |
| `rocc-primitives` | `list`, `demo` | List/demo the 10 irreducible primitives |
| `rocc-compose` | `list`, `smuggle`, `jwt`, `nonce-reuse` | Chains that declare primitives (smuggle plan, JWT forgery, ECDSA nonce-reuse) |
| `rocc-conformance` | `md` or empty | The validation gate — 10/10 primitives pass; the only source of truth for "is it done" |
| `rocc-products` | `list`, `smugglekit`, `phishstack`, `timing`, `signer-demo` | Usable batteries composed from chains |
| `rocc-tools` | `targets`, `emit <cross\|strip\|pack\|obf>`, `pack --in F --out F`, `obf --transform <xor-rolling\|reverse> --in F --out F` | Build layer: cross-compile matrix, strip, pack, obf transforms |
| `rocc-bench` | `write` | Measure reliability and cost (writes bench/RESULTS.md) |

### The 10 primitives (all conformance-green, reliability 1.0)

| Primitive | Family | What it proves |
|-----------|--------|----------------|
| `secp256k1` | crypto | Point ops, SEC1, ECDSA sign/verify/recover, nonce-reuse detection |
| `ecdsa-nonce` | crypto | Biased-nonce private-key recovery (HNP + exact integral LLL) |
| `sha256-merkle` | chain | SHA-256 + RFC 6962 trees, inclusion proofs, empty-tree root |
| `http-smuggle` | net | CL/TE parser differential + payload construction |
| `jwt` | identity | alg:none, HS-vs-RS confusion, kid path traversal |
| `uuid-seq` | identity | Predictable-id classification → IDOR surface |
| `data-infer` | data | k-anonymity breaches, differencing, frequency bounds |
| `mem-race` | mem | Race-window success as a function of window and attempt period |
| `evade-encode` | evade | Encoding transforms and their inverses, plus the detector |
| `cost-model` | finance | Expected value and break-even from measured reliability |

### Binary + directory resolution order

`CODESHOD_ROCC_BIN_DIR` env → `<cli assets>/rocc/bin` → `<codeshod executable dir>/rocc-bin` → `/usr/lib/codeshod/rocc-bin`. Each binary is looked up as `<name>-<platform>-<arch>` first (e.g. `rocc-primitives-linux-x64`), then plain `<name>`.

### Output contract

The tool always returns a JSON object with shape `{ binary, subcommand, ok, summary, stdout, stderr, raw }`:

- `binary` — the binary that was invoked (echoed back for the model)
- `subcommand` — the subcommand that was passed (or null)
- `ok` — boolean success indicator (exit code 0)
- `summary` — first 20 lines of stdout (truncated) plus stderr if present
- `stdout` — the raw subprocess stdout (truncated to 32 KB)
- `stderr` — the raw subprocess stderr (truncated to 4 KB)
- `raw` — `{ exitCode, argv, binaryPath }` for debugging

### Permission model

Each call asserts `action: "rocc"` against the binary name as the resource. The full operation shape (binary, subcommand, args) is in `metadata`. Repository rules typically allow all read-only operations (`rocc-substrate`, `rocc-primitives`, `rocc-compose`, `rocc-conformance`, `rocc-products list/demo`, `rocc-tools targets/emit`) and ask before write operations (`rocc-tools pack/obf`, `rocc-bench write`).

### Exit codes

| Code | Meaning | Tool behavior |
|------|---------|---------------|
| 0 | OK | Return parsed JSON with `ok: true` |
| 1 | Conformance failure (a primitive is not "done") | Return parsed result with `ok: false` — meaningful information from `rocc-conformance` |
| 2 | Unknown command / bad args | Return parsed result with `ok: false` and stderr surfaced |

The tool does NOT fail the call on exit 1 or 2 — the agent still gets stdout/stderr to reason about. Exit 1 from `rocc-conformance` specifically means "a primitive failed its checks" which is meaningful information, not a tool failure.

### Timeout defaults

| Operation class | Default | Max |
|-----------------|---------|-----|
| One-shot read commands (substrate, primitives, compose, products list/demo, tools targets/emit) | 30 s | 300 s |
| `rocc-conformance` (full LLL lattice reduction in ecdsa-nonce) | 30 s | 300 s (bump if needed) |
| `rocc-tools pack` / `obf` | 30 s | 300 s |
| `rocc-bench write` | 30 s | 300 s |

### Code Mode

The `rocc` tool is not exposed in Code Mode (`options.codemode: false`) — it is an offensive security research tool, not a read-only filesystem operation.

### Authorized use

**rocc is for authorized security research and education only.** The primitives prove bounds (nonce-reuse key recovery, CL/TE desync, JWT alg:none forgery, race-window success probability, k-anonymity breaches); they do not attack targets. The AMBIGUITY ledger (`rocc-substrate`) is reference material with RFC citations. Using rocc primitives against systems you do not own or have explicit written permission to test may be illegal.

## Built-in Enigma Protector unpacker: `enigma`

Codeshod ships with `enigma`, a pure-Rust static unpacker and devirtualizer for the Enigma Protector packer, as a first-party built-in — NOT an MCP server, NOT a shell-out to any external unpacker. **Only the stripped release binary is bundled** (9.1 MB at `packages/cli/assets/enigma/bin/enigma-rs-<platform>-<arch>`, std-only + anyhow + clap + crc32fast + iced-x86 + indicatif + md5 + optional cubecl CUDA/WGPU backends). The enigma-rs source is intentionally NOT in the codeshod tree; rebuilds land via the release workflow from the upstream `enigma_rs` project.

Enigma Protector is a commercial Windows executable protector that wraps 32-bit PE files with RC4 + IDEA-CBC section encryption, anti-debug checks, and a custom virtual machine (VM) that obfuscates the original x86 code. The `enigma` tool recovers the original PE, extracts the embedded runtime DLL, lists VM entry points, and lifts VM-protected functions back to native x86.

The tool plugin at `packages/core/src/tool/plugin/enigma.ts` registers the `enigma` built-in under plugin id `codeshod.tool.enigma`. It is wired into the internal pre-plugin list in `packages/core/src/plugin/internal.ts`, so it activates automatically in every Location and is advertised to the model on every session that has it allowed.

### Operation surface

The tool exposes a single `operation` parameter that selects one of 4 modes mirroring the `--mode` CLI flag:

| Operation | enigma-rs subcommand | Purpose |
|-----------|----------------------|---------|
| `unpack` (default) | `enigma-rs INPUT [--mod cuda\|wgpu\|cpu]` | Brute-force the 32-bit section salt, decrypt RC4 + IDEA-CBC sections, recover imports, rebuild a runnable unpacked EXE + extracted EVB files into `unpack/` next to the input |
| `runtime` | `enigma-rs INPUT --mode runtime [-o PATH]` | Extract just the embedded RVA-mapped loader DLL (the Enigma VM) |
| `scan` | `enigma-rs INPUT --mode scan [-o PATH]` | List template-VM entry point RVAs (hex addresses) |
| `devirt` | `enigma-rs INPUT --mode devirt 0xRVA [-o PATH.{asm\|bin}]` | Lift one VM entry RVA back to x86 assembly (`.asm`) or raw machine code (`.bin`) |

### What enigma-rs implements

The binary bundles four modules:

- `common/` — shared primitives: PE parser (x86 32-bit), RC4 + IDEA-CBC cipher, LZ-based codec for Enigma's section format, binary I/O helpers.
- `unpack/` — the unpacker: 32-bit salt brute-force search with three backends (CUDA via `cubecl-cuda`/`cudarc`, WGPU via `cubecl-wgpu`, CPU multi-threaded), section decryption, import table recovery, PE reconstruction, Virtual Box (EVB) extraction.
- `devirt/` — the devirtualizer: parses Enigma VM "tokens" (the bytecode format), builds a control-flow graph, performs demand-driven analysis (which VM registers map to which native registers), partitions the VM bytecode into native blocks, lifts each block to x86 via `iced-x86`, emits assembly or machine code.
- `evb/` — the Enigma Virtual Box container reader (RC4-style PRGA decryption, LZ decompression).

### What is NOT supported

- **x64 PE files.** enigma-rs only supports x86 (32-bit PE). x64 is not supported.
- **Non-Enigma packers.** Each packer (UPX, Themida, VMProtect, ASPack, etc.) has its own unpacker; enigma-rs is Enigma-specific.
- **CUDA in the bundled binary.** The codeshod sandbox has no NVIDIA GPU, so the bundled binary is built WITHOUT CUDA support. The WGPU backend is included but requires a compatible GPU + driver at runtime. The CPU backend always works but is slow (2³² keyspace takes hours-to-days per binary).
- **Execution of the unpacked binary.** The output is for static analysis only.

### Binary resolution order

`CODESHOD_ENIGMA_BIN` env → `<cli assets>/enigma/bin/enigma-rs-<platform>-<arch>` → `<codeshod executable dir>/enigma-rs` → `/usr/lib/codeshod/enigma-rs` → `enigma-rs` on `PATH`.

### Output contract

The tool always returns a JSON object with shape `{ operation, ok, summary, stdout, stderr, data, raw }`:

- `operation` — the operation that was requested (echoed back for the model)
- `ok` — boolean success indicator (exit code 0)
- `summary` — human-readable one-line summary, operation-specific (e.g. `"scan found 3 VM entry RVA(s)"` for scan, `"x86: 1024 bytes, image base=0x400000, code RVA=0x23b053"` for devirt)
- `stdout` — the raw subprocess stdout (truncated to 32 KB)
- `stderr` — the raw subprocess stderr (truncated to 4 KB) — enigma-rs writes progress here for unpack mode
- `data` — operation-specific structured payload (`{ rvas, count }` for scan, `{ bytes, imageBase, codeRva, outputPreview }` for devirt, `{ unpackDir, stderrLines }` for unpack)
- `raw` — `{ exitCode, argv, binary, binaryPath }` for debugging

### Permission model

Each call asserts `action: "enigma"` against the input file path (read) or output path (write). For `unpack`, the "output" is the adjacent `unpack/` directory, so the input path is the resource. For `devirt`, the metadata includes the RVA so approval prompts show which function is being lifted.

### Exit codes

| Code | Meaning | Tool behavior |
|------|---------|---------------|
| 0 | OK | Return parsed JSON with `ok: true` |
| 1 | Error (bad args, PE parse failure, unpack failure, devirt failure) | Return parsed result with `ok: false` and stderr surfaced |

The tool does NOT fail the call on exit 1 — the agent still gets stdout/stderr to reason about. Only timeout and process-spawn errors fail at the `runEnigma` layer.

### Timeout defaults

| Operation class | Default | Max |
|-----------------|---------|-----|
| Read ops (`scan`, `runtime`, `devirt`) | 30 s | 300 s |
| `unpack` (salt brute-force, may use GPU) | 10 min | 30 min |

### Code Mode

The `enigma` tool is not exposed in Code Mode (`options.codemode: false`) — it unpacks protected binaries, not a read-only filesystem operation.

### Authorized use

**Only unpack binaries you own or have explicit written permission to analyze.** Unpacking protected software you do not own may violate copyright or anti-circumvention laws (DMCA §1201 in the US, Article 6 of the EU Copyright Directive, similar laws elsewhere). The tool is for security research, malware analysis, and reverse-engineering education.






