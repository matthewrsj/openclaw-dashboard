# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A native macOS desktop app (Tauri 2 + React 19 + TypeScript) for managing an OpenClaw AI agent
fleet -- monitoring agents, chatting, scheduling cron jobs, and observing communication channels.

## Commands

```bash
npm run tauri dev       # Full dev mode (Tauri + Vite). Required for Tauri APIs.
npm run dev             # Vite-only browser preview (Tauri APIs return null)
npm run build           # Type-check + production build
npm run lint            # ESLint (--max-warnings 0)
npm run format          # Prettier (src/**)
npm run package         # Build distributable .dmg
npx vitest              # Run all tests
npx vitest run src/__tests__/stores/cron.test.ts   # Single test file
```

`npm run build` uses `tsconfig.build.json` which excludes `src/__tests__/` from type-checking.
The full `tsconfig.json` includes tests and is used by the IDE.

## Architecture

### Frontend (src/)

**Routing:** TanStack Router v1 with file-based routing. Routes live in `src/routes/`.
`src/routeTree.gen.ts` is auto-generated -- never edit it. All routes are flat under
`__root.tsx` which wraps the `AppShell` layout.

**State:** Zustand v5 stores in `src/stores/`. Stores hold `Map<key, value>` collections with
derived stable arrays (e.g., `agentList`, `activeAgents`). Stores are called outside React via
`useXxxStore.getState()` in event handlers and services -- this is intentional.
Settings persist via `tauri-plugin-store`, not Zustand persist middleware.
The `models` store fetches available models from the Gateway's `/v1/models` endpoint
with a hardcoded fallback list when the gateway is unreachable.

**Gateway communication (two paths):**
- **WebSocket (primary):** Rust backend manages a persistent WS connection. Frontend listens to
  Tauri events (`gateway:connected`, `gateway:disconnected`, `gateway:event`). Events are
  dispatched to stores in `gateway-event-router.ts`.
- **HTTP (secondary):** `GatewayHttpClient` in `gateway-http.ts` for OpenAI-compatible REST +
  SSE streaming (`/v1/chat/completions`).
- **RPC:** `gatewayRpc(method, params)` sends JSON-RPC over WS via the Rust backend.
- **CLI fallback:** `execCliJson(args)` shells out to the local `openclaw` binary.

**Tauri IPC:** All `invoke()` calls are wrapped in `src/services/tauri-commands.ts`. A
`safeInvoke()` wrapper returns `null` outside Tauri so the UI renders in a plain browser.

**HMR safety:** `gateway-event-router.ts` uses a mutable `currentRouter` ref pattern so HMR
updates take effect without re-registering the Tauri listener. `gateway-ws.ts` guards against
double-init with an `initialized` flag.

### Rust Backend (src-tauri/)

- `AppState` uses `parking_lot::RwLock` for shared state across async tasks
- Keychain access via `security-framework` for token storage
- Ed25519 device identity at `~/.openclaw/dashboard-device-key`
- `exec_cli` validates args against a hardcoded allowlist and rejects shell metacharacters
- `write_workspace_file` validates against `ALLOWED_FILES`/`ALLOWED_DIRS` allowlists with
  parent-directory canonicalization for path traversal protection
- `resolve_openclaw_path()` uses a login shell (`zsh -lc which`) to find the `openclaw`
  binary, since macOS apps launched from Finder don't inherit the user's PATH
- Log tail commands validate `agent_id` to reject path separators
- WS auth: challenge-response with Ed25519 signature, token zeroed from memory after connect

### Styling

Tailwind CSS v4 via Vite plugin (no `tailwind.config.*`). Theme tokens are CSS custom properties
in `src/styles/themes.css`, bridged into Tailwind via `@theme inline` in `globals.css`.
Theme is controlled by `data-theme` attribute on `<html>` ("light" | "dark" | absent for system).
Custom UI primitives in `src/components/ui/` -- no shadcn/ui, no clsx, no tailwind-merge.
`cn()` in `src/lib/utils.ts` handles conditional class merging.

### Testing

Vitest with jsdom, `@testing-library/react`. Config is inline in `vite.config.ts`. Setup file
(`src/__tests__/setup.ts`) mocks all Tauri APIs, `matchMedia`, `IntersectionObserver`,
`ResizeObserver`. Store tests reset state in `beforeEach` via `useXxxStore.setState({...})`.

## Conventions

- Path alias: `@/` maps to `src/`
- Line wrap at 100 characters
- `no-console` rule: only `console.warn`, `console.error`, `console.info` allowed
- TypeScript strict mode with `noUnusedLocals` and `noUnusedParameters`
- Prettier with `prettier-plugin-tailwindcss`
- Monospace font stack: SF Mono, JetBrains Mono, Fira Code, Cascadia Code
- Accent color: indigo
