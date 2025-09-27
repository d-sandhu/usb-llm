# USB-LLM — Usage Guide

Run the **launcher** in three modes:

1. **Stub** (default): no model required — streams fake tokens (great for UI dev).
2. **External upstream**: you run a local `llama-server`; launcher proxies to it.
3. **Autostart**: launcher starts `llama-server` for you if given a binary + model.

All modes expose the same endpoint:
`POST http://127.0.0.1:<port>/api/stream` (SSE: `meta` → many `token` → `done`).

---

## Prerequisites

- Node **22+**
- From repo root, build once:

```bash
npm run -w apps/launcher build
```

- Start the launcher:

```bash
npm run -w apps/launcher start
```

- Health check:

```bash
curl http://127.0.0.1:17872/healthz
# => {"ok":true,"mode":"stub" | "external" | "local-idle" | "local-ready"}
```

---

## Mode A — Stub (no model needed)

In a fresh terminal (no special env vars):

```bash
curl -N -H "Content-Type: application/json" \
  -d '{"prompt":"Draft a polite follow-up about the Q3 report."}' \
  http://127.0.0.1:17872/api/stream
```

You’ll see lines like:

```
event: meta
data: {"source":"stub","started_at":"..."}

event: token
data: {"text":"Hello,"}

...

event: done
data: {}
```

---

## Mode B — External upstream (you run `llama-server`)

1. Start `llama-server` yourself (adjust paths/port):

```bash
./llama-server -m /ABS/PATH/TO/model.gguf --host 127.0.0.1 --port 8080
```

2. Tell the launcher to use it.

**macOS/Linux (bash/zsh):**

```bash
export USBLLM_UPSTREAM_URL="http://127.0.0.1:8080"
export USBLLM_MODEL="default"
export USBLLM_TEMPERATURE="0.3"
```

**Windows PowerShell:**

```powershell
$env:USBLLM_UPSTREAM_URL="http://127.0.0.1:8080"
$env:USBLLM_MODEL="default"
$env:USBLLM_TEMPERATURE="0.3"
```

3. Stream:

```bash
curl -N -H "Content-Type: application/json" \
  -d '{"prompt":"Please draft a concise follow-up for the Q3 report."}' \
  http://127.0.0.1:17872/api/stream
```

Health now shows:

```json
{ "ok": true, "mode": "external" }
```

**Unset to return to Stub**

- macOS/Linux:

  ```bash
  unset USBLLM_UPSTREAM_URL USBLLM_MODEL USBLLM_TEMPERATURE
  ```

- PowerShell:

  ```powershell
  Remove-Item Env:USBLLM_UPSTREAM_URL, Env:USBLLM_MODEL, Env:USBLLM_TEMPERATURE
  ```

---

## Mode C — Autostart (launcher starts `llama-server`)

Provide the **binary** and **model file** paths; the launcher will choose a free port and proxy to it.

**macOS/Linux (bash/zsh):**

```bash
export USBLLM_AUTOSTART=1
export USBLLM_LLAMA_BIN="/ABS/PATH/TO/llama-server"
export USBLLM_MODEL_FILE="/ABS/PATH/TO/model.gguf"
# Optional:
export USBLLM_LLAMA_PORT=8080
export USBLLM_MODEL="default"
export USBLLM_TEMPERATURE="0.3"
```

**Windows PowerShell:**

```powershell
$env:USBLLM_AUTOSTART="1"
$env:USBLLM_LLAMA_BIN="C:\Path\to\llama-server.exe"
$env:USBLLM_MODEL_FILE="C:\Path\to\model.gguf"
# Optional:
$env:USBLLM_LLAMA_PORT="8080"
$env:USBLLM_MODEL="default"
$env:USBLLM_TEMPERATURE="0.3"
```

Stream:

```bash
curl -N -H "Content-Type: application/json" \
  -d '{"prompt":"Draft a polite follow-up."}' \
  http://127.0.0.1:17872/api/stream
```

You’ll see:

```
event: meta
data: {"source":"supervisor","status":"starting"}

event: meta
data: {"source":"supervisor","status":"ready","url":"http://127.0.0.1:8080"}

event: token
data: {"text":"Hello,"}

...

event: done
data: {}
```

Health now shows:

```json
{ "ok": true, "mode": "local-ready" }
```

**Go back to Stub**

- macOS/Linux:

  ```bash
  unset USBLLM_AUTOSTART USBLLM_LLAMA_BIN USBLLM_MODEL_FILE USBLLM_LLAMA_PORT
  ```

- PowerShell:

  ```powershell
  Remove-Item Env:USBLLM_AUTOSTART, Env:USBLLM_LLAMA_BIN, Env:USBLLM_MODEL_FILE, Env:USBLLM_LLAMA_PORT
  ```

---

## Environment Variables (summary)

| Variable              | Meaning                                  | Example                 |
| --------------------- | ---------------------------------------- | ----------------------- |
| `USBLLM_UPSTREAM_URL` | Use existing server (skips autostart)    | `http://127.0.0.1:8080` |
| `USBLLM_MODEL`        | Model name/alias for upstream            | `default`               |
| `USBLLM_TEMPERATURE`  | Sampling temperature                     | `0.3`                   |
| `USBLLM_AUTOSTART`    | `1/true` to allow autostart              | `1`                     |
| `USBLLM_LLAMA_BIN`    | Path to `llama-server` binary            | `/path/llama-server`    |
| `USBLLM_MODEL_FILE`   | Path to `.gguf` model file               | `/path/model.gguf`      |
| `USBLLM_LLAMA_PORT`   | Preferred port (auto-increments if busy) | `8080`                  |

---

## Troubleshooting

- **404 on `/api/stream`** → must be **POST** with `Content-Type: application/json`.
- **No streaming output** → ensure `curl -N` (no buffering) and check `/healthz`.
- **macOS blocked binary** → remove quarantine + make executable:

  ```bash
  xattr -dr com.apple.quarantine /path/llama-server
  chmod +x /path/llama-server
  ```

- **Windows paths** → use full `.exe` path and quotes if spaces.
- **Port in use** → autostart tries next ports automatically (8081, 8082, …).
- **Model too large / slow** → try a smaller `.gguf` or free RAM.

---

## Glossary

- **SSE (Server-Sent Events):** one-way streaming over HTTP. Frames look like:

  ```
  event: token
  data: {"text":"Hello"}

  event: done
  data: {}
  ```

- **Upstream:** a local model server (e.g., `llama-server`) with an OpenAI-compatible chat API at `/v1/chat/completions` supporting `stream: true`.
