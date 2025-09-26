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
