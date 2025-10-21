# USB-LLM

USB-LLM is a plug-and-play **offline** email-drafting assistant that runs from a **USB stick** on **Windows & macOS**. No install. No cloud.

**v0.1 scope:** three flows — **Reply**, **Compose**, **Rewrite** — with tone & length presets and one-click copy.

---

## Platforms (v0.1)

- Windows portable `.exe`
- macOS portable `.app` (unsigned)

### Packaging

See **[docs/PACKAGING.md](docs/PACKAGING.md)** for single-file portable builds (Node SEA) and the USB layout/runbook for Windows & macOS.

> For development, the Node launcher runs locally. For packaging, see below.

---

## Tech (initial)

- **Launcher:** Node.js (built-in `http`, zero deps), packaged as a **single executable** (Node SEA).
- **Model runtime:** local `llama.cpp` **llama-server** with **GGUF** models (OpenAI-compatible API).
- **UI:** React + TypeScript (Vite) — coming after the launcher foundation.

---

## Quick start (dev)

> Requires **Node 22+**.

```bash
# from repo root
npm ci
npm run -w apps/launcher build
npm run -w apps/launcher start
```

Health:

```bash
curl http://127.0.0.1:17872/healthz
# => {"ok":true,"mode":"stub"}   # default: no model required
```

Stream (SSE, stub tokens by default):

```bash
curl -N -H "Content-Type: application/json" \
  -d '{"prompt":"Draft a polite follow-up about the Q3 report."}' \
  http://127.0.0.1:17872/api/stream
```

UI (dev): `npm run -w apps/ui dev` → <http://127.0.0.1:5173>

See **[docs/USAGE.md](docs/USAGE.md)** for:

- **Stub mode** (no model required)
- **External upstream** (you run `llama-server`)
- **Autostart** (launcher starts `llama-server` given a binary + model)

See **[docs/MODELS.md](docs/MODELS.md)** to choose and verify a model by RAM tier (Starter / Standard / Pro).

---

## Packaging (single-file launcher)

We ship a one-file launcher via Node SEA (no install). The binary does not include model weights or llama-server; put those next to the launcher on the USB.

Quick build (macOS example):

```bash
# from repo root
npm install
npm run -w apps/launcher pack:sea:mac
./apps/launcher/build/usb-llm-launcher
curl http://127.0.0.1:17872/healthz
```

Windows (run on Windows):

```powershell
npm install
npm run -w apps/launcher pack:sea:win
.\apps\launcher\build\usb-llm-launcher.exe
```

see **[docs/PACKAGING.md](docs/PACKAGING.md)** for more details.

## Versioning

We follow **Semantic Versioning** (MAJOR.MINOR.PATCH).  
First public cut will be **`0.1.0`**. Learn more at <https://semver.org/>.

---

## License

- **Code:** Apache-2.0 (see `LICENSE`)
- **Models:** keep their original licenses (we’ll document recommended permissive options in a model registry)

---

## Contributing

Small, focused PRs are welcome. Please:

- Keep a clean commit history and update **CHANGELOG.md** under **[Unreleased]**.
- Ensure `npm run check` (typecheck + lint + format + tests) passes.
