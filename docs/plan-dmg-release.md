# Plan: Feature Completion + DMG Packaging

## Goal
Fill feature gaps so the dashboard can fully replace the TUI for first-time
setup, then package as a distributable macOS .dmg.

---

## Phase 1: Foundation (sequential -- later tasks depend on these)

### Task 1: Add `write_workspace_file` Rust command
**Files:** `src-tauri/src/commands/files.rs`, `src-tauri/src/lib.rs`

Add a new Tauri command `write_workspace_file(agent_id, relative_path, content)`
that mirrors `read_workspace_file` but writes. Security requirements:
- Same `ALLOWED_FILES` allowlist used by read (SOUL.md, MEMORY.md, etc.)
- Same path-traversal protection (canonicalize + prefix check)
- Create parent dirs if needed (for `memory/` subdirectory files)
- Register the command in the Tauri command handler in `lib.rs`

Also add a TypeScript wrapper `writeWorkspaceFile()` in
`src/services/tauri-commands.ts` following the `safeInvoke` pattern.

### Task 2: Add models store with gateway fetch
**Files:** `src/stores/models.ts` (new), `src/services/gateway-http.ts` (read)

Create a Zustand store that:
- Holds `models: Model[]` and `loading: boolean`
- Has `fetchModels()` that calls `getHttpClient().listModels()`
- Falls back to a hardcoded default list if fetch fails or gateway disconnected
- Is called on gateway connect (in App.tsx or gateway-ws.ts)

Type `Model` already exists in `src/types/chat.ts`.

---

## Phase 2: Feature Gaps (mostly independent, execute sequentially)

### Task 3: Fix CreateAgentModal -- write SOUL.md after creation
**Files:** `src/components/modals/CreateAgentModal.tsx`
**Depends on:** Task 1, Task 2

- After the `agents add` + `set-identity` calls succeed, if `soul` is non-empty,
  call `writeWorkspaceFile(agentId, "SOUL.md", soul)` to persist it
- Need the agent ID from the creation result -- parse stdout or re-fetch
- Replace hardcoded model options with models from the models store (Task 2)

### Task 4: Fix AgentSettings model dropdown
**Files:** `src/components/agent/AgentSettings.tsx`
**Depends on:** Task 2

- Import models store, populate dropdown with fetched models
- Wire up model change to `execCli(["agents", "set-identity", agentId,
  "--model", newModel])` or equivalent CLI command
- Keep current model as fallback if not in fetched list

### Task 5: Add edit mode to MemoryViewer
**Files:** `src/components/memory/MemoryViewer.tsx`
**Depends on:** Task 1

- Add an "Edit" button next to the "Read-only" badge for writable files
- Toggle between markdown preview and a textarea editor
- Save button calls `writeWorkspaceFile(agentId, path, content)`
- Only allow editing for files in the ALLOWED_FILES list (not arbitrary paths)
- Show success/error toast on save

### Task 6: Fix cron timezone
**Files:** `src/components/cron/CronForm.tsx`

- Detect system timezone via `Intl.DateTimeFormat().resolvedOptions().timeZone`
- Use detected timezone as default instead of hardcoded "America/Los_Angeles"
- Add a timezone selector (text input with common presets or just the auto value)
- Show the detected timezone in the form

### Task 7: Add onboarding / first-run flow
**Files:** `src/components/onboarding/OnboardingOverlay.tsx` (new),
         `src/App.tsx`

- Detect first run: no token in keychain + no agents loaded
- Show a full-screen overlay with steps:
  1. "Connect to Gateway" -- embed the ConnectionModal fields inline
  2. "Create your first agent" -- embed CreateAgentModal fields inline
- Auto-dismiss when gateway is connected and at least one agent exists
- Store a `hasCompletedOnboarding` flag in tauri-plugin-store settings

### Task 8: Channel configuration UI
**Files:** `src/components/channels/ChannelConfigModal.tsx` (new),
         `src/components/channels/ChannelOverview.tsx`,
         `src/stores/channels.ts`

- Add a "Configure" button on unconfigured channel cards
- Modal with fields for the channel type (e.g., Telegram bot token, Discord
  bot token)
- Save via `execCli(["config", "set", `${channelType}.bot_token`, value])`
- After save, refresh channel status
- Replace empty state "Configure channels in the OpenClaw CLI" with actionable
  guidance pointing to the Configure button

---

## Phase 3: Packaging

### Task 9: Build script + DMG packaging
**Files:** `package.json`, `src-tauri/tauri.conf.json`

- Add `npm run package` script: `tauri build --bundles dmg`
- Verify the build completes and produces a valid .dmg
- Ensure app launches from the .dmg on a clean system
- Document any prerequisites (openclaw CLI must be installed separately)
