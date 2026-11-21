---
name: rustango
description: Use when the user asks to scaffold a Django-style Rust web project, run Django-style management commands (makemigrations, migrate, createsuperuser, check, showmigrations, clearsessions), start a dev HTTP server (runserver), or mentions Django, manage.py, django-admin, startproject, startapp, batteries-included Rust web framework, or wants to build a web app with ORM/templates/auth/admin in Rust. Covers all 11 management commands, the Django-parity surface, when to use rustango vs shark vs msfx vs nmap, and the dev-server timeout semantics.
---

# rustango — Django-style web framework as a built-in Codeshod tool

Codeshod ships with `rustango`, a pure-Rust Django-style batteries-included web framework, as a first-party built-in tool. It is registered under plugin id `codeshod.tool.rustango`, exposed to the model as the `rustango` tool, and bundled with every Codeshod installation (2.3 MB stripped binary at `packages/cli/assets/rustango/bin/`). It is NOT an MCP server and NOT a shell-out to system `django-admin`/`manage.py`.

**Only the stripped binary is bundled** — the rustango source is intentionally NOT in the codeshod tree. Rebuilds land in `packages/cli/assets/rustango/bin/` via the release workflow from the upstream `rustango` project.

This skill teaches you when to use it, which operation to pick, and how to reason about the JSON result it returns.

## When To Use

Use the `rustango` tool when the user's intent is one of these:

- **Scaffold a new Rust web project** — "create a Django-style project", "scaffold mysite", "start a new web app". Use operation `startproject`.
- **Scaffold a new app inside a project** — "add a polls app", "create a blog app". Use operation `startapp`.
- **Run Django-style management commands** — makemigrations, migrate, showmigrations, createsuperuser, clearsessions. Use the corresponding operation.
- **Validate a rustango project configuration** — "check my project config", "what backend am I using". Use operation `check`.
- **Start the dev server and verify it boots** — "does this project boot?", "start the dev server on port 8000". Use operation `runserver` (15-second default timeout — long enough to verify the server starts and curl an endpoint).
- **Get the framework version** — "what rustango version is this?". Use operation `version`.
- **Create an admin user** — "create a superuser for testing". Use operation `createsuperuser` with `username` and `password`.
- **Apply schema migrations** — "run migrations", "apply pending migrations". Use operation `migrate`.
- **Show migration status** — "what migrations are applied?". Use operation `showmigrations`.
- **Generate migration files from model changes** — "make migrations for the polls app". Use operation `makemigrations` with `appArg: "polls"`.
- **Purge expired sessions** — "clean up old sessions". Use operation `clearsessions`.

The user said "Django", "manage.py", "django-admin", "startproject", "startapp", "batteries-included Rust web framework", "makemigrations", "migrate", "createsuperuser", "runserver", "Django-style ORM", or "Django templates" → use this skill.

## When To Use rustango vs shark vs msfx vs nmap

The four built-in dev/pentest tools have distinct purposes:

| Intent | Use |
|--------|-----|
| Live network scanning (port discovery, OS fingerprint, traceroute) | `nmap` |
| Metasploit-style exploitation (payloads, BOF template, encoder) | `msfx` |
| Analyze an existing pcap/pcapng capture file | `shark` |
| Scaffold or run a Django-style web framework | `rustango` |
| Apply ORM migrations, create superusers, run dev server | `rustango` |
| Live packet capture (Linux, AF_PACKET) | `shark` (dumpcap) |

When in doubt: `nmap` for live network recon, `msfx` for exploitation, `shark` for capture file analysis, `rustango` for web app scaffolding and Django-style dev. All four are pure-Rust, all four are first-party Codeshod built-ins, all four are bundled with every installation.

## When NOT To Use

- **Production HTTP serving.** `runserver` is a single-process dev server. Production serving needs a reverse proxy + workers — out of scope for this tool.
- **General HTTP requests.** Use `webfetch` for one-shot HTTP calls.
- **Live packet capture or port scanning.** Use `shark` or `nmap`.
- **Long-running dev sessions.** The tool caps `runserver` at 60 seconds per call (default 15 s). For continuous dev work, the user should run rustango directly in a terminal.
- **Code Mode sessions.** The tool is not exposed in Code Mode (read-only filesystem mode) — scaffolding projects and running dev servers are not read-only operations.
- **Building rustango from source.** Only the stripped binary is bundled. If the user needs to modify rustango itself or build with `--features ai`, they should clone the upstream source — the codeshod tool is for using rustango, not developing it.
- **TLS termination.** rustango's dev server is plain HTTP only (axum http1 feature). For HTTPS, put a reverse proxy in front.

