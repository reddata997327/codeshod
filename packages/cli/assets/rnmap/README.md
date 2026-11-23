# rnmap — Pure-Rust nmap-compatible network scanner for AI-agent CLI

`rnmap` is a pure-Rust implementation of nmap-style network scanning, built
for use as a tool invoked by AI agents. It produces a **stable, versioned JSON
schema** that agents can parse reliably, supports the major scan types from
nmap, OS fingerprinting, service detection, traceroute, Rhai-based scripting
(NSE-like), and IDS-evasion primitives.

**Pure Rust** means no C dependencies to install — `cargo build` is enough.
Packet crafting uses `pnet_packet` (pure-Rust builders) and raw sockets via
`libc`/`socket2` (kernel syscalls, no userspace C library).

## Build

```bash
cargo build --release
# binary: target/release/rnmap
```

To enable raw-socket scans (SYN/ACK/FIN/Xmas/Null), run as root or grant
`CAP_NET_RAW`:

```bash
sudo setcap cap_net_raw+ep target/release/rnmap
```

Without root, `rnmap` auto-falls back to TCP-connect scans.

## Quick start

```bash
# basic TCP connect scan
rnmap 127.0.0.1 -p 1-1000

# service + OS detection + traceroute
rnmap scanme.nmap.org -p 22,80,443 -V -O --traceroute

# SYN scan with T4 aggressive timing
sudo rnmap 10.0.0.1 -p 1-65535 -S syn -T4

# CIDR scan
rnmap 10.0.0.0/24 -p 80,443 -T4

# Run Rhai scripts on each open port
rnmap 127.0.0.1 -p 1-1000 --script banner_grab,ssh_version,http_title

# IDS evasion: decoys + fragmentation
sudo rnmap 10.0.0.1 -p 80 -S syn --decoy 10.0.0.5,10.0.0.99,RND:5 -f

# UDP scan
rnmap 8.8.8.8 -p U:53 -S udp

# Top 100 most common ports (built-in ranked list)
rnmap 10.0.0.0/24 --top-ports 100 -T4

# Read targets from stdin (one per line, # = comment, dups auto-removed)
cat hosts.txt | rnmap - -p 22,80 --ndjson

# NDJSON streaming: one host JSON per line + final stats line (best for agent pipelines)
rnmap 10.0.0.0/24 -p 1-1024 --ndjson | jq -c 'select(.type != "stats")'

# Resume: skip hosts already marked up in a prior JSON output
rnmap 10.0.0.0/24 -p 1-65535 --resume prior.json -o updated.json

# Rate limit (max packets/sec — useful for slow IDS evasion)
rnmap 10.0.0.1 -p 1-65535 --max-rate 100 -T3

# Pretty JSON to a file
rnmap 10.0.0.1 -p 1-1024 -o scan.json --pretty

# List resolved targets (no scan) — supports stdin too
rnmap 192.168.1.0/24 --list-targets

# IPv6 connect scan
rnmap ::1 -p 1-1000 -T4

# Aggressive mode: service + OS + traceroute + all scripts in one command
rnmap 10.0.0.1 -p 1-1000 -A -T4

# Read targets from file (nmap-style -iL)
rnmap --iL hosts.txt -p 22,80 -T4

# Compare two prior JSON reports, emit only changes (no scan)
rnmap --diff baseline.json current.json --pretty

# Stream diff changes as NDJSON (one change per line)
rnmap --diff baseline.json,current.json --ndjson | jq -c .

# Watch mode: rescan every 30s, emit NDJSON change events per tick
rnmap 10.0.0.0/24 -p 22,80,443 --watch 30 > changes.ndjson

# Markdown report alongside JSON (for human-readable summary)
rnmap 10.0.0.1 -p 1-1024 -V --md report.md -o report.json

# Adaptive RTT: auto-tune probe timeout from observed RTTs
rnmap 10.0.0.0/24 -p 1-65535 --adaptive-rtt -T4
```

## Scan types

| Flag       | Description                              | Requires root |
|------------|------------------------------------------|---------------|
| `-S connect` | TCP connect scan (unprivileged)       | no            |
| `-S syn`   | TCP SYN scan (stealth)                   | yes           |
| `-S ack`   | TCP ACK scan (firewall mapping)          | yes           |
| `-S fin`   | TCP FIN scan                             | yes           |
| `-S xmas`  | TCP Xmas scan (FIN+PSH+URG)              | yes           |
| `-S null`  | TCP Null scan                            | yes           |
| `-S udp`   | UDP scan                                 | no            |
| `-S ping`  | Host discovery only                      | no            |
| `-S all`   | SYN + UDP combined                       | yes           |

