---
name: nmap
description: Use when the user asks to scan ports, fingerprint services or OSes, map a network, run a port sweep, do network reconnaissance, or mentions nmap, pentest, port scan, traceroute, or attack-surface discovery. Covers when to scan, which scan type and timing template to pick, how to read the JSON report, and how to chain follow-up work.
---

# nmap — Network Reconnaissance with the built-in rnmap tool

Codeshod ships with a pure-Rust nmap-compatible scanner (`rnmap`) as a first-party built-in tool. It is registered under plugin id `codeshod.tool.nmap`, exposed to the model as the `nmap` tool, and bundled with every Codeshod installation. It is NOT an MCP server and NOT a shell-out to a system `nmap` binary.

This skill teaches you when to use it, how to choose scan parameters, and how to reason about the JSON report it returns.

## When To Use

Use the `nmap` tool when the user's intent is one of these:

- **Port discovery**: "what ports are open on host X", "scan 10.0.0.0/24 for SSH", "is port 443 reachable".
- **Service / version fingerprinting**: "what's running on port 80", "is the SSH on this box old", "identify the HTTP server".
- **OS fingerprinting**: "what OS is this host running", "is this Linux or Windows".
- **Network mapping**: "what's on my subnet", "find every live host in 192.168.0.0/16" (cap at /16 — broader is rejected).
- **Traceroute / path discovery**: "how do I reach host X", "where does the path drop".
- **TLS inspection**: "what cert is on this HTTPS endpoint", "is the cert self-signed", "is TLS 1.2 supported".
- **Pentest reconnaissance**: pre-engagement discovery on a target the user has written permission to test.
- **Service-specific probes**: SSH algorithms, MongoDB wire probe, MySQL greeting, Redis INFO, RDP negotiate, SMB negotiate, SNMP sysDescr, mDNS, NTP version, NetBIOS names — all built-in Rhai scripts.
- **Diff / watch**: "compare today's scan to yesterday's", "watch this network for new hosts every 60 seconds".
- **Resume**: "continue the scan I started earlier" (reads a prior JSON report and skips already-finished hosts).

The user said "nmap" or "port scan" or "recon" or "pentest" or "scan this host" → use this skill. Don't reach for `shell` to invoke system `nmap`; the built-in tool returns structured JSON, the system binary does not.

## When NOT To Use

- **Unauthorized targets.** Only scan hosts you own or have explicit written permission to test. Unauthorized port scanning is illegal in most jurisdictions. If the user asks to scan a target they do not own and have not asserted permission for, ask first.
- **Local file reads / code search / web fetches.** Use `read`, `grep`, or `webfetch` instead.
- **HTTP API probing of a single endpoint.** Use `webfetch` for a one-shot HTTP call.
- **Long-running production monitoring.** The tool caps wall-clock time at 5 minutes per call. For continuous monitoring, set up an out-of-band scheduler and feed results back into the session.
- **Code Mode sessions.** The tool is not exposed in Code Mode (read-only filesystem mode).

## Scan Type Selection

Pick the scan type based on what you need and what privileges you have:

| Scan type | Flag | Use when | Requires root |
|-----------|------|----------|---------------|
| `connect` | `-S connect` | Default. Unprivileged, works everywhere. Slower and noisier than SYN. | no |
| `syn` | `-S syn` | Stealth SYN scan. Fast, doesn't complete TCP handshake. | yes |
| `ack` | `-S ack` | Map firewall rules (stateful vs stateless). | yes |
| `fin` | `-S fin` | FIN scan — evade some firewalls that only block SYN. | yes |
| `xmas` | `-S xmas` | FIN+PSH+URG — older IDS evasion. | yes |
| `null` | `-S null` | No flags — older IDS evasion. | yes |
| `udp` | `-S udp` | UDP scan (DNS/SNMP/NTP/NetBIOS discovery). Slower (open vs open\|filtered). | no |
| `ping` | `-S ping` | Host discovery only — no port scan. | no |
| `all` | `-S all` | SYN + UDP combined. | yes |

When run without root or `CAP_NET_RAW`, the scanner auto-falls back to TCP connect scan and emits a warning to stderr (which surfaces in the tool result). Do not retry with `-S syn` after seeing the fallback — same result.

## Timing Templates