## Operations

The tool exposes a single `operation` parameter. Pick the right one:

| Operation | What it does | Required input fields |
|-----------|--------------|----------------------|
| `version` | Print the framework version | (none) |
| `help` | Show the help text | (none) |
| `check` | Validate configuration: backend, debug, admin, models, routes, middleware | (none) |
| `startproject` | Scaffold a new project | `projectName`, optional `projectDir` |
| `startapp` | Scaffold a new app inside a project | `appName`, optional `projectDir` |
| `makemigrations` | Detect schema changes, write migration files | optional `appArg` (default: `core`) |
| `migrate` | Apply pending migrations | optional `appArg` |
| `showmigrations` | List applied/pending migrations | (none) |
| `createsuperuser` | Create or reset a superuser (PBKDF2-SHA256) | `username`, `password` |
| `clearsessions` | Purge expired sessions | (none) |
| `runserver` | Start the dev HTTP server | optional `addr` (default: `127.0.0.1:8000`) |

## What rustango implements (Django-parity surface)

The rustango binary bundles the full Django architecture:

| Django concept | rustango implementation |
|----------------|--------------------------|
| `settings.py` | Settings builder + TOML overlay (`settings.toml`) |
| `urls.py` | URL routing with path converters (`<int:id>`, `<str:name>`, `<path:rest>`) |
| `views.py` | Function views + class-based views |
| Django Template Language | DTL parser with filters (uppercase, lowercase, length, default, etc.) |
| `models.py` + ORM | Model/ORM layer with `#[derive(Model)]` macro, migrations, querysets |
| Database backend | In-memory (default, ephemeral) or JSON file (`json:db.json`, persistent) |
| `forms.py` | Forms with validation, `as_table()` rendering |
| Sessions | Session middleware with expiration, `clearsessions` command |
| Authentication | PBKDF2-SHA256 in Django wire format (`pbkdf2_sha256$<iter>$<salt>$<base64>`) |
| CSRF | CSRF middleware with `csrf_exempt` opt-out |
| Flash messages | Message middleware + storage |
| Middleware | Request + response phases, short-circuit support |
| Admin site | Auto-generated at `/admin/` (configurable via `settings.admin_url`) |
| i18n | Language catalogs, activation from cookie |
| Cache framework | Pluggable cache backends |
| Static files | Static file serving |
| `manage.py` | The 11 management commands above |
| `contrib.ai` | LLM/agent module (feature-gated, NOT in the bundled binary) |

## Database Backends

The `database` input field (or `RUSTANGO_DB` env) selects the backend:

| Spec | What it does |
|------|--------------|
| `memory` | In-memory backend, ephemeral (default) |
| `json:<path>` | Persistent JSON-file backend (e.g. `json:db.json`) |
| (backend URL) | (future: SQLite/Postgres backends — not in this version) |

For persistent data across `runserver` restarts, use `database: "json:/path/to/db.json"`.

## Output Reading

The tool returns a JSON object with shape:

```jsonc
{
  "operation": "startproject",
  "ok": true,
  "summary": "Project scaffolded at /tmp/mydemo",
  "stdout": "Project scaffolded at /tmp/mydemo:\n  cd /tmp/mydemo\n  cargo run        # starts http://127.0.0.1:8000",
  "stderr": "",
  "data": { "projectPath": "/tmp/mydemo", "raw": "..." },
  "raw": { "exitCode": 0, "argv": "startproject mydemo /tmp", "binary": "rustango-linux-x64" }
}
```

Operation-specific `data` shapes:

