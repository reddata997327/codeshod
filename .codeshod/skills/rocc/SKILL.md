---
name: rocc
description: Use when the user asks about offensive security primitives (ECDSA nonce reuse, JWT alg:none forgery, CL/TE request smuggling, Merkle proofs, race windows, k-anonymity), wants to plan an attack chain (smuggling payload, JWT forgery, timing attack, ECDSA key recovery from a corpus), wants to verify a primitive works (rocc-conformance gate), wants to pack or obfuscate a payload (xor-rolling / reverse transforms), wants the AMBIGUITY ledger of parsing/protocol/spec ambiguities, or mentions rocc, "irreducible primitives", "conformance gate", "HNP", "LLL lattice", "CL/TE desync", "alg:none", "kid path traversal", or "race-window success model". Covers all 7 binaries, the 10 primitives, when to use rocc vs nmap/msfx/shark/rustango, and the authorized-use rule.
---

# rocc — Registry of offensive capability as a built-in Codeshod tool

Codeshod ships with `rocc`, a pure-Rust registry of offensive security primitives, chains, harnesses, products, and build tools, as a first-party built-in tool. It is registered under plugin id `codeshod.tool.rocc`, exposed to the model as the `rocc` tool, and bundled with every Codeshod installation (**7 binaries, 2.8 MB total, zero external dependencies** at `packages/cli/assets/rocc/bin/`). It is NOT an MCP server and NOT a shell-out to any external tool.

**Only the stripped binaries are bundled** — the rocc source is intentionally NOT in the codeshod tree. Rebuilds land in `packages/cli/assets/rocc/bin/` via the release workflow from the upstream `rocc` project.

**Authorized security research and education only.** The rocc primitives prove bounds (nonce-reuse key recovery, CL/TE desync, JWT alg:none forgery, race-window success probability, k-anonymity breaches); they do not attack targets. Using rocc primitives against systems you do not own or have explicit written permission to test may be illegal.

rocc decomposes every offensive act into irreducible primitives, each with a substrate bound (physics/math/semantics/economics) and a conformance gate. Nothing is "done" until `rocc-conformance` says so.

## When To Use

Use the `rocc` tool when the user's intent is one of these:

- **Inspect the AMBIGUITY ledger** — parsing/protocol/spec ambiguities (CL/TE, double-CL, obfuscated-TE) with RFC references. Use binary `rocc-substrate` with subcommand `ambiguity`.
- **List or demo the 10 irreducible primitives** — what primitives exist, what they prove. Use binary `rocc-primitives` with subcommand `list` or `demo`.
- **Plan a CL/TE request smuggling attack** — Content-Length/Transfer-Encoding desync plan with strict/lax parser views and the constructed request. Use binary `rocc-compose` with subcommand `smuggle`.
- **Forge a JWT** — alg:none / HS-confusion / kid-path forgery against a verifier model. Use binary `rocc-compose` with subcommand `jwt`.
- **Demo ECDSA nonce-reuse key recovery** — two signatures sharing the same k → private key recovery. Use binary `rocc-compose` with subcommand `nonce-reuse`.
- **Run the validation gate** — verify every primitive's conformance suite passes (the only source of truth for "is it done"). Use binary `rocc-conformance` with subcommand `md` (markdown) or empty (plain table).
- **Plan multi-variant smuggling payloads** — CL.TE, TE.CL, and other variants. Use binary `rocc-products` with subcommand `smugglekit`.
- **Forge a JWT against a verifier model (product form)** — usable JWT forgery battery. Use binary `rocc-products` with subcommand `phishstack`.
- **Plan a race-window run** — success probability as a function of window and attempt period. Use binary `rocc-products` with subcommand `timing`.
- **Recover an ECDSA key from a signature corpus** — corpus classification + recovery. Use binary `rocc-products` with subcommand `signer-demo`.
- **List cross-compile targets** — the target matrix for cross-building. Use binary `rocc-tools` with subcommand `targets`.
- **Emit a build recipe** — cross/strip/pack/obf shell recipes. Use binary `rocc-tools` with subcommand `emit` with args `["cross"]` or `["strip"]` or `["pack"]` or `["obf"]`.
- **Pack a payload** — bundle a file into the rocc pack format. Use binary `rocc-tools` with subcommand `pack` and args `["--in", "/path/in", "--out", "/path/out"]`.
- **Obfuscate a payload** — apply a reversible transform (`xor-rolling` or `reverse`). Use binary `rocc-tools` with subcommand `obf` and args `["--transform", "xor-rolling", "--in", "/path/in", "--out", "/path/out"]`.
- **Measure reliability and cost** — write `bench/RESULTS.md`. Use binary `rocc-bench` with subcommand `write`.