Pick the timing template based on the network and goal:

| Template | Speed | Stealth | Use when |
|----------|-------|---------|----------|
| `T0` paranoid | 1 probe / 5 min | Maximum stealth | Evading legacy IDS; extremely slow networks |
| `T1` sneaky | 1 probe / 15 s | High stealth | Slow IDS evasion |
| `T2` polite | 4 parallel / 400 ms | Moderate | Shared networks where you want to be gentle |
| `T3` normal (default) | 64 parallel / 1.5 s timeout | Standard | General-purpose trusted networks |
| `T4` aggressive | 256 parallel / 800 ms timeout | Fast, noisy | Trusted internal networks, fast recon |
| `T5` insane | 1024 parallel / 300 ms timeout | Very fast, lossy | Same-subnet LAN where you accept dropped probes |

Default to **T3** unless you have a reason to deviate. Use **T1-T2** for any external target where stealth matters. Use **T4** for trusted internal networks where you want to move fast. Avoid **T0** (too slow for almost any practical use) and **T5** (drops too many probes on real networks).

## Port Selection

| Pattern | When to use |
|---------|-------------|
| `--top-ports 100` (default-ish) | Quick sweep — finds SSH/HTTP/HTTPS/SMTP/DNS/etc on a subnet |
| `--top-ports 1000` | Standard recon — covers ~95% of common services |
| `-p 1-1000` | Specific low-port range |
| `-p 22,80,443,8080` | Targeted — you know what you're looking for |
| `-p 1-65535` | Full 65535-port scan — slow, only for thorough pentest recon |
| `T:80,U:53` | Mixed TCP+UDP; use with `-S all` for combined scan |
| `-p U:53,U:161,U:123` | UDP-only specific ports (DNS, SNMP, NTP) |

**Default recommendation:** start with `--top-ports 100` on a new target. If the user asks "what's on this host" without specifying ports, use `--top-ports 100`. Only escalate to a full scan if the user asks for thoroughness or the initial sweep was inconclusive.

## Scripts

The `scripts` parameter takes a comma-separated list of script IDs or `all` to run every built-in script. The 24 built-in scripts are:

**Safe (passive or low-impact):**
- `banner_grab` — passive TCP banner
- `ssh_version` — extract SSH version string
- `ssh_algorithms` — list SSH algorithms
- `http_title` — extract `<title>` from HTTP response
- `http_headers` — dump HTTP response headers
- `http_robots` — fetch `/robots.txt` first 500 bytes
- `http_methods` — HTTP OPTIONS allowed methods
- `http_security_headers` — check HSTS, CSP, X-Frame-Options
- `http_server_status` — probe Apache mod_status
- `tls_cert_info` — TLS ClientHello + parse X.509 cert
- `netbios_name` — query NetBIOS name service (UDP 137)
- `ntp_version` — NTP version request
- `dns_version` — DNS version.bind CHAOS TXT
- `mdns_query` — mDNS service discovery
- `snmp_info` — SNMPv1 GetRequest sysDescr.0
- `rdp_probe` — TPKT/COTP CR for RDP
- `vnc_banner` — RFB greeting

**Intrusive (active probes that may log on the target):**
- `mysql_probe` — parse MySQL greeting packet
- `redis_info` — send `INFO server`
- `mongodb_probe` — MongoDB wire protocol
- `postgres_probe` — startup message probe
- `smb_negotiate` — SMB1/SMB2 negotiate
- `smb_enumerate` — SMB1 negotiate + tree connect (enumerates shares)
- `rpc_dump` — RPCBIND v2 CALLIT dump

Run `--script all` only on targets you own. The safe scripts are fine for any authorized target.

## Output Reading

The tool returns a JSON report with schema 1.0. The key fields are:

