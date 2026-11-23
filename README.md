<p align="center">
  <a href="https://codeshod.ai">
    <picture>
      <source srcset=".github/assets/logo-ornate-dark.svg" media="(prefers-color-scheme: dark)">
      <source srcset=".github/assets/logo-ornate-light.svg" media="(prefers-color-scheme: light)">
      <img src=".github/assets/logo-ornate-light.svg" alt="Codeshod logo">
    </picture>
  </a>
</p>
<p align="center">The open source AI coding agent.</p>
<p align="center">
  <a href="https://codeshod.ai/discord"><img alt="Discord" src="https://img.shields.io/discord/1391832426048651334?style=flat-square&label=discord" /></a>
  <a href="https://www.npmjs.com/package/@codeshod/cli"><img alt="npm" src="https://img.shields.io/npm/v/@codeshod/cli?style=flat-square" /></a>
  <a href="https://github.com/reddata997327/codeshod/actions/workflows/release.yml"><img alt="Build status" src="https://img.shields.io/github/actions/workflow/status/reddata997327/codeshod/release.yml?style=flat-square&branch=dev" /></a>
</p>

<p align="center">
  <a href="README.md">English</a> |
  <a href="README.zh.md">简体中文</a> |
  <a href="README.zht.md">繁體中文</a> |
  <a href="README.ko.md">한국어</a> |
  <a href="README.de.md">Deutsch</a> |
  <a href="README.es.md">Español</a> |
  <a href="README.fr.md">Français</a> |
  <a href="README.it.md">Italiano</a> |
  <a href="README.da.md">Dansk</a> |
  <a href="README.ja.md">日本語</a> |
  <a href="README.pl.md">Polski</a> |
  <a href="README.ru.md">Русский</a> |
  <a href="README.bs.md">Bosanski</a> |
  <a href="README.ar.md">العربية</a> |
  <a href="README.no.md">Norsk</a> |
  <a href="README.br.md">Português (Brasil)</a> |
  <a href="README.th.md">ไทย</a> |
  <a href="README.tr.md">Türkçe</a> |
  <a href="README.uk.md">Українська</a> |
  <a href="README.bn.md">বাংলা</a> |
  <a href="README.gr.md">Ελληνικά</a> |
  <a href="README.vi.md">Tiếng Việt</a>
</p>

