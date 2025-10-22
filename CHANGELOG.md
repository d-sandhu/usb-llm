# Changelog

All notable changes to this project will be documented in this file.

This project adheres to [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Initial repository setup (LICENSE, README, `.gitignore`, `CHANGELOG.md`)
- Minimal Node scaffolding (`package.json`) and CI workflow (Node 22)
- `.nvmrc` to hint the local Node version
- TypeScript config (Node 22, `noEmit`) and Node typings
- ESLint 9 flat config with `typescript-eslint`
- Prettier config and `format:check` in scripts
- CI updated to install with `npm ci` and run `npm run check`
- Monorepo via npm workspaces `(apps/*, packages/*)`.
- New workspace: `@usb-llm/launcher` with TS/lint/format checks.
- Placeholder workspace: `@usb-llm/ui`.
- CI runs workspace checks.
- Minimal launcher HTTP server (Node core) bound to `127.0.0.1` with strict cache/security headers; endpoints `/` and `/healthz`. Build via `npm run -w apps/launcher build`.
- Streaming endpoint (SSE) at `POST /api/stream` emitting `meta`, repeated `token` events, and a final `done`. Stubbed generator for now.
- Upstream streaming client for OpenAI-compatible chat `(/v1/chat/completions with stream: true)`, configurable via `USBLLM_UPSTREAM_URL`, `USBLLM_MODEL`, `USBLLM_TEMPERATURE`; `POST /api/stream` now proxies tokens when upstream is set, else uses the stub.
- Optional autostart supervisor: if `USBLLM_UPSTREAM_URL` is not set and `USBLLM_AUTOSTART=1` with `USBLLM_LLAMA_BIN` + `USBLLM_MODEL_FILE`, the launcher starts llama-server, chooses a free port, and proxies `/api/stream` to it. Graceful stop on launcher exit.
- `docs/USAGE.md`: how to run the launcher in Stub, External Upstream, and Autostart modes with copy-paste examples.
- `models/registry.json` listing Starter / Standard / Pro model entries (IDs, filenames, licenses, RAM guidance).
- `scripts/verify-model.mjs` to compute/verify SHA-256 for `.gguf` files.
- `docs/MODELS.md` with RAM-based guidance and verification steps.
- `apps/ui`: React 19.1 + Vite 7 app streaming via `@microsoft/fetch-event-source`; dev proxy to launcher.
- CI now runs `check:all` (root + all workspaces).
- Launcher: `GET /v1/models` now returns a **single read-only** `selected` model object (`status: "ok" | "missing" | "none"`) and `ui.allowSelection` (defaults **false**). Absolute paths are never exposed; only safe metadata (name, license, basename).
- `/healthz` now returns `{ ok, mode, submode, runtime }` where `runtime` includes `{ source: "upstream" | "local" | "none", selectedModelId }`.
- Launcher: headless local model resolution via `models/registry.json` and env (`USBLLM_MODEL_ID`, `USBLLM_MODELS_DIR`, `USBLLM_MODEL_FILE`). Safe-by-default: if no model is present or misconfigured, the launcher remains in **Stub** mode and never crashes.
- UI: read-only **Model** and **Mode** chips (no selector). Surfaces selected model metadata when available; otherwise shows "missing" or "none".
- Launcher: autostart now uses the **headless model resolver**; if a valid model is present, the launcher spawns `llama-server` automatically and proxies `/api/stream` to it.
- Config: optional server flags `USBLLM_CTX_SIZE`, `USBLLM_THREADS`, `USBLLM_TEMP_DIR`, `USBLLM_LOG_DISABLE` (applied only if defined).
- UI: **Reply / Compose / Rewrite** flows with **tone** and **length** presets; one-click copy; safe validation.
- Launcher: `/api/stream` now accepts structured fields `{ flow, tone, length, subject, context, instructions }`.
- Launcher: prompt builder that derives a clear **system** and **user** message for upstream, now **wired into streaming**.
- Config: `USBLLM_SYSTEM_PRELUDE` to prepend a small configurable prelude to the system prompt.
- Node SEA packaging: single-file launcher binaries for macOS and Windows (`pack:sea:mac`, `pack:sea:win`).
- `docs/PACKAGING.md`: USB layout, SEA build steps, and distribution guidance.
- `packages/golden`: Golden tasks & offline quality harness CLI with 25 email tasks, basic heuristics (length, greeting, CTA), and CI-friendly exit codes. Supports Stub mode and real model testing.
- Root convenience script: `npm run golden`.
- Optional CI job (commented) for running golden tasks in Stub mode.
- `scripts/model-helper.mjs`: CLI to add/list models with SHA-256 verification.
- Root scripts: `models:add`, `models:list`, `models:help`.
- Improved model setup workflow in `docs/MODELS.md` with helper commands and testing instructions.
- UI: "Check Grammar" flow for grammar and spelling checks without changing writing style.
- Launcher: Grammar flow prompt template that preserves user's voice.
- UI: Accessibility improvements (ARIA labels, descriptions, keyboard navigation hints).
- UI: Enhanced focus states with visible outlines and box-shadows.
- UI: Support for high contrast mode and reduced motion preferences.
- UI: Screen reader support with sr-only descriptions.
- UI: Info banner when grammar mode is selected.
- UI: Dynamic input labels based on selected flow.
- UI: Form validation with helpful error messages.
- UI: Footer with keyboard shortcut hints.
- `docs/USAGE.md`: Grammar check flow documentation with examples.

### Changed

- `README.md`: added Quick Start and a link to the usage guide.
- `README.md`: link to the models guide.
- `docs/USAGE.md`: link back to the models guide.
- Root scripts: use `--workspaces` for workspace checks.
- Prettier: ignore build artifacts in `apps/launcher` and `apps/ui`.
- `/healthz` now returns `{ ok, mode, submode }`.
- Home page lists `/v1/models` and clarifies `/healthz`.
- UI: switch to native `fetch()` + `AbortController` for SSE streaming; **Stop** now cancels immediately with no auto-retry.
- `/healthz`: `submode` reflects local autostart readiness; `runtime.source` remains `local` only when a resolved model is available.
- Docs: `USAGE.md` (case fix from `USAGE.MD`) and expanded autostart instructions for **model ID** flow.
- Upstream: accepts an optional **system override** so the server can control tone/length semantics consistently across modes.
- Docs: updated `USAGE.md` with structured curl examples for **compose** and **reply**.
- Build output directories (`dist-sea/`, `build/`) are now excluded from lint/format checks.
- Packaging: SEA config now correctly bundles the launcher into a single `.cjs` file before embedding.
- `README.md`: updated models section to reference `models:add` and golden tasks workflow.
- `docs/MODELS.md`: complete rewrite with model helper CLI workflow, testing instructions, and troubleshooting.
- `apps/launcher/src/prompt.ts`: Added grammar flow logic, tone/length ignored in grammar mode.
- `docs/USAGE.md`: Added grammar flow to request body structured fields, added Grammar Check Flow section.
