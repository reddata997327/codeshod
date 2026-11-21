---
name: enigma
description: Use when the user has an Enigma Protector-protected 32-bit Windows EXE and wants to unpack it (recover the original PE), extract the Enigma VM runtime DLL, list VM entry points, or devirtualize a specific VM-protected function back to x86. Also when the user mentions Enigma Protector, "Enigma unpacker", "VM devirtualization", "section salt brute-force", "IDEA-CBC", "RC4 section decryption", "Virtual Box extraction", "EVB", or wants to reverse a packed 32-bit Windows PE. Covers all 4 operations (unpack/runtime/scan/devirt), the CUDA/WGPU/CPU backends, the x86-only limitation, and the authorized-use rule.
---

# enigma — Static Enigma Protector unpacker as a built-in Codeshod tool

Codeshod ships with `enigma`, a pure-Rust static unpacker and devirtualizer for the Enigma Protector packer, as a first-party built-in tool. It is registered under plugin id `codeshod.tool.enigma`, exposed to the model as the `enigma` tool, and bundled with every Codeshod installation (9.1 MB stripped binary at `packages/cli/assets/enigma/bin/`). It is NOT an MCP server and NOT a shell-out to any external unpacker.

**Only the stripped binary is bundled** — the enigma-rs source is intentionally NOT in the codeshod tree. Rebuilds land in `packages/cli/assets/enigma/bin/` via the release workflow from the upstream `enigma_rs` project.

**Authorized use only.** Only unpack binaries you own or have explicit written permission to analyze. Unpacking protected software you do not own may violate copyright or anti-circumvention laws (DMCA §1201 in the US, Article 6 of the EU Copyright Directive, similar laws elsewhere). The tool is for security research, malware analysis, and reverse-engineering education.

## What Enigma Protector does to an EXE

Enigma Protector (the target, not this tool) takes a 32-bit Windows `.exe` and:

1. **Encrypts the original PE sections** with RC4 keyed by a 32-bit salt + IDEA-CBC.
2. **Embeds a "loader" stub** that decrypts the sections at runtime.
3. **Wraps selected functions in a custom virtual machine** — the original x86 instructions are translated into a private bytecode interpreted by an "Enigma VM" inside the loader. Devirtualization lifts this bytecode back to native x86.
4. **Optionally packs files into a "Virtual Box" (EVB)** — an encrypted container holding data files the protected EXE expects to find at runtime.
5. **Anti-debug / anti-VM / anti-tamper checks** scattered through the loader.

## What the `enigma` tool does about it

The `enigma` tool is the reverse workflow, implemented statically (no execution of the protected binary). Four operations:

| Operation | What it does |
|-----------|--------------|
| `unpack` (default) | Brute-force the 32-bit section salt (CUDA/WGPU/CPU), decrypt sections with RC4 + IDEA-CBC, recover imports, rebuild a runnable unpacked EXE + extracted EVB files into an `unpack/` directory next to the input. GPU-accelerated; on CPU the 2³² keyspace takes hours-to-days. |
| `runtime` | Skip the salt search; just extract the embedded RVA-mapped loader DLL — the "runtime" that contains the Enigma VM. Useful when you only want to inspect the VM. |
| `scan` | Parse the loader/runtime DLL, find every template-VM entry point, print their RVAs (hex addresses). |
| `devirt` | Take one VM entry RVA, decode the Enigma VM bytecode for that function, lift it back to native x86, emit assembly (`.asm`) or raw machine code (`.bin`). |

## When To Use

Use the `enigma` tool when the user's intent is one of these:

- **Unpack an Enigma-protected EXE** — recover the original PE so static analysis tools (IDA, Ghidra, radare2) can read the real code. Use operation `unpack`.
- **Extract the Enigma VM runtime DLL** — pull out the loader for further study of the protector itself. Use operation `runtime`.
- **List VM entry points** — find which functions in the binary were devirtualized by the packer. Use operation `scan`.
- **Devirtualize a specific function** — lift one VM-protected function back to x86 so a human or decompiler can read what it actually does (e.g. the license-check routine, the anti-debug logic, the C2 URL construction). Use operation `devirt` with the RVA from `scan`.

The user said "Enigma Protector", "Enigma unpacker", "VM devirtualization", "section salt brute-force", "IDEA-CBC", "RC4 section decryption", "Virtual Box extraction", "EVB", "packed 32-bit Windows EXE", or "lift VM bytecode to x86" → use this skill.

## When NOT To Use

