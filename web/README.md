# Delivery App — web

Next.js app for the construction-site delivery service. Routes in `app/`:

- `(auth)` — `/login`, `/request-access`.
- `(console)` — the dispatcher console: `/dispatch` (review queue and orders) and `/admin` (users).
- `/driver` — the driver's jobs and steps.
- `/portal` — the customer portal: start an order, approve it, follow delivery.
- `/api/webhooks/mailgun/{inbound,mime}` — inbound cart email.
- `/mockups` and `/design` — design references; they return 404 in production.

Architecture, ADRs, and runbooks: [`../docs/`](../docs/README.md).

## Requirements

- **Node 24** — `.nvmrc` at the repo root; `nvm use`
- **Bun 1.3.11** — pinned by `packageManager` in `package.json`

## Getting started

```bash
bun install
bun dev            # http://localhost:3000
```

`bun dev` runs Next.js on the **Bun runtime** (`bun --bun next dev`). `build` and `start` run on **Node**, matching Vercel.

## Scripts

| Command                | What it does                               |
| ---------------------- | ------------------------------------------ |
| `bun dev`              | Dev server (Bun runtime, Turbopack)        |
| `bun run build`        | Production build (Node)                    |
| `bun start`            | Serve the production build (Node)          |
| `bun run lint`         | ESLint                                     |
| `bun run typecheck`    | `tsc --noEmit`                             |
| `bun run format`       | Prettier, including Tailwind class sorting |
| `bun run format:check` | Prettier check (CI)                        |

Run these from `web/` — Prettier's Tailwind plugin resolves from this directory.

## Environment variables

Copy `.env.example` to `.env.local` and fill it in. `.env.local` is gitignored; `.env.example` is the committed contract — see [11 — Deployment & Environments](../docs/architecture/11-deployment-and-environments.md#configuration).

## Dev container

Open the repo root in VS Code or Devin Desktop, then run **Dev Containers: Reopen in Container**. The container pins Node 24 + Bun 1.3.11 and keeps `node_modules`, `.next`, and Bun's cache in named volumes.

If hot reload misses changes (Docker/WSL/VM), uncomment `watchOptions.pollIntervalMs` in `next.config.ts`.