- `version` → `{ version: "6.2.0.dev0" }`
- `help` → `{ text: "<full help>" }`
- `check` → `{ config: { backend, debug, admin, models, routes, middleware }, raw: "..." }`
- `startproject` → `{ projectPath: "/path/to/mysite", raw: "..." }`
- `startapp` → `{ appName: "polls", appPath: "/path/to/polls", raw: "..." }`
- `makemigrations` → `{ changesDetected: bool, migrationPath: "...", opsCount: N, raw: "..." }`
- `migrate` → `{ applied: ["0001_initial", ...], raw: "..." }`
- `showmigrations` → `{ text: "..." }`
- `createsuperuser` → `{ username: "root", pk: 1, raw: "..." }`
- `clearsessions` → `{ deleted: 0, raw: "..." }`
- `runserver` → `{ banner: "rustango 6.2.0.dev0 serving http://127.0.0.1:8000 (DEBUG: true)", raw: "..." }`

The tool also returns a human-readable summary as the first content item, e.g.:

```
rustango startproject: ok — Project scaffolded at /tmp/mydemo
project at: /tmp/mydemo
next: cd /tmp/mydemo && cargo run
```

## Exit Codes

The tool surfaces the rustango exit code in `metadata.exitCode`:

| Code | Meaning | Tool behavior |
|------|---------|---------------|
| 0 | OK | Return parsed JSON with `ok: true` |
| 1 | Server error or scaffold failure | Return parsed result with `ok: false` and stderr surfaced |
| 2 | Unknown command or bad args | Return parsed result with `ok: false` and stderr surfaced |

The tool does NOT fail the call on exit 1 or 2 — the agent still gets stdout/stderr to reason about. Only timeout and process-spawn errors fail at the `runRustango` layer.

For `runserver` specifically, hitting the wall-clock timeout is the **expected** way to stop — the tool treats it as success with whatever output was captured (the dev server is designed to run until killed).

## Timeout Defaults

| Operation class | Default | Max |
|-----------------|---------|-----|
| One-shot commands (version, help, check, makemigrations, migrate, showmigrations, createsuperuser, clearsessions) | 30 s | 300 s |
| Scaffolding (startproject, startapp) | 30 s | 300 s |
| `runserver` | 15 s | 60 s |

If you need `runserver` to run longer than 60 s (e.g. to manually test multiple endpoints), tell the user to run rustango directly in a terminal — the tool is best for quick boot verification.

## Recommended Workflows

### 1. Scaffold a new project

User: "create a new Django-style Rust web project called mysite"

```
rustango({
  operation: "startproject",
  projectName: "mysite",
  projectDir: "/path/to/parent/dir"
})
```

The tool creates `/path/to/parent/dir/mysite/` with:
- `Cargo.toml` (depends on rustango + tokio)
- `src/main.rs` (a working "It works!" demo with home view)
- `templates/index.html` (DTL template)
- `settings.toml` (debug=true, database="json:db.json", language_code="en-us")

Tell the user: `cd /path/to/parent/dir/mysite && cargo run` to start the dev server.

### 2. Scaffold a new app inside a project

User: "add a polls app to my project"

```
rustango({
  operation: "startapp",
  appName: "polls",
  projectDir: "/path/to/mysite"
})
```

The tool creates `/path/to/mysite/polls/` with `models.rs`, `views.rs`, and `templates/`. The user then wires it into their project builder: `.urls(vec![...])` and `.add_app(...)`.

### 3. Validate the project configuration

User: "check my rustango project"

```
rustango({ operation: "check" })
```

Returns the backend, debug flag, admin URL, model count, route count, and middleware count.

### 4. Create a superuser

User: "create an admin user with username 'root' and password 'secret'"

```
rustango({
  operation: "createsuperuser",
  username: "root",
  password: "secret",
  database: "json:/path/to/db.json"
})
```

Returns `{ username: "root", pk: 1 }`. The user can now log in at `/admin/`.

### 5. Run migrations

User: "apply pending migrations"

```
// Step 1: generate migration files from model changes
rustango({ operation: "makemigrations", appArg: "core", migrationsDir: "/path/to/migrations" })

// Step 2: apply them
rustango({ operation: "migrate", migrationsDir: "/path/to/migrations" })

// Step 3: check status
rustango({ operation: "showmigrations", migrationsDir: "/path/to/migrations" })
```

### 6. Quick boot smoke test

User: "does my project boot?"

```
// Start the dev server with a short timeout — the tool captures the startup banner.
rustango({
  operation: "runserver",
  addr: "127.0.0.1:18080",
  database: "memory"
})
```

Returns `{ banner: "rustango 6.2.0.dev0 serving http://127.0.0.1:18080 (DEBUG: true)" }`. If the banner appears, the project boots. If stderr shows an error, the project has a config issue.

