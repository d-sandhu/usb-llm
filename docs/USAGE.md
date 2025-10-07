# USB-LLM — Usage Guide

Run the **launcher** in three modes:

1. **Stub** (default): no model required — streams fake tokens (great for UI dev).
2. **External upstream**: you run a local `llama-server`; launcher proxies to it.
3. **Autostart**: launcher starts `llama-server` for you if given a binary + model (or a registry ID).

All modes expose the same endpoint:
`POST http://127.0.0.1:<port>/api/stream` (SSE: `meta` → many `token` → `done`).

---

## Prerequisites

- Node **22+**
- From repo root, build once:

```bash
npm run -w apps/launcher build
```

Start the launcher:

```bash
npm run -w apps/launcher start
```

Health check:

```bash
curl http://127.0.0.1:17872/healthz
# => {
#   "ok": true,
#   "mode": "stub" | "upstream",
#   "submode": "external" | "local-idle" | "local-ready" | null,
#   "runtime": { "source": "upstream" | "local" | "none", "selectedModelId": "..." | null }
# }
```

---

## Request body (structured)

The launcher accepts **structured fields** for all modes:

```json
{
  "flow": "compose" | "reply" | "rewrite",
  "tone": "neutral" | "friendly" | "formal" | "concise" | "enthusiastic" | "apologetic",
  "length": "short" | "medium" | "long",
  "subject": "optional subject line or null",
  "context": "original email/thread or text to rewrite (string or null)",
  "instructions": "what you want the draft to do (string or null)"
}
```

> Back-compat: a legacy `"prompt": "..."` string is still accepted, but the structured fields are recommended.

---

## Mode A — Stub (no model needed)

**Example: Compose (structured)**

```bash
curl -N -H "Content-Type: application/json" \
  -d '{
    "flow": "compose",
    "tone": "friendly",
    "length": "medium",
    "subject": "Follow-up on Q3 report",
    "instructions": "Ask for a 20-minute sync next week about the Q3 numbers."
  }' \
  http://127.0.0.1:17872/api/stream
```

**Example: Reply (structured, with context)**

```bash
curl -N -H "Content-Type: application/json" \
  -d '{
    "flow": "reply",
    "tone": "formal",
    "length": "short",
    "context": "From: Pat\nSubject: Q3 timeline\n...\n(Original email body here)",
    "instructions": "Acknowledge delay and confirm the new deadline."
  }' \
  http://127.0.0.1:17872/api/stream
```

**Legacy (simple prompt) — still works**

```bash
curl -N -H "Content-Type: application/json" \
  -d '{"prompt":"Draft a polite follow-up about the Q3 report."}' \
  http://127.0.0.1:17872/api/stream
```

---

## Mode B — External upstream (you run `llama-server`)

Start your server:

```bash
./llama-server -m /ABS/PATH/TO/model.gguf --host 127.0.0.1 --port 8080
```

Configure the launcher:

```bash
export USBLLM_UPSTREAM_URL="http://127.0.0.1:8080"
export USBLLM_MODEL="default"
export USBLLM_TEMPERATURE="0.3"
```

**Example request (structured):**

```bash
curl -N -H "Content-Type: application/json" \
  -d '{
    "flow": "compose",
    "tone": "concise",
    "length": "short",
    "subject": "Quarterly check-in",
    "instructions": "Set up a 15-minute sync; keep it crisp."
  }' \
  http://127.0.0.1:17872/api/stream
```

> PowerShell equivalents are in the repo; see earlier version.

---

## Mode C — Autostart (launcher starts `llama-server`)

You can configure either an **explicit model file** or a **headless model ID** from the registry.

### Option 1 — explicit file

```bash
export USBLLM_AUTOSTART=1
export USBLLM_LLAMA_BIN="/ABS/PATH/TO/llama-server"
export USBLLM_MODEL_FILE="/ABS/PATH/TO/model.gguf"
# Optional tuning:
export USBLLM_LLAMA_PORT=8080
export USBLLM_CTX_SIZE=4096
export USBLLM_THREADS=6
export USBLLM_TEMP_DIR="/tmp"
export USBLLM_LOG_DISABLE=1
```

### Option 2 — headless ID from registry (no absolute path needed)

```bash
export USBLLM_AUTOSTART=1
export USBLLM_LLAMA_BIN="/ABS/PATH/TO/llama-server"
export USBLLM_MODEL_ID="starter-phi3-mini-q4_k_m"
export USBLLM_MODELS_DIR="./models"   # default is "models"
# Optional tuning:
export USBLLM_LLAMA_PORT=8080
export USBLLM_CTX_SIZE=4096
export USBLLM_THREADS=6
export USBLLM_TEMP_DIR="/tmp"
export USBLLM_LOG_DISABLE=1
```

Now stream (structured example):

```bash
curl -N -H "Content-Type: application/json" \
  -d '{
    "flow": "rewrite",
    "tone": "neutral",
    "length": "short",
    "subject": "Re: Vendor timing",
    "context": "Hi—sorry for the delay, we will ship next week...",
    "instructions": "Make this friendlier, tighter, and confirm Friday EOD."
  }' \
  http://127.0.0.1:17872/api/stream
```

You’ll see:

```
event: meta
data: {"source":"supervisor","status":"starting"}
event: meta
data: {"source":"supervisor","status":"ready","url":"http://127.0.0.1:8080"}
...
```

Go back to **Stub** by unsetting the variables you set above.

---

## Environment Variables (summary)

| Variable                | Meaning                                                                 |
| ----------------------- | ----------------------------------------------------------------------- |
| `USBLLM_UPSTREAM_URL`   | Use existing server (skips autostart)                                   |
| `USBLLM_MODEL`          | Model name/alias for upstream                                           |
| `USBLLM_TEMPERATURE`    | Sampling temperature                                                    |
| `USBLLM_AUTOSTART`      | `1/true` to allow autostart                                             |
| `USBLLM_LLAMA_BIN`      | Path to `llama-server` binary                                           |
| `USBLLM_MODEL_FILE`     | Path to `.gguf` (overrides headless resolver)                           |
| `USBLLM_MODEL_ID`       | Registry id used to resolve a local `.gguf`                             |
| `USBLLM_MODELS_DIR`     | Directory where `.gguf` lives (default `models`)                        |
| `USBLLM_LLAMA_PORT`     | Preferred port (auto-increments if busy)                                |
| `USBLLM_CTX_SIZE`       | Optional context window for llama-server                                |
| `USBLLM_THREADS`        | Optional CPU threads for llama-server                                   |
| `USBLLM_TEMP_DIR`       | Optional temporary dir for llama-server                                 |
| `USBLLM_LOG_DISABLE`    | `1/true` to pass `--log-disable`                                        |
| `USBLLM_SYSTEM_PRELUDE` | Optional text prepended to the system prompt (before tone/length rules) |

## Troubleshooting

- **No output?** Check `/healthz` and verify your model path/ID exists.
- **Port in use?** Autostart will try subsequent ports automatically (`8081`, `8082`, …).
- **macOS blocked binary?** `xattr -dr com.apple.quarantine <bin>; chmod +x <bin>`.
- **Model too large / slow?** Pick a smaller `.gguf` (see `MODELS.md`).

> Note: optional flags are only passed if set; if your local llama build doesn’t support them, just don’t set them.
