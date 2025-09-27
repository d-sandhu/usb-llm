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

### Changed

- `README.md`: added Quick Start and a link to the usage guide.
- `README.md`: link to the models guide.
- `docs/USAGE.md`: link back to the models guide.
