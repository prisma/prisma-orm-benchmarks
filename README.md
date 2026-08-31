# ORM Benchmarks

A benchmark suite comparing the end-to-end HTTP performance of several
PostgreSQL access strategies from Node.js:

- **Prisma 8 RC** (`@prisma/orm-postgres`)
- **Prisma 7** (`@prisma/client`)
- **Drizzle** (`drizzle-orm`)
- **Raw `pg` + raw SQL** (baseline)

Each implementation exposes the same 13 HTTP endpoints (paginated lookups,
single-record lookups, full-text search, and relational reads) against the
same PostgreSQL database. [k6](https://k6.io/) drives the load; results are
combined into `data.json` and rendered by `visualization.html`.

> This repository is a fork of
> [drizzle-team/drizzle-benchmarks](https://github.com/drizzle-team/drizzle-benchmarks).

## Requirements

- [Docker](https://www.docker.com/) — to run PostgreSQL
- [k6](https://k6.io/docs/get-started/installation/) — load generator
- [DuckDB](https://duckdb.org/docs/installation/) — used by the
  result-preparation pipeline
- Node.js ≥ 22.18 (required by Prisma 8; the project is developed against Node 24) and
  [pnpm](https://pnpm.io/)

## Setup

```bash
pnpm install
```

### 1. Start PostgreSQL

```bash
pnpm start:docker
```

The container's port is configured in `src/docker.ts` (default `5432`).
Make sure `.env` points at it:

```env
DATABASE_URL="postgres://postgres:postgres@localhost:5432/postgres"
```

### 2. Seed the database

```bash
pnpm start:seed
```

Dataset size is configured in `src/seed.ts` (`nano` | `micro`).

### 3. Generate the shared request list

```bash
pnpm start:generate
```

This writes `./data/requests.json` — the deterministic list of HTTP
requests that k6 replays against every server.

## Running each benchmark

Each server is clustered across all CPU cores and listens on its own port,
so only **one at a time** can be running. For every implementation you want
to benchmark, repeat the following loop:

1. Start the server (table below).
2. From the load-generator machine (or another shell on the same machine),
   run `pnpm tsx bench/index` against it.
3. Stop the server.

### Prisma 8 RC — port 3002

```bash
# Server (one-time contract codegen, then start)
pnpm prepare:prisma-next
pnpm start:prisma-next

# Benchmark
pnpm tsx bench/index --host http://<host>:3002 --name prisma-next --folder results
```

### Prisma 7 — port 3001

```bash
# Server (one-time codegen, then start)
pnpm prepare:prisma
pnpm start:prisma

# Benchmark
pnpm tsx bench/index --host http://<host>:3001 --name prisma7 --folder results
```

### Drizzle — port 3000

```bash
# Server
pnpm start:drizzle

# Benchmark
pnpm tsx bench/index --host http://<host>:3000 --name drizzle --folder results
```

### Raw `pg` + raw SQL — port 3003

```bash
# Server
pnpm start:pg

# Benchmark
pnpm tsx bench/index --host http://<host>:3003 --name pg --folder results
```

> The `--name` argument is the key used in `data.json` and in
> `visualization.html`. Use exactly `drizzle`, `pg`, `prisma7`, or
> `prisma-next` if you want runs to show up in the bundled dashboard.

Each run takes ~10 minutes (k6 ramps from 200 → 3000 VUs across the stages
defined in `bench/bench.js`) and produces two files in `results/`:

- `results/<name>.parquet` — k6 metrics
- `results/cpu-usage-<name>.csv` — server CPU samples

## Combine results and view

After all the runs you want are in `results/`, merge them into a single
`data.json`:

```bash
pnpm tsx bench/prepare --folder results
```

Then open `visualization.html` from any static file server in this
directory, for example:

```bash
npx serve .
# then open http://localhost:3000/visualization.html
```

The dashboard reads `data.json` and renders one series per implementation
configured in the `colors` map inside `visualization.html`.

## Notes

- For maximum accuracy, run the server and the load generator on **two
  separate machines** connected over a low-latency link so the load
  generator doesn't compete for CPU with the server under test.
- Only one server should be running at a time — each forks across every
  available CPU core.