```jsonc
{
  "schema_version": "1.0",
  "scanner": { "name": "rnmap", "version": "0.4.0", "elapsed_ms": 42, "capabilities": [...] },
  "scan": { "targets": [...], "port_spec": "22,80", "scan_type": "connect", "timing_template": "T3 (normal)", "flags": {...} },
  "hosts": [
    {
      "address": "127.0.0.1",
      "hostname": null,
      "state": "up",            // up | down | unknown
      "state_reason": "echo-reply",
      "rtt_ms": 0.04,
      "os": { "name": "Linux 5.x kernel", "accuracy": 95, "matches": [...] },
      "ports": [
        {
          "port": 80,
          "protocol": "tcp",
          "state": "open",       // open | closed | filtered | open|filtered | closed|filtered | unknown
          "state_reason": "syn-ack",
          "service": { "name": "http", "product": "Apache", "version": "2.4.7", "extrainfo": "(Ubuntu)", "method": "probed", "conf": 8 },
          "tls": { "tls_version": "TLSv1.3", "subject_cn": "...", "issuer_cn": "...", "sans": [...], "not_after": "...", "self_signed": false },
          "scripts": [ { "id": "banner_grab", "output": "..." } ]
        }
      ],
      "traceroute": [ { "ttl": 1, "ip": "10.0.0.1", "rtt_ms": 0.8 } ],
      "scripts": [ { "id": "...", "output": "..." } ]   // host-scope scripts
    }
  ],
  "stats": { "hosts_total": 1, "hosts_up": 1, "hosts_down": 0, "ports_open": 2, "ports_closed": 1, "ports_filtered": 0, "scripts_run": 2 }
}
```

The tool also returns a human-readable summary as the first content item:

```
rnmap 0.4.0 — 1 target(s), 1 up, 2 open, 1 closed, 0 filtered, elapsed 42ms
- 127.0.0.1: up, rtt=0.04ms, open=[80/tcp http/Apache/2.4.7, 443/tcp https]
  os: Linux 5.x kernel (95%)
```

When you need to make a follow-up decision (e.g. "is SSH on a non-default port?"), read `report.hosts[].ports[]` and filter by `state === "open"` and `service.name === "ssh"`.

## Exit Codes

The tool surfaces the rnmap exit code in `metadata.exitCode`:

| Code | Meaning | Tool behavior |
|------|---------|---------------|
| 0 | OK — all targets up | Returns parsed report |
| 1 | No targets up | Returns parsed report (hosts have `state: "down"`) |
| 2 | Partial scan | Returns parsed report |
| 3 | Generic error | `ToolFailure` with stderr |
| 4 | Bad arguments | `ToolFailure` with stderr |

Codes 1 and 2 are not failures — the report still has useful data. Only 3 and 4 are hard failures.

## Profiles

Use a profile preset when you want a curated flag combination without picking each flag:

| Profile | What it does |
|---------|--------------|
| `quick` | top-100 ports, T4, no service/OS — fastest useful sweep |
| `web` | ports 80,443,8080,8443, service detection, http scripts |
| `internal` | top-1000 ports, T4, service detection |
| `full` | all 65535 ports, T4, aggressive (service+OS+traceroute+all scripts) |
| `stealth` | top-100 ports, T2 (polite), SYN scan, randomize — slow and quiet |

If the user says "quick scan", use `profile: "quick"`. If "thorough scan", use `profile: "full"`.

## Aggressive Mode

`aggressive: true` is equivalent to `serviceDetection + osDetection + traceroute + scripts: "all"`. It's the most thorough single-call option. Use only on targets you own — it's noisy and runs every intrusive script.

## Recommended Workflows

### 1. Quick subnet sweep

User: "what's on my home network"

```
nmap({
  targets: ["192.168.1.0/24"],
  topPorts: 100,
  timing: "4",
  profile: "quick"
})
```

### 2. Targeted web service fingerprint

User: "what's running on example.com:443"

```
nmap({
  targets: ["example.com"],
  ports: "443",
  scanType: "connect",
  timing: "3",
  serviceDetection: true,
  tlsProbe: true,
  scripts: "http_headers,http_security_headers,tls_cert_info"
})
```

### 3. SSH version check across a subnet

User: "find every SSH server on 10.0.0.0/24 and tell me the versions"

```
nmap({
  targets: ["10.0.0.0/24"],
  ports: "22",
  scanType: "connect",
  timing: "4",
  serviceDetection: true,
  scripts: "ssh_version,ssh_algorithms"
})
```

### 4. Full pentest recon (authorized target)

User: "do a full recon on 10.0.0.5 — I have permission"

```
nmap({
  targets: ["10.0.0.5"],
  profile: "full",
  aggressive: true,
  timing: "4"
})
```

### 5. Diff two prior scans