## Timing templates

`-T 0` (paranoid) → `-T 5` (insane). Default `-T 3` (normal).

| Template | Parallelism | Retries | Probe timeout |
|----------|-------------|---------|---------------|
| T0       | 1           | 10      | 5s            |
| T1       | 1           | 5       | 3s            |
| T2       | 4           | 3       | 2s            |
| T3       | 64          | 3       | 1.5s          |
| T4       | 256         | 2       | 800ms         |
| T5       | 1024        | 1       | 300ms         |

## Output: versioned JSON schema (1.0)

The output is a single JSON object to stdout (or `-o file`). Compact by
default for agent pipelines; `--pretty` for human inspection.

```json
{
  "schema_version": "1.0",
  "scanner": { "name": "rnmap", "version": "0.4.0", "started_at": "...", "elapsed_ms": 492 },
  "scan": { "targets": ["scanme.nmap.org"], "port_spec": "22,80,443", "scan_type": "connect", "timing_template": "T4 (normal)", "flags": {...} },
  "hosts": [
    {
      "address": "45.33.32.156",
      "hostname": "scanme.nmap.org",
      "state": "up",
      "rtt_ms": 12.4,
      "os": { "name": "Linux 5.x kernel", "accuracy": 95, ... },
      "ports": [
        {
          "port": 80,
          "protocol": "tcp",
          "state": "open",
          "state_reason": "syn-ack",
          "service": { "name": "http", "product": "Apache", "version": "2.4.7", "extrainfo": "(Ubuntu)", "method": "probed", "conf": 8 },
          "scripts": [
            { "id": "banner_grab", "output": "..." }
          ]
        }
      ],
      "traceroute": [ { "ttl": 1, "ip": "10.0.0.1", "rtt_ms": 0.8 }, ... ]
    }
  ],
  "stats": { "hosts_total": 1, "hosts_up": 1, "ports_open": 2, "ports_closed": 1, "scripts_run": 2 }
}
```

The schema version is bumped only on breaking changes; agents can rely on
field stability within a major version.

### Exit codes

| Code | Meaning                          |
|------|----------------------------------|
| 0    | OK — all targets up              |
| 1    | No targets up                    |
| 2    | Partial scan (some targets down) |
| 3    | Generic error                    |
| 4    | Bad arguments                    |

## Rhai scripting

Drop `.rhai` files into a `scripts/` directory (next to the binary, in
`./scripts`, or `/usr/share/rnmap/scripts`). Each script runs at host or
port scope with these variables:

- `host_ip`     — string
- `host_name`   — string (may be empty)
- `port`        — integer (port scope only)
- `proto`       — `"tcp"` or `"udp"` (port scope only)
- `script_args` — comma-separated `key=value` list

Registered helper functions:

- `tcp_connect(target, port) -> string`       — connect + read banner
- `tcp_send_recv(target, port, payload) -> string`
- `udp_send_recv(target, port, payload) -> string`
- `http_get(target, port, path) -> string`

### Built-in scripts (in `scripts/`)

| Script               | Scope | Description                                  |
|----------------------|-------|----------------------------------------------|
| `banner_grab`        | port  | passive TCP banner                           |
| `ssh_version`        | port  | extract SSH version string                   |
| `http_title`         | port  | extract `<title>` from HTTP response         |
| `http_headers`       | port  | dump HTTP response headers                   |
| `http_robots`        | port  | fetch `/robots.txt` and report first 500B    |
| `http_server_status` | port  | probe Apache mod_status `/server-status`     |
| `mysql_probe`        | port  | parse MySQL greeting packet                  |
| `redis_info`         | port  | send `INFO server`, extract redis_version    |
| `mongodb_probe`      | port  | probe MongoDB wire protocol                  |
| `postgres_probe`     | port  | send startup message, detect error response  |
| `rdp_probe`          | port  | send TPKT/COTP CR, detect RDP                |
| `vnc_banner`         | port  | detect RFB greeting                          |
| `smb_negotiate`      | port  | SMB1/SMB2 negotiate protocol request         |
| `tls_cert_info`      | port  | send TLS ClientHello, detect ServerHello     |
| `mdns_query`         | port  | UDP mDNS query for `_services._dns-sd._udp`  |
| `snmp_info`          | port  | SNMPv1 GetRequest for sysDescr.0             |

### Writing a new script