The user said "rocc", "irreducible primitives", "conformance gate", "HNP", "LLL lattice", "CL/TE desync", "alg:none", "kid path traversal", "race-window success model", "AMBIGUITY ledger", "smuggling payload", "JWT forgery", "ECDSA nonce reuse", or "k-anonymity breach" → use this skill.

## When To Use rocc vs nmap vs msfx vs shark vs rustango

The five built-in dev/pentest tools have distinct purposes:

| Intent | Use |
|--------|-----|
| Live network scanning (port discovery, OS fingerprint, traceroute) | `nmap` |
| Metasploit-style exploitation (payloads, BOF template, encoder) | `msfx` |
| Analyze an existing pcap/pcapng capture file | `shark` |
| Scaffold or run a Django-style web framework | `rustango` |
| Study/plan offensive security primitives and chains | `rocc` |
| Verify a primitive works (conformance gate) | `rocc` |
| Get the AMBIGUITY ledger of parsing/protocol ambiguities | `rocc` |
| Pack or obfuscate a payload (xor-rolling / reverse) | `rocc` |
| Live packet capture (Linux, AF_PACKET) | `shark` (dumpcap) |

When in doubt: `nmap` for live network recon, `msfx` for exploitation, `shark` for capture file analysis, `rustango` for web app scaffolding, `rocc` for primitive research and chain planning. All five are pure-Rust, all five are first-party Codeshod built-ins, all five are bundled with every installation.

## When NOT To Use

- **Live network scanning.** Use `nmap`.
- **Exploitation with payloads.** Use `msfx`.
- **Capture file analysis.** Use `shark`.
- **Web app scaffolding.** Use `rustango`.
- **Local file reads, code search, or web fetches.** Use `read`, `grep`, or `webfetch`.
- **Code Mode sessions.** The tool is not exposed in Code Mode (read-only filesystem mode) — offensive security research is not a read-only filesystem operation.
- **Unauthorized targets.** rocc is for authorized security research and education only. The primitives prove bounds; they do not attack targets.
- **Real-world key recovery from production signatures.** The `ecdsa-nonce` primitive is a research/demonstration tool. Real-world nonce-reuse attacks require a corpus of signatures from the target system, which the user must obtain lawfully.

## The 7 Binaries

The tool exposes a `binary` selector. Pick the right one:

| Binary | Subcommands | Purpose |
|--------|-------------|---------|
| `rocc-substrate` | `ambiguity` | The AMBIGUITY ledger of parsing/protocol/spec ambiguities with RFC references |
| `rocc-primitives` | `list`, `demo` | List/demo the 10 irreducible primitives |
| `rocc-compose` | `list`, `smuggle`, `jwt`, `nonce-reuse` | Chains that declare primitives (never reimplement them) |
| `rocc-conformance` | `md` or empty | The validation gate — runs all 10 primitives' conformance suites |
| `rocc-products` | `list`, `smugglekit`, `phishstack`, `timing`, `signer-demo` | Usable batteries composed from chains |
| `rocc-tools` | `targets`, `emit <name>`, `pack`, `obf` | Build layer: cross-compile matrix, strip, pack, obf transforms |
| `rocc-bench` | `write` | Measure reliability and cost (writes bench/RESULTS.md) |

## The 10 Primitives (all conformance-green, reliability 1.0)

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
| `evade-encode` | evade | Encoding transforms (xor-rolling, reverse) and their inverses, plus the detector |
| `cost-model` | finance | Expected value and break-even from measured reliability |

## The 3 Chains (rocc-compose)

| Chain | What it composes |
|-------|------------------|
| `ecdsa-nonce-recovery` | biased/late nonce → private key (HNP) |
| `cl-te-smuggle` | Content-Length/Transfer-Encoding desync plan |
| `jwt-none-forge` | alg:none / HS-confusion / kid-path forgery |

## The 4 Products (rocc-products)

| Product | What it does |
|---------|--------------|
| `signer` | recover a key from a signature corpus |
| `phishstack` | forge a JWT against a verifier model |
| `smugglekit` | plan request-smuggling payloads (multi-variant) |
| `timing` | plan a race-window run |

## Obfuscation Transforms (rocc-tools obf)

| Transform | What it does | Inverse |
|-----------|--------------|---------|
| `xor-rolling` | XOR with the rolling key `rocc` | Same as forward (XOR is an involution) |
| `reverse` | Reverse the byte order | Same as forward |

These are the same `evade/encode` primitives — an obfuscator that reimplements XOR is an obfuscator whose inverse can drift from its forward map.