- **64-bit PE files.** enigma-rs only supports x86 (32-bit PE). x64 is not supported.
- **Non-Enigma packers.** UPX (`upx -d`), Themida, VMProtect, ASPack, etc. each have their own unpacker. enigma-rs is Enigma-specific.
- **Execution of the unpacked binary.** The output is for static analysis only — the rebuilt EXE may not run correctly because the unpacker cannot recover everything the runtime did at startup.
- **Live packet capture or network scanning.** Use `shark` or `nmap`.
- **Offensive primitive research.** Use `rocc`.
- **Metasploit-style exploitation.** Use `msfx`.
- **Web app scaffolding.** Use `rustango`.
- **Code Mode sessions.** The tool is not exposed in Code Mode (read-only filesystem mode) — unpacking protected binaries is not a read-only filesystem operation.
- **Unauthorized targets.** Only unpack binaries you own or have explicit written permission to analyze.

## Operations

The tool exposes a single `operation` parameter. Pick the right one:

| Operation | What it does | Required input fields |
|-----------|--------------|----------------------|
| `unpack` | Brute-force salt, decrypt sections, recover imports, rebuild EXE + EVB | `input`; optional `backend` |
| `runtime` | Extract the embedded loader DLL | `input`; optional `output` |
| `scan` | List VM entry point RVAs | `input`; optional `output` |
| `devirt` | Lift one VM entry RVA to x86 | `input`, `rva`; optional `output` (`.asm` or `.bin`) |

## Search Backends (unpack mode)

The `backend` input field (or omitting it for auto-select) controls which salt search backend is used:

| Backend | What it uses | Speed | Requirements |
|---------|--------------|-------|--------------|
| `cuda` | NVIDIA GPU via cubecl-cuda | Fastest | NVIDIA driver + CUDA runtime. **NOT in the bundled binary** (codeshod sandbox has no NVIDIA GPU). |
| `wgpu` | Any compatible GPU via WebGPU | Fast | Compatible GPU + driver. Included in the bundled binary. |
| `cpu` | Every logical CPU core | Slow (2³² keyspace, hours-to-days) | None — always works. |
| (omit) | Auto-select: tries CUDA → WGPU → CPU | Best available | Varies |

## Output Reading

The tool returns a JSON object with shape:

```jsonc
{
  "operation": "scan",
  "ok": true,
  "summary": "scan found 3 VM entry RVA(s)",
  "stdout": "0x00023b053\n0x00023b100\n0x00023b220\n",
  "stderr": "",
  "data": { "rvas": ["23b053", "23b100", "23b220"], "count": 3 },
  "raw": { "exitCode": 0, "argv": "/path/input.exe --mode scan", "binary": "enigma-rs-linux-x64", "binaryPath": "/path/to/enigma-rs-linux-x64" }
}
```

Operation-specific `data` shapes:

- `unpack` → `{ unpackDir: "unpack/ (adjacent to input)", stderrLines: [...] }` (progress is on stderr)
- `runtime` → `{ raw: "..." }` (output written to `unpack/runtime.dll` or the `-o` path)
- `scan` → `{ rvas: ["23b053", ...], count: N }`
- `devirt` → `{ bytes: 1024, imageBase: "0x400000", codeRva: "0x23b053", outputLength: 4096, outputPreview: "..." }`

## Exit Codes

| Code | Meaning | Tool behavior |
|------|---------|---------------|
| 0 | OK | Return parsed JSON with `ok: true` |
| 1 | Error (bad args, PE parse failure, unpack failure, devirt failure) | Return parsed result with `ok: false` and stderr surfaced |

The tool does NOT fail the call on exit 1 — the agent still gets stdout/stderr to reason about. Only timeout and process-spawn errors fail at the `runEnigma` layer.

## Timeout Defaults

| Operation class | Default | Max |
|-----------------|---------|-----|
| Read ops (`scan`, `runtime`, `devirt`) | 30 s | 300 s |
| `unpack` (salt brute-force, may use GPU) | 10 min | 30 min |

If unpack times out, the salt search did not complete. On CPU, a single binary can take hours-to-days — tell the user to either run on a machine with an NVIDIA GPU (CUDA backend) or accept that CPU unpack is impractical for full keyspace.

## Recommended Workflows

### 1. Unpack an Enigma-protected EXE

User: "unpack this Enigma-protected EXE at /path/protected.exe"

```
enigma({
  operation: "unpack",
  input: "/path/protected.exe",
  backend: "cpu"   // or "wgpu" if a GPU is available, or omit for auto-select
})
```

Output goes to `/path/unpack/` — the unpacked EXE keeps its original name, EVB files go alongside. If `unpack/` already exists, the tool errors out (it does not overwrite).

### 2. Extract just the Enigma VM runtime

User: "extract the Enigma VM loader DLL from /path/protected.exe"

```
enigma({
  operation: "runtime",
  input: "/path/protected.exe"
})
```

Output goes to `/path/unpack/runtime.dll` (or the `-o` path you specify).

### 3. List VM entry points

User: "what functions are VM-protected in /path/protected.exe?"

```
enigma({
  operation: "scan",
  input: "/path/protected.exe"
})
```