The `nmap` tool itself doesn't run a diff (the rnmap CLI has a `--diff` mode, but it operates on files outside the tool). For diffing, save two prior scan results to disk via the `write` tool, then ask the model to compare them in-context — the JSON shape is stable enough for direct structural comparison.

### 6. UDP service discovery

User: "find DNS and SNMP servers on 10.0.0.0/24"

```
nmap({
  targets: ["10.0.0.0/24"],
  ports: "U:53,U:161,U:123",
  scanType: "udp",
  timing: "3",
  scripts: "dns_version,snmp_info,ntp_version"
})
```

### 7. IDS-evasive stealth scan (requires root)

User: "scan 10.0.0.5 quietly, don't trip the IDS"

```
nmap({
  targets: ["10.0.0.5"],
  ports: "1-1000",
  scanType: "syn",
  timing: "2",
  maxRate: 50
})
```

(Add `--decoy` / `--fragment` / `--randomize-targets` via the rnmap CLI directly if you need full evasion — those flags are intentionally not exposed in the tool input schema to keep the permission metadata meaningful.)

## Privilege Notes

- **TCP connect scan** (`-S connect`): works unprivileged. This is the default.
- **SYN/ACK/FIN/Xmas/Null scans** and **OS fingerprinting** require root or `CAP_NET_RAW`. Grant with `sudo setcap cap_net_raw+ep $(which rnmap)` once, then the binary works without sudo.
- **ICMP-based host discovery** requires root. The tool falls back to TCP-ping host discovery when unprivileged (probes port 80 — less reliable but works).
- **UDP scan** is unprivileged but slower (open vs open\|filtered classification).

If the user's session is unprivileged and they need SYN scan, tell them to either run codeshod as root or grant `CAP_NET_RAW` to the rnmap binary.

## Permission Patterns

The tool asserts `action: "nmap"` against the comma-joined target list as `resources`. Suggested repository permission rules:

```jsonc
// .codeshod/codeshod.jsonc — permission section
{
  "permission": {
    "rules": [
      // Allow RFC1918 private ranges without asking
      { "action": "nmap", "resource": "10.0.0.0/8", "effect": "allow" },
      { "action": "nmap", "resource": "172.16.0.0/12", "effect": "allow" },
      { "action": "nmap", "resource": "192.168.0.0/16", "effect": "allow" },
      { "action": "nmap", "resource": "127.0.0.1", "effect": "allow" },
      { "action": "nmap", "resource": "::1", "effect": "allow" },
      // Ask before scanning anything else
      { "action": "nmap", "resource": "*", "effect": "ask" }
    ]
  }
}
```

External scans always prompt the user with the full scan shape (scan type, timing, ports, scripts) so they can verify they have permission before approving.

## Common Mistakes

- **Don't pass `0.0.0.0/0`** — the scanner rejects CIDRs broader than /16. If you genuinely need to scan a /8, do it in /16 chunks.
- **Don't use `T5`** on real networks. It drops too many probes and reports false `filtered` results.
- **Don't combine `-S syn` with `--script all`** on a target you don't own. The scripts include intrusive probes that log on the target.
- **Don't trust `open|filtered`** for UDP. It means "no response" — could be open with no banner, could be filtered. Run a service-specific probe (e.g. `dns_version` for port 53) to disambiguate.
- **Don't rescan immediately after a `filtered` result.** Either drop to a slower timing template or use a different scan type. Hammering a filtered port is what trips IDS rules.
- **Don't forget the Rhai script scope.** Port-scope scripts (most of them) only run on `open` or `open|filtered` ports. If you ask for `--script banner_grab` on a host with no open ports, no scripts will run and `host.scripts` will be empty. That's correct, not a bug.

## Source

- The tool plugin: `packages/core/src/tool/plugin/nmap.ts`
- The scanner source: `packages/cli/assets/rnmap/` (binary + Rhai scripts + README)
- The contract: `specs/v2/tools.md#built-in-network-scanner-nmap`
- Contributor notes: `AGENTS.md#built-in-nmap-tool`

If the rnmap binary is missing from `packages/cli/assets/rnmap/bin/`, the tool falls back to `rnmap` on `PATH` and finally fails with a clear error. For dev worktrees, set `CODESHOD_RNMAP_BIN=/path/to/rnmap` to override.
