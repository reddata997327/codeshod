---
name: dbengine
description: Use for local database operations — create tables with PK/FK/unique keys/indexes, insert/get/update/delete/scan rows, run mini-SQL SELECT, analyze key graphs (PK/FK traversal, topology, diffs), take git-like snapshots/branches/merges, sync to remote PostgreSQL/MySQL, infer schema from raw JSON. Also when the user mentions dbengine, "key-addressed database", "FK graph", "database snapshot/branch/merge", "database sync", "schema fingerprinting", or wants a lightweight local database without installing PostgreSQL/MySQL.
---

# dbengine — Pure-Rust database engine as a built-in Codeshod tool

dbengine is a complete database engine in a single Rust source file (~5,900 lines, std-only, zero external dependencies) shipped as an MCP server with **27 tools**. It is bundled with Codeshod as a first-party built-in tool (1.2 MB binary at `packages/cli/assets/dbengine/bin/`) AND registered as an MCP server in `~/.claude.json` via `dbengine-setup.sh` (linked setup).

The engine is built around one idea: **where key data lives in a database** — primary keys, foreign keys, unique keys, indexes — and what that key graph makes possible.

## When To Use

- Create and query a local database (tables, inserts, scans, SQL)
- Analyze key relationships (PK/FK graph, topology, foreign-key traversal)
- Diff two databases, take snapshots, branch, or merge
- Connect to a remote PostgreSQL/MySQL database, query it, or extract its schema + data locally
- Infer a database schema from raw JSON/API responses
- The user wants a lightweight local database without installing PostgreSQL/MySQL

## The 27 Tools

Pass the tool name via the `tool` field and arguments via `arguments`.

### Core engine

| Tool | Arguments | What it does |
|------|-----------|--------------|
| `db_status` | (none) | Engine status: home dir, databases, tables, row counts |
| `db_create_table` | db, table, columns, primary_key, foreign_keys?, unique_keys?, indexes? | Create a table with first-class keys |
| `db_drop_table` | db, table | Drop a table |
| `db_schema` | db, table | Show a table's full key structure |
| `db_insert` | db, table, rows, upsert? | Insert rows (enforces PK/FK/unique) |
| `db_get` | db, table, key | Fetch a row by primary key |
| `db_update` | db, table, set, key?/where? | Update rows by key or filter |
| `db_delete` | db, table, key?/where? | Delete rows (honors FK restrict/cascade) |
| `db_scan` | db, table, where?, order?, limit?, offset?, cols? | Scan with filters/pagination |
| `db_count` | db, table, where? | Count rows |
| `db_sql` | db, sql | Mini SELECT engine |
| `db_compact` | db | Force WAL compaction |

### Keys engine (novel layer)

| Tool | Arguments | What it does |
|------|-----------|--------------|
| `db_keys` | db? / connection? / conn? | Key-graph map: every table's PK/FK/unique/index + where stored |
| `db_graph` | db, table, key, hops?, direction? | Walk FK edges from one row, N hops |
| `db_topo` | db | FK-topological order + cycle detection |
| `db_diff` | db_a, db_b, limit? | Diff two databases by primary key |
| `db_snapshot` | action, db, name? | Git-like snapshots (create/list/restore/drop) |
| `db_branch` | db, branch, from_snapshot? | Full copy of a db |
| `db_merge` | from_db, into_db, strategy? | Merge by key (upsert/skip/replace) |
| `db_sync` | local_db, connection?/conn?, direction?, tables?, limit? | Key-based incremental sync local↔remote |

### Remote + extractor

| Tool | Arguments | What it does |
|------|-----------|--------------|
| `db_connect` | name, kind, host?, port?, user?, password?, database?/url?, headers?, body?, save? | Test + save a remote connection |
| `db_remote_query` | connection?/conn?, sql | Run SQL on remote postgres/mysql or fetch HTTP endpoint |
| `db_remote_schema` | connection?/conn? | Introspect remote schema + key graph |
| `db_extract` | target_db, connection?/conn?, tables?, page_size?, save_bundle?, bundle_name? | Extract remote data in FK-topological order |
| `db_import_bundle` | file, target_db | Import a bundle file |
| `db_export_bundle` | db, name? | Export to a portable bundle |

### Fingerprint

| Tool | Arguments | What it does |
|------|-----------|--------------|
| `db_fingerprint` | json?/file?, name?, create?, target_db? | Infer schema + keys + FKs from raw JSON, optionally materialize |