## Output Reading

The tool returns a JSON object with shape:

```jsonc
{
  "binary": "rocc-primitives",
  "subcommand": "demo",
  "ok": true,
  "summary": "rocc rocc-primitives demo: exit 0\nCL/TE desync: true\nmerkle root: 6d8952...\n...",
  "stdout": "CL/TE desync: true\nmerkle root: 6d8952b801c359ada001e53986cdb1f087fdad5f800cce66f702e406fa873b18\n...",
  "stderr": "",
  "raw": { "exitCode": 0, "argv": "demo", "binaryPath": "/path/to/rocc-primitives-linux-x64" }
}
```

The `summary` field contains the first 20 lines of stdout (truncated) plus stderr if present — enough for the model to reason about the result without parsing the full stdout.

## Exit Codes

| Code | Meaning | Tool behavior |
|------|---------|---------------|
| 0 | OK | Return parsed JSON with `ok: true` |
| 1 | Conformance failure (a primitive is not "done") | Return parsed result with `ok: false` — meaningful information from `rocc-conformance` |
| 2 | Unknown command / bad args | Return parsed result with `ok: false` and stderr surfaced |

The tool does NOT fail the call on exit 1 or 2 — the agent still gets stdout/stderr to reason about. Exit 1 from `rocc-conformance` specifically means "a primitive failed its checks" which is meaningful information, not a tool failure.

## Recommended Workflows

### 1. Discover what rocc contains

User: "what primitives does rocc have?"

```
rocc({ binary: "rocc-primitives", subcommand: "list" })
rocc({ binary: "rocc-compose", subcommand: "list" })
rocc({ binary: "rocc-products", subcommand: "list" })
```

### 2. Demo every primitive

User: "show me how the primitives work"

```
rocc({ binary: "rocc-primitives", subcommand: "demo" })
```

This exercises: CL/TE desync detection, Merkle root + proof verification, JWT alg:none forgery + classification, ECDSA nonce-reuse key recovery, XOR roundtrip.

### 3. Run the validation gate

User: "are all primitives passing?"

```
rocc({ binary: "rocc-conformance" })
```

Returns 10 PASS lines + "--- 10/10 primitives pass ---" summary. Exit 0 if all pass, exit 1 if any fail.

### 4. Inspect the AMBIGUITY ledger

User: "what parsing ambiguities does rocc know about?"

```
rocc({ binary: "rocc-substrate", subcommand: "ambiguity" })
```

Returns the ledger with entries like `CLTE-001 [content-length/transfer-encoding] Both CL and TE present: one parser uses TE, the other CL (RFC 7230 §3.3.3)`.

### 5. Plan a CL/TE smuggling attack

User: "build me a CL/TE desync request"

```
rocc({ binary: "rocc-compose", subcommand: "smuggle" })
```

Returns the ambiguity ID (CLTE-001), the strict parser view (Chunked), the lax parser view (ContentLength), and the constructed request with the smuggled payload.

### 6. Forge JWTs against a verifier model

User: "forge JWTs with alg:none, HS-confusion, and kid-path"

```
rocc({ binary: "rocc-compose", subcommand: "jwt" })
```

Returns 3 forged tokens with their weakness classification and whether each was accepted.

### 7. Demo ECDSA nonce-reuse key recovery

User: "show me how nonce-reuse recovers a key"

```
rocc({ binary: "rocc-compose", subcommand: "nonce-reuse" })
```

Returns "shared-r nonce reuse recovers key: true".

### 8. Multi-variant smuggling payloads

User: "give me all the smuggling variants"

```
rocc({ binary: "rocc-products", subcommand: "smugglekit" })
```

Returns CL.TE, TE.CL, and other variants with their ambiguity IDs and constructed requests.

### 9. Race-window plan

User: "plan a race attack with 100ns window and 1000ns attempt"

```
rocc({ binary: "rocc-products", subcommand: "timing" })
```

Returns the window, attempt, per-attempt probability, trials-for-90, and feasibility verdict.

### 10. Recover a key from a signature corpus

User: "demo the signer product"

```
rocc({ binary: "rocc-products", subcommand: "signer-demo" })
```

Returns the corpus classification (reuse vs flat) and recovered key (if reuse detected).

### 11. Cross-compile targets

User: "what targets can rocc cross-compile to?"

```
rocc({ binary: "rocc-tools", subcommand: "targets" })
```

Returns the target matrix: x86_64-unknown-linux-musl, aarch64-unknown-linux-musl, x86_64-pc-windows-gnu, aarch64-apple-darwin, x86_64-apple-darwin.