### 7. Clean up expired sessions

User: "purge old sessions from my db"

```
rustango({
  operation: "clearsessions",
  database: "json:/path/to/db.json"
})
```

Returns `{ deleted: N }`.

### 8. Full project lifecycle (scaffold + run + admin)

User: "create a new project, start it, create an admin user, then verify the admin page loads"

```
// Step 1: scaffold
rustango({ operation: "startproject", projectName: "blog", projectDir: "/tmp" })

// Step 2: create a persistent db + superuser
rustango({
  operation: "createsuperuser",
  username: "admin",
  password: "password",
  database: "json:/tmp/blog/db.json"
})

// Step 3: start the dev server briefly to verify boot
rustango({ operation: "runserver", addr: "127.0.0.1:18090" })

// Step 4: tell the user to curl /admin/ manually (or use webfetch)
```

## Permission Patterns

The tool asserts `action: "rustango"` against an operation-specific resource. Suggested repository permission rules:

```jsonc
// .codeshod/codeshod.jsonc — permission section
{
  "permission": {
    "rules": [
      // Allow read-only operations without asking
      { "action": "rustango", "resource": "version", "effect": "allow" },
      { "action": "rustango", "resource": "help", "effect": "allow" },
      { "action": "rustango", "resource": "check", "effect": "allow" },
      { "action": "rustango", "resource": "showmigrations", "effect": "allow" },
      { "action": "rustango", "resource": "clearsessions", "effect": "allow" },
      // Allow scaffolding in workspace /tmp paths
      { "action": "rustango", "resource": "/tmp/*", "effect": "allow" },
      { "action": "rustango", "resource": "./sprints/*", "effect": "allow" },
      // Always ask before creating superusers (sensitive)
      { "action": "rustango", "resource": "createsuperuser", "effect": "ask" },
      // Always ask before starting dev servers (opens a port)
      { "action": "rustango", "resource": "runserver", "effect": "ask" },
      // Ask before everything else
      { "action": "rustango", "resource": "*", "effect": "ask" }
    ]
  }
}
```

External scaffolding paths and dev server binds always prompt the user with the full operation shape so they can verify the path/port before approving.

## Common Mistakes

- **Don't use `runserver` for production.** It's a single-process dev server. Production serving needs a reverse proxy + workers.
- **Don't expect `runserver` to stay up across tool calls.** The tool caps it at 60 seconds (default 15 s). For continuous dev work, run rustango directly in a terminal.
- **Don't forget `database: "json:..."` for persistent data.** The default `memory` backend is ephemeral — data is lost when the process exits. Use `database: "json:/path/to/db.json"` for data that survives restarts.
- **Don't expect TLS.** rustango's dev server is plain HTTP only. Put a reverse proxy (nginx, caddy) in front for HTTPS.
- **Don't expect `contrib.ai` in the bundled binary.** The LLM/agent module is feature-gated and NOT compiled into the codeshod-bundled binary. If the user needs it, they should build rustango from source with `--features ai`.
- **Don't pass a `password` in approval-prompt metadata.** The tool intentionally does NOT include the password in `metadata` — it's passed to the subprocess via argv (the only way rustango accepts it) but it's not logged. This is by design.
- **Don't forget `migrationsDir` for offline migrations.** By default rustango reads/writes `./migrations`. If the user's project is elsewhere, pass `migrationsDir: "/path/to/migrations"`.
- **Don't use rustango for live packet capture or port scanning.** Use `shark` (pcap) or `nmap` (port scan) instead.
- **Don't expect the rustango source in the codeshod tree.** Only the stripped binary is bundled. If the user wants to read or modify rustango itself, they should clone the upstream project.

## Source

- The tool plugin: `packages/core/src/tool/plugin/rustango.ts`
- The binary: `packages/cli/assets/rustango/bin/rustango-<platform>-<arch>` (2.3 MB stripped, no source bundled)
- The contract: `specs/v2/tools.md#built-in-django-style-web-framework-rustango`
- Contributor notes: `AGENTS.md#built-in-rustango-tool`

If the rustango binary is missing from `packages/cli/assets/rustango/bin/`, the tool falls back to `rustango` on `PATH` and finally fails with a clear error. For dev worktrees, set `CODESHOD_RUSTANGO_BIN=/path/to/rustango` to override.