## Column dtypes

`integer`, `real`, `text`, `boolean`, `json`. Use `auto: true` on an integer column for auto-increment keys.

## Key types

- **primary_key**: array of column names (composite keys supported). The PK is the row's identity — snapshots, branches, merges, diffs, and sync are all key-addressed.
- **foreign_keys**: `[{columns, ref_table, ref_columns, on_delete: "restrict"|"cascade"}]`
- **unique_keys**: array of column-combos `[["col_a", "col_b"]]` that must be unique (NULLs are distinct, SQL semantics)
- **indexes**: `[{name?, columns, unique?}]`

## Data directory

Data lives in `$DBENGINE_HOME` (default `~/.dbengine`). Pass `home: "/path/to/dir"` to use a project-local directory.

```
~/.dbengine/
  databases/<db>/catalog.json     ← schema + PK/FK/unique/index definitions
  databases/<db>/wal/<table>.jsonl ← rows, each line addressed by PK value
  snapshots/<db>/<name>.json      ← key-addressed snapshots (git-like)
  extracts/<name>.json            ← portable extract/export bundles
  connections.json                ← saved remote connection profiles
```

## Linked setup (MCP registration)

dbengine is both a codeshod built-in tool AND a registered MCP server. The `dbengine-setup.sh` script:
1. Installs the binary to `~/.local/bin/dbengine`
2. Runs selftest (8 crypto + engine checks)
3. Registers in `~/.claude.json` as `mcpServers.dbengine` (atomic write, never clobbers)
4. Also handles Codex (`~/.codex/config.toml`) if present

After running the setup script, restart your MCP client and check with `/mcp`. The codeshod tool plugin and the MCP registration are linked — both use the same binary and data directory.

## Recommended Workflows

### Create a table and insert data

```
dbengine({ tool: "db_create_table", arguments: {
  db: "myapp", table: "users",
  columns: [{name: "id", dtype: "integer", auto: true}, {name: "name", dtype: "text"}, {name: "email", dtype: "text"}],
  primary_key: ["id"], unique_keys: [["email"]]
}})
dbengine({ tool: "db_insert", arguments: {
  db: "myapp", table: "users",
  rows: [{name: "Alice", email: "alice@test.com"}, {name: "Bob", email: "bob@test.com"}]
}})
```

### Query data

```
dbengine({ tool: "db_scan", arguments: { db: "myapp", table: "users" }})
dbengine({ tool: "db_sql", arguments: { db: "myapp", sql: "SELECT * FROM users WHERE name = 'Alice'" }})
dbengine({ tool: "db_get", arguments: { db: "myapp", table: "users", key: 1 }})
```

### Key graph analysis

```
dbengine({ tool: "db_keys", arguments: { db: "myapp" }})
dbengine({ tool: "db_graph", arguments: { db: "myapp", table: "users", key: 1, hops: 2 }})
dbengine({ tool: "db_topo", arguments: { db: "myapp" }})
```

### Snapshot + branch + merge

```
dbengine({ tool: "db_snapshot", arguments: { action: "create", db: "myapp", name: "v1" }})
dbengine({ tool: "db_branch", arguments: { db: "myapp", branch: "myapp-dev" }})
// ... modify myapp-dev ...
dbengine({ tool: "db_merge", arguments: { from_db: "myapp-dev", into_db: "myapp", strategy: "upsert" }})
```

### Connect to remote PostgreSQL

```
dbengine({ tool: "db_connect", arguments: {
  name: "prod-pg", kind: "postgres", host: "10.0.0.5", port: 5432,
  user: "reader", password: "secret", database: "appdb"
}})
dbengine({ tool: "db_remote_query", arguments: { connection: "prod-pg", sql: "SELECT count(*) FROM users" }})
dbengine({ tool: "db_remote_schema", arguments: { connection: "prod-pg" }})
```

### Extract remote data locally

```
dbengine({ tool: "db_extract", arguments: {
  target_db: "prod_copy", connection: "prod-pg", page_size: 1000
}})
```

### Fingerprint from JSON

```
dbengine({ tool: "db_fingerprint", arguments: {
  json: '{"users": [{"id": 1, "name": "Alice", "email": "a@b.com"}]}',
  name: "api_users", create: true, target_db: "fingerprinted"
}})
```