### 12. Emit a build recipe

User: "give me the strip recipe"

```
rocc({ binary: "rocc-tools", subcommand: "emit", args: ["strip"] })
```

Returns the shell recipe: `strip --strip-all -R .comment -R .note.gnu.build-id --remove-section=.gnu_debuglink "$BIN"` plus a path-leak check.

### 13. Pack a payload

User: "pack my payload.bin into the rocc format"

```
rocc({
  binary: "rocc-tools",
  subcommand: "pack",
  args: ["--in", "/path/to/payload.bin", "--out", "/path/to/payload.packed"]
})
```

### 14. Obfuscate a payload

User: "XOR-rolling obfuscate my payload"

```
rocc({
  binary: "rocc-tools",
  subcommand: "obf",
  args: ["--transform", "xor-rolling", "--in", "/path/to/payload.bin", "--out", "/path/to/payload.obf"]
})
```

Or reverse:

```
rocc({
  binary: "rocc-tools",
  subcommand: "obf",
  args: ["--transform", "reverse", "--in", "/path/to/payload.bin", "--out", "/path/to/payload.rev"]
})
```

## Permission Patterns

The tool asserts `action: "rocc"` against the binary name as the resource. Suggested repository permission rules:

```jsonc
// .codeshod/codeshod.jsonc — permission section
{
  "permission": {
    "rules": [
      // Allow all read-only operations without asking
      { "action": "rocc", "resource": "rocc-substrate", "effect": "allow" },
      { "action": "rocc", "resource": "rocc-primitives", "effect": "allow" },
      { "action": "rocc", "resource": "rocc-compose", "effect": "allow" },
      { "action": "rocc", "resource": "rocc-conformance", "effect": "allow" },
      { "action": "rocc", "resource": "rocc-products", "effect": "allow" },
      // Allow tools targets/emit (read-only recipes)
      { "action": "rocc", "resource": "rocc-tools", "effect": "allow" },
      // Ask before bench write (modifies filesystem)
      { "action": "rocc", "resource": "rocc-bench", "effect": "ask" },
      // Everything else allowed (the binary selector already constrains what runs)
      { "action": "rocc", "resource": "*", "effect": "allow" }
    ]
  }
}
```

The `rocc-tools pack` and `rocc-tools obf` subcommands write files — the agent should typically write to `/tmp/*` or workspace paths. Repository rules can constrain this further by inspecting the `args` field in metadata.

## Common Mistakes

- **Don't pass the wrong binary name.** The `binary` field must be one of: `rocc-substrate`, `rocc-primitives`, `rocc-compose`, `rocc-conformance`, `rocc-products`, `rocc-tools`, `rocc-bench`. There is no plain `rocc` binary.
- **Don't pass the wrong subcommand.** Each binary has its own subcommand set. Use `rocc-primitives list` to see what each primitive does; use `rocc-compose list` to see what chains exist.
- **Don't pass the wrong transform name.** `rocc-tools obf` accepts only `xor-rolling` and `reverse`. Not `xor`, not `rc4`, not `aes`.
- **Don't expect rocc to attack targets.** The primitives prove bounds; they don't exploit systems. Use `msfx` for actual exploitation work.
- **Don't expect the conformance gate to be fast.** The `ecdsa-nonce` primitive runs a full LLL lattice reduction which can take ~15 seconds. Bump the timeout to 60s if running the full `rocc-conformance`.
- **Don't expect the rocc source in the codeshod tree.** Only the stripped binaries are bundled. If the user wants to read or modify rocc itself, they should clone the upstream project.
- **Don't use rocc for live packet capture.** Use `shark` (dumpcap).
- **Don't use rocc for live port scanning.** Use `nmap`.
- **Don't use rocc for web app scaffolding.** Use `rustango`.
- **Don't forget the authorized-use rule.** rocc is for authorized security research and education only. Using rocc primitives against systems you do not own or have explicit written permission to test may be illegal.

## Source

- The tool plugin: `packages/core/src/tool/plugin/rocc.ts`
- The binaries: `packages/cli/assets/rocc/bin/rocc-{substrate,primitives,compose,conformance,products,tools,bench}-linux-x64` (7 binaries, 2.8 MB total, **no source bundled**)
- The contract: `specs/v2/tools.md#built-in-registry-of-offensive-capability-rocc`
- Contributor notes: `AGENTS.md#built-in-rocc-tool`

If the rocc binaries are missing from `packages/cli/assets/rocc/bin/`, the tool falls back to looking up each binary on `PATH`. For dev worktrees, set `CODESHOD_ROCC_BIN_DIR=/path/to/rocc-bin` to override.