```rhai
// scripts/telnet_banner.rhai
if proto != "tcp" { return ""; }
let b = tcp_connect(host_ip, port);
if starts_with(b, "\xff") { "(telnet negotiation)" } else { "" }
```

Run with `--script telnet_banner` (or `--script all` to discover all).

## IDS evasion

- `--decoy 10.0.0.5,10.0.0.99,RND:5,ME` — interleaves spoofed-source probes
- `-f` / `--fragment` — fragment raw packets into 8-byte chunks
- `--randomize-targets` / `--randomize-ports` — shuffle scan order
- `-T 0` / `-T 1` — slow timing for IDS evasion
- `-g <port>` — fixed source port

## OS detection (`-O`)

Sends TCP SYN probes with specific window sizes, measures:

- TCP window size in SYN|ACK response
- IP TTL of response
- TCP options echoed back
- ISN (initial sequence number) increment pattern

Matches against a built-in signature table covering Linux, Windows, macOS,
FreeBSD, Solaris, and Cisco IOS. Requires raw sockets (root).

## Service detection (`-V`)

Two-phase:

1. **Passive banner grab** — read the first 1 KB after connect.
2. **Active probes** — port-specific payloads (HTTP GET, RTSP OPTIONS, DNS
   version.bind, etc.).

Banner parser recognizes SSH, FTP, SMTP, POP3, IMAP, HTTP, RTSP and emits
`{ name, product, version, extrainfo }` with a 0-10 confidence score.

## Traceroute (`--traceroute`)

UDP-based with increasing TTL (1..30), listens for ICMP time-exceeded and
port-unreachable. Reports each hop's IP and RTT.

## Project layout

```
src/
├── main.rs           — entry point, CLI dispatch, exit codes, NDJSON/diff/watch streamer
├── cli.rs            — clap argument parser
├── target.rs         — host & port spec parser (CIDR, ranges, hostnames)
├── timing.rs         — T0–T5 templates
├── result.rs         — versioned JSON schema types
├── top_ports.rs      — built-in ranked top-100 TCP & UDP port lists
├── resume.rs         — load prior JSON report, skip finished hosts
├── diff.rs           — compare two reports, emit host/port/service changes
├── markdown.rs       — human-readable Markdown report generator
├── output/mod.rs     — JSON writer
├── raw/mod.rs        — IPv4+TCP packet builder, raw socket layer
├── scan/
│   ├── mod.rs        — scanner coordinator (per-host callback, adaptive RTT state)
│   ├── tcp_connect.rs — async TCP connect scan
│   ├── tcp_raw.rs    — SYN/ACK/FIN/Xmas/Null scans
│   ├── udp.rs        — UDP scan
│   └── host_discovery.rs — TCP/ICMP ping
├── os/mod.rs         — OS fingerprinting (expanded signature DB)
├── service/mod.rs    — service/version detection
├── traceroute.rs     — UDP traceroute
├── script/mod.rs     — Rhai engine host
└── evasion/mod.rs    — decoys, fragmentation, jitter primitives

scripts/              — 16 Rhai scripts (.rhai)
```

## AI-agent integration features

| Feature | Flag | Description |
|---------|------|-------------|
| Versioned JSON schema | (always on) | `schema_version: "1.0"` stable contract |
| NDJSON streaming | `--ndjson` | one host JSON per line + final `{"type":"stats",...}` line |
| stdin targets | `rnmap - -p 80` | reads targets from stdin, `#` = comment, dups auto-removed |
| Input file | `--iL FILE` | nmap-style target file (one per line, `#` comments) |
| Resume | `--resume FILE` | skips hosts already marked `up` with ports in prior JSON |
| Top-N ports | `--top-ports N` | built-in ranked top-100 TCP + top-100 UDP list |
| Max rate | `--max-rate N` | cap packets/sec, clamps parallelism |
| Aggressive | `-A` | combines `-V -O --traceroute --script all` |
| Diff | `--diff A B` | compare two prior JSON reports, emit only changes |
| Watch | `--watch SECS` | periodic rescan, NDJSON tick + change events per cycle |
| Markdown | `--md FILE` | human-readable Markdown report alongside JSON |
| Adaptive RTT | `--adaptive-rtt` | auto-tune probe timeout from observed RTTs |
| Exit codes | (always on) | 0 ok / 1 no targets up / 2 partial / 3 error |
| IPv6 connect | `rnmap ::1 -p 1-1000` | works without root for connect scan |

### NDJSON output shape

Each host produces a single compact JSON line as soon as its scan completes:

```
{"address":"10.0.0.5","hostname":null,"state":"up","rtt_ms":0.8,"os":null,"ports":[...],"traceroute":[],"scripts":[]}
{"address":"10.0.0.6","hostname":null,"state":"down","state_reason":"no-response","rtt_ms":null,"os":null,"ports":[],"traceroute":[],"scripts":[]}
{"type":"stats","schema_version":"1.0","stats":{...},"scanner":{...},"scan":{...}}
```

Agents can `select(.type != "stats")` to filter host lines, or read the final
stats line to get the scan summary.

### Diff output shape

`--diff BASELINE CURRENT` emits a `DiffReport` with `changes` (a list of
`HostChange` variants) and `stats`:

```json
{
  "schema_version": "1.0",
  "diff": true,
  "baseline_file": "baseline.json",
  "current_file": "current.json",
  "changes": [
    {"type":"host_new","address":"10.0.0.5","hostname":null,"state":"up"},
    {"type":"host_gone","address":"10.0.0.99","hostname":null},
    {"type":"port_change","address":"10.0.0.1","port":80,"protocol":"tcp","old_state":"open","new_state":"closed","service":null},
    {"type":"service_change","address":"10.0.0.1","port":22,"protocol":"tcp","old":{"name":"ssh","version":"8.9"},"new":{"name":"ssh","version":"9.0"}}
  ],
  "stats": {"hosts_new":1,"hosts_gone":1,"ports_opened":0,"ports_closed":1,"services_changed":1}
}
```

With `--ndjson`, each change is emitted as a separate line followed by a
`diff_stats` summary line — ideal for piping into `jq` or an agent pipeline.

### Watch output shape

`--watch SECS` emits, per tick:
1. A `{"type":"tick",...}` marker line
2. One host JSON line per host (NDJSON stream)
3. (From tick 2 onward) One change-event line per diff vs the previous tick
4. A `{"type":"tick_diff",...}` summary of changes
5. A `{"type":"tick_stats",...}` final summary line

If `--output FILE` is also given, each tick's full JSON is written to
`FILE.NNNN.json` (zero-padded tick number); similarly for `--md FILE.NNNN.md`.

## Tested feature matrix

| Feature                         | Working | Notes                                   |
|---------------------------------|---------|-----------------------------------------|
| TCP connect scan                | yes     | unprivileged                            |
| UDP scan                        | yes     | unprivileged                            |
| Host discovery (TCP ping)       | yes     | unprivileged                            |
| Host discovery (ICMP echo)      | yes     | requires root                           |
| IPv6 connect scan               | yes     | unprivileged, `::1` tested              |
| CIDR / range / hostname targets | yes     | /16 minimum size                        |
| Port spec parsing               | yes     | ranges, lists, T:/U: prefixes           |
| Top-N ports                     | yes     | `--top-ports N`                         |
| Timing T0–T5                    | yes     |                                         |
| Service detection               | yes     | banner + active probes                  |
| Rhai scripting                  | yes     | host + port scope, 16 built-in scripts  |
| JSON output (schema 1.0)        | yes     | compact + pretty                        |
| NDJSON streaming                | yes     | `--ndjson`, host-per-line + stats line  |
| stdin targets                   | yes     | `rnmap - -p 80`, dedup + comments       |
| Input file                      | yes     | `--iL FILE`, nmap-style                 |
| Resume                          | yes     | `--resume FILE`, merges prior results   |
| Max-rate                        | yes     | `--max-rate N` clamps parallelism       |
| Aggressive mode                 | yes     | `-A` = `-V -O --traceroute --script all`|
| Diff                            | yes     | `--diff A B`, detects host/port/service changes |
| Watch                           | yes     | `--watch SECS`, NDJSON tick + change events |
| Markdown report                 | yes     | `--md FILE`                             |
| Adaptive RTT                    | yes     | `--adaptive-rtt` auto-tunes timeout     |
| Exit codes                      | yes     | 0/1/2/3                                 |
| SYN/ACK/FIN/Xmas/Null scans     | code ✓  | requires root/CAP_NET_RAW               |
| OS fingerprinting               | code ✓  | requires root; DB covers Linux/Win/macOS/BSD/Solaris/Cisco/Juniper/HP-UX/AIX |
| Traceroute                      | code ✓  | requires root for ICMP listen           |
| Decoys                          | code ✓  | requires root                           |
| Fragmentation                   | code ✓  | requires root                           |
| Randomize targets/ports         | yes     |                                         |

## License

MIT. Original implementation; not affiliated with nmap.org.
Networking concepts (port scanning, OS fingerprinting) are publicly documented
in RFCs and academic literature.
