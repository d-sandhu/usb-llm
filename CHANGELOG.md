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
