# OpenClaw Dashboard

A native macOS desktop app for managing an OpenClaw AI agent fleet.
Monitor agents, chat in real time, schedule cron jobs, and configure
communication channels -- all from a single dashboard.

Built with [Tauri 2](https://tauri.app), React 19, TypeScript, and
Zustand.

## Features

- **Fleet overview** -- see all agents at a glance with status, cost,
  and token metrics
- **Real-time chat** -- send messages, stream responses, queue follow-ups
- **Cron scheduling** -- create and manage recurring agent tasks with
  preset or custom cron expressions
- **Channel management** -- configure and bind Telegram, Discord, Slack,
  WhatsApp, and Signal accounts
- **Memory/identity editor** -- view and edit agent SOUL.md, MEMORY.md,
  and other workspace files
- **Live log tailing** -- stream agent logs in real time
- **Session tracking** -- monitor token usage and costs across sessions

## Prerequisites

- macOS 14.0+
- [OpenClaw CLI](https://github.com/openclaw-ai/openclaw) installed and
  on your PATH
- A running OpenClaw Gateway instance

## Install

Download the `.dmg` from
[Releases](https://github.com/openclaw-ai/openclaw-dashboard/releases),
open it, and drag the app to `/Applications`.

> The app is not code-signed. Right-click and select "Open" the first
> time to bypass Gatekeeper.

## Development

```bash
npm install
npm run tauri dev       # Full dev (Tauri + Vite)
npm run dev             # Browser-only preview (Tauri APIs return null)
npm run build           # Type-check + production build
npm run lint            # ESLint
npm run format          # Prettier
npx vitest              # Run tests
```

### Build a distributable .dmg

```bash
npm run package
```

Output: `src-tauri/target/release/bundle/dmg/OpenClaw Dashboard_*.dmg`

## Architecture

```
src/                    React 19 frontend
  routes/               TanStack Router file-based routes
  stores/               Zustand state stores
  components/           UI components
  services/             Gateway HTTP/WS clients, Tauri IPC wrappers
src-tauri/              Rust backend
  src/commands/         Tauri commands (auth, CLI, files, gateway, logs)
  src/gateway/          WebSocket client with Ed25519 challenge-response auth
  src/device.rs         Device identity (Ed25519 key pair)
  src/keychain.rs       macOS Keychain integration
```

## License

MIT