[![Codeshod Terminal UI](services/site/public/v1/docs/assets/lander/screenshot.png)](https://codeshod.ai)

---

### Installation

```bash
# YOLO
curl -fsSL https://codeshod.ai/v2/install | bash

# Package managers
npm i -g @codeshod/cli@latest      # or bun/pnpm/yarn
brew install reddata997327/tap/codeshod-v2 # macOS and Linux (recommended, always up to date)
brew install codeshod              # macOS and Linux (official brew formula, updated less)
sudo pacman -S codeshod            # Arch Linux (Stable)
paru -S codeshod-beta              # Arch Linux (Latest from AUR)
mise use -g codeshod               # Any OS
nix run github:reddata997327/codeshod  # Nix
```

> [!TIP]
> Remove versions older than 0.1.x before installing.

### Kali Linux (one command)

No Node.js, Bun, npm or brew needed — install the standalone `codeshod` binary straight from GitHub Releases:

```bash
INSTALLER=https://raw.githubusercontent.com/reddata997327/codeshod/main/install-kali.sh

# Install the latest release (Kali Linux and any Debian/Ubuntu-family Linux, x86_64)
curl -fsSL $INSTALLER | bash

# Installer options
curl -fsSL $INSTALLER | bash -s -- -h                # help / all options
curl -fsSL $INSTALLER | bash -s -- -v v2.3.0         # install a specific release tag
curl -fsSL $INSTALLER | bash -s -- -d ~/.codeshod    # custom install root
curl -fsSL $INSTALLER | bash -s -- --from-source     # build from source instead of downloading the binary
curl -fsSL $INSTALLER | bash -s -- --no-modify-path  # don't touch shell config files
curl -fsSL $INSTALLER | bash -s -- --uninstall       # remove Codeshod and revert PATH changes
```

The installer downloads `codeshod-linux-x64.tar.gz` from [GitHub Releases](https://github.com/reddata997327/codeshod/releases/latest), extracts the binary to `~/.codeshod/bin`, links it into `~/.local/bin`, and adds it to your `PATH` in `~/.bashrc` / `~/.zshrc` / `~/.profile`. Open a new shell (or `source ~/.bashrc`) and run `codeshod`.

### Agents

Codeshod includes two built-in agents you can switch between with the `Tab` key.

- **build** - Default, full-access agent for development work
- **plan** - Read-only agent for analysis and code exploration
  - Denies file edits by default
  - Asks permission before running bash commands
  - Ideal for exploring unfamiliar codebases or planning changes

Also included is a **general** subagent for complex searches and multistep tasks.
This is used internally and can be invoked using `@general` in messages.

Learn more about [agents](https://codeshod.ai/docs/agents).

### Built-in `nmap` network scanner

Codeshod ships with a pure-Rust nmap-compatible scanner (`rnmap`) as a first-party built-in tool. It is not an MCP server and not a shell-out to a system `nmap` binary — the stripped release binary lives at `packages/cli/assets/rnmap/bin/` and is bundled with every Codeshod installation.

The `nmap` tool supports TCP connect / SYN / ACK / FIN / Xmas / Null scans, UDP scans, host discovery, OS fingerprinting, service/version detection, traceroute, 24 built-in Rhai NSE-style scripts, TLS certificate parsing, IDS-evasion primitives (decoys, fragmentation, randomization), and timing templates T0–T5. It returns a stable versioned JSON report (schema 1.0) that the agent reasons over directly.

```bash
# Quick example: ask Codeshod to scan your local network
# "Use the nmap tool to scan 192.168.1.0/24 for the top 100 ports"
```

Raw-socket scans (SYN, OS fingerprint) require root or `CAP_NET_RAW`; the scanner auto-falls back to TCP connect scan when unprivileged. See [specs/v2/tools.md](./specs/v2/tools.md#built-in-network-scanner-nmap) for the full contract and the [nmap skill](./.codeshod/skills/nmap/SKILL.md) for usage patterns.

### Built-in `msfx` Metasploit-style framework

Codeshod also ships with `msfx` — a pure-Rust Metasploit-style exploitation framework as a first-party built-in tool. The stripped release binary lives at `packages/cli/assets/msfx/bin/` (674 KB, no C deps) and exposes 9 modules through a single `msfx` tool with a typed `operation` parameter:

- `modules.list` / `module.info` / `module.run` — discover, inspect, and execute modules
- `payload.generate` — msfvenom-style reverse/bind shell generation (sh / python / rust / bytes)
- `pattern.create` / `pattern.offset` — Metasploit cyclic pattern exploit-dev helpers
- `search` — keyword search over module names/titles/descriptions

Built-in modules: `auxiliary/scanner/portscan/tcp`, `auxiliary/gather/banner_grab`, `auxiliary/scanner/http/http_version`, `auxiliary/scanner/ssh/ssh_version`, `auxiliary/handler/reverse_tcp`, `exploit/lab/stack_overflow_template`, `payload/single/reverse_tcp`, `payload/single/bind_tcp`, `encoder/generic/xor`.

The tool does NOT expose the `msfx rpc` long-lived TCP server — every action is one-shot. See [specs/v2/tools.md](./specs/v2/tools.md#built-in-metasploit-style-framework-msfx) for the full contract and the [msfx skill](./.codeshod/skills/msfx/SKILL.md) for usage patterns.

### Built-in `shark` headless Wireshark

Codeshod also ships with `shark` — a pure-Rust Wireshark-style packet capture analyzer as a first-party built-in tool. The stripped release binary lives at `packages/cli/assets/shark/bin/` (1.1 MB, no C deps) and exposes 11 operations through a single `shark` tool:

- `tshark` / `protocol_hierarchy` / `conversations` — read packets, apply Wireshark-style display filters, extract fields, compute stats
- `capinfos` / `captype` — inspect capture file metadata and format
- `editcap` / `mergecap` / `reordercap` — edit, merge, sort capture files
- `dumpcap` — Linux live capture via AF_PACKET (needs root/CAP_NET_RAW)
- `randpkt` — generate deterministic test packets
- `list_fields` — enumerate all ~110 dissectable field names

Ten real Wireshark sample captures are bundled at `packages/cli/assets/shark/samples/` (http.pcap, dns-mdns.pcap, dhcp.pcap, dhcp.pcapng, arp.pcap, ipv6.pcap, icmp_ascii.pcapng, etc.) — pass `useSample: "http.pcap"` to use one without an absolute path.

The original `sharkd-mcp` JSON-RPC stdio server was **removed** when this was integrated as a first-party Codeshod built-in — every action is one-shot through the `shark <subcommand>` CLI. Supported protocols: Ethernet, VLAN, ARP, IPv4, IPv6, TCP, UDP, ICMP, ICMPv6, DNS, mDNS, LLMNR, HTTP. See [specs/v2/tools.md](./specs/v2/tools.md#built-in-headless-wireshark-shark) for the full contract and the [shark skill](./.codeshod/skills/shark/SKILL.md) for usage patterns.

### Built-in `rustango` Django-style web framework

Codeshod also ships with `rustango` — a pure-Rust Django-style batteries-included web framework as a first-party built-in tool. The stripped release binary lives at `packages/cli/assets/rustango/bin/` (2.3 MB, no C deps) and exposes 11 management commands through a single `rustango` tool:

- `version` / `help` / `check` — introspection (read-only)
- `startproject NAME DIR` — scaffold a new project (creates Cargo.toml + src/main.rs + templates/ + settings.toml)
- `startapp NAME DIR` — scaffold a new app inside a project (creates models.rs + views.rs + templates/)
- `makemigrations [APP]` / `migrate [APP]` / `showmigrations` — ORM schema management
- `createsuperuser -u NAME -p PW` — create or reset a superuser (Django-compatible PBKDF2-SHA256 hash)
- `clearsessions` — purge expired sessions
- `runserver [ADDR]` — start the dev HTTP server (default 127.0.0.1:8000, 15-second default timeout — long enough to verify a project boots and curl an endpoint)

rustango implements the full Django architecture surface: settings (builder + TOML overlay), URL routing with path converters, function + class-based views, the Django Template Language (DTL) with filters, a model/ORM layer with migrations (in-memory or JSON-file backend), forms with validation, sessions, authentication, CSRF, flash messages, middleware, an auto-generated admin site, i18n catalogs, a cache framework, static files, and a management CLI. Only the stripped binary is bundled (no source code); see [specs/v2/tools.md](./specs/v2/tools.md#built-in-django-style-web-framework-rustango) for the full contract and the [rustango skill](./.codeshod/skills/rustango/SKILL.md) for usage patterns.

### Built-in `rocc` registry of offensive capability

Codeshod also ships with `rocc` — a pure-Rust registry of offensive security primitives, chains, harnesses, products, and build tools as a first-party built-in. **Zero external dependencies** (every crate is std-only). 7 stripped release binaries live at `packages/cli/assets/rocc/bin/` (2.8 MB total) and are invoked through a single `rocc` tool with a `binary` selector:

- `rocc-substrate` — the AMBIGUITY ledger (CL/TE, double-CL, obfuscated-TE parsing ambiguities with RFC references)
- `rocc-primitives` — list/demo the 10 irreducible primitives (secp256k1, ecdsa-nonce, sha256-merkle, http-smuggle, jwt, uuid-seq, data-infer, mem-race, evade-encode, cost-model)
- `rocc-compose` — chains (smuggle / jwt / nonce-reuse)
- `rocc-conformance` — the validation gate (10/10 primitives pass; the only source of truth for "is it done")
- `rocc-products` — usable batteries (smugglekit / phishstack / timing / signer-demo)
- `rocc-tools` — build layer (cross-compile matrix, strip, pack, obf with xor-rolling / reverse transforms)
- `rocc-bench` — reliability + cost measurement

rocc decomposes every offensive act into irreducible primitives, each with a substrate bound (physics/math/semantics/economics) and a conformance gate. Nothing is "done" until `rocc-conformance` says so. Only the stripped binaries are bundled (no source code); see [specs/v2/tools.md](./specs/v2/tools.md#built-in-registry-of-offensive-capability-rocc) for the full contract and the [rocc skill](./.codeshod/skills/rocc/SKILL.md) for usage patterns.

### Built-in `enigma` Enigma Protector unpacker

Codeshod also ships with `enigma` — a pure-Rust static unpacker and devirtualizer for the Enigma Protector packer (a commercial Windows executable protector). The stripped release binary lives at `packages/cli/assets/enigma/bin/` (9.1 MB, std-only + anyhow + clap + crc32fast + iced-x86 + indicatif + md5 + optional cubecl CUDA/WGPU backends) and exposes 4 operations through a single `enigma` tool:

- `unpack` (default) — brute-force the 32-bit section salt (CUDA/WGPU/CPU), decrypt RC4 + IDEA-CBC sections, recover imports, rebuild a runnable unpacked EXE + extracted EVB (Virtual Box) files into an `unpack/` directory next to the input
- `runtime` — extract just the embedded RVA-mapped loader DLL (the Enigma VM)
- `scan` — list template-VM entry point RVAs
- `devirt` — lift one VM entry RVA back to x86 assembly (`.asm`) or raw machine code (`.bin`)

**x86 (32-bit PE) only — x64 not supported.** The bundled binary has WGPU + CPU backends (no CUDA, since the codeshod sandbox has no NVIDIA GPU); unpack on CPU is slow (2³² keyspace). Only the stripped binary is bundled (no source code); see [specs/v2/tools.md](./specs/v2/tools.md#built-in-enigma-protector-unpacker-enigma) for the full contract and the [enigma skill](./.codeshod/skills/enigma/SKILL.md) for usage patterns.

### Documentation

For more info on how to configure Codeshod, [**head over to our docs**](https://codeshod.ai/docs).

### Contributing

If you're interested in contributing to Codeshod, please read our [contributing docs](./CONTRIBUTING.md) before submitting a pull request.

### Building on Codeshod

If you are working on a project that's related to Codeshod and is using "codeshod" as part of its name, for example "codeshod-dashboard" or "codeshod-mobile", please add a note to your README to clarify that it is not built by the Codeshod team and is not affiliated with us in any way.

---

**Join our community** [Discord](https://discord.gg/codeshod) | [X.com](https://x.com/codeshod)