Returns a list of hex RVAs like `0x23b053`. Use these as input to `devirt`.

### 4. Devirtualize a specific function

User: "lift the function at RVA 0x23b053 back to x86"

```
// Step 1: scan to find valid RVAs
enigma({ operation: "scan", input: "/path/protected.exe" })

// Step 2: devirt the chosen RVA
enigma({
  operation: "devirt",
  input: "/path/protected.exe",
  rva: "0x23b053",
  output: "/path/function.asm"   // or .bin for raw machine code
})
```

If `output` ends in `.bin`, raw x86 machine code is written; otherwise assembly text.

### 5. Full reverse workflow

User: "fully reverse this Enigma-protected binary"

```
// Step 1: unpack to recover the original PE
enigma({ operation: "unpack", input: "/path/protected.exe", backend: "wgpu" })

// Step 2: extract the runtime DLL for VM analysis
enigma({ operation: "runtime", input: "/path/protected.exe" })

// Step 3: scan the runtime for VM entry points
enigma({ operation: "scan", input: "/path/unpack/runtime.dll" })

// Step 4: devirt each entry point of interest
enigma({ operation: "devirt", input: "/path/unpack/runtime.dll", rva: "0x23b053", output: "/path/func.asm" })

// Step 5: tell the user to load the unpacked EXE + .asm files into IDA/Ghidra for further analysis
```

## Permission Patterns

The tool asserts `action: "enigma"` against the input file path (read) or output path (write). Suggested repository permission rules:

```jsonc
// .codeshod/codeshod.jsonc — permission section
{
  "permission": {
    "rules": [
      // Allow read-only operations (scan) on workspace paths
      { "action": "enigma", "resource": "/tmp/*", "effect": "allow" },
      { "action": "enigma", "resource": "./sprints/*", "effect": "allow" },
      // Always ask before unpack (writes an unpack/ directory + produces executable output)
      { "action": "enigma", "resource": "unpack", "effect": "ask" },
      // Always ask before runtime extraction (writes a DLL)
      { "action": "enigma", "resource": "runtime", "effect": "ask" },
      // Always ask before devirt (writes assembly/machine code)
      { "action": "enigma", "resource": "devirt", "effect": "ask" },
      // Ask before everything else
      { "action": "enigma", "resource": "*", "effect": "ask" }
    ]
  }
}
```

Note: the `resource` for `unpack`/`runtime` is the input file path (because the output location is derived from it), so the rules above match on operation name only if the input path doesn't match a workspace pattern. Tighten as needed for your environment.

## Common Mistakes

- **Don't pass a 64-bit PE.** enigma-rs only supports x86 (32-bit PE). x64 is not supported. Check the PE header first if unsure.
- **Don't use enigma for non-Enigma packers.** UPX has `upx -d`, Themida has scripts, VMProtect has its own tools. enigma-rs is Enigma-specific.
- **Don't expect the unpacked EXE to run.** The output is for static analysis. The unpacker cannot recover everything the runtime did at startup (anti-debug checks, runtime patches, etc.).
- **Don't run `unpack` on CPU expecting fast results.** The 2³² keyspace takes hours-to-days on CPU. Use `backend: "wgpu"` if a compatible GPU is available, or tell the user to run on a machine with an NVIDIA GPU (CUDA backend, not in the bundled binary).
- **Don't forget the `unpack/` directory already exists.** The tool errors out if `unpack/` already exists next to the input — it does not overwrite. Remove or rename the existing directory first.
- **Don't pass a non-hex RVA to devirt.** The `rva` field accepts `0x23b053`, `0X23B053`, or `23b053` — all are parsed as hex. Use `scan` first to discover valid RVAs.
- **Don't expect the bundled binary to have CUDA.** The codeshod sandbox has no NVIDIA GPU, so the bundled binary is built WITHOUT CUDA support. The WGPU backend is included but requires a compatible GPU + driver at runtime. The CPU backend always works.
- **Don't use enigma for live packet capture.** Use `shark` (dumpcap).
- **Don't use enigma for port scanning.** Use `nmap`.
- **Don't use enigma for offensive primitive research.** Use `rocc`.
- **Don't forget the authorized-use rule.** Only unpack binaries you own or have explicit written permission to analyze.

## Source

- The tool plugin: `packages/core/src/tool/plugin/enigma.ts`
- The binary: `packages/cli/assets/enigma/bin/enigma-rs-<platform>-<arch>` (9.1 MB stripped, **no source bundled**)
- The contract: `specs/v2/tools.md#built-in-enigma-protector-unpacker-enigma`
- Contributor notes: `AGENTS.md#built-in-enigma-tool`

If the enigma-rs binary is missing from `packages/cli/assets/enigma/bin/`, the tool falls back to `enigma-rs` on `PATH`. For dev worktrees, set `CODESHOD_ENIGMA_BIN=/path/to/enigma-rs` to override.
