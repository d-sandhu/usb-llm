# Models Guide

USB-LLM runs local **GGUF** models via **llama.cpp** (`llama-server`). You bring the model. This guide helps you choose one and set it up.

---

## RAM-Based Model Tiers

We've tested three tiers optimized for different hardware:

### Starter (4–8 GB RAM)

- **Model:** Phi-3 Mini Instruct (Q4_K_M)
- **File:** `phi-3-mini-instruct-q4_k_m.gguf`
- **Context:** 4096 tokens
- **License:** MIT
- **Best for:** Most laptops, fast iteration, good for short emails

### Standard (8–16 GB RAM)

- **Model:** Mistral 7B Instruct (Q4_K_M)
- **File:** `mistral-7b-instruct-q4_k_m.gguf`
- **Context:** 8192 tokens
- **License:** Apache-2.0
- **Best for:** Better phrasing, handles longer threads

### Pro (12–16+ GB RAM)

- **Model:** Qwen2.5 7B Instruct (Q4_K_M)
- **File:** `qwen2.5-7b-instruct-q4_k_m.gguf`
- **Context:** 8192 tokens
- **License:** Apache-2.0
- **Best for:** Best quality in this size, prefers 16 GB

> **Note:** These are **Q4_K_M** quantizations — a good balance of quality and size. For the smallest possible size, try Q4_0. For best quality, try Q5_K_M or Q6_K (requires more RAM).

---

## Setting Up a Model

### Step 1: Download a GGUF file

Find a compatible `.gguf` model from a trusted source:

- [Hugging Face](https://huggingface.co/models?library=gguf) (search for GGUF quantizations)
- Official model releases (Phi-3, Mistral, Qwen2.5, etc.)

**Important:** Make sure the filename matches one in `models/registry.json`, or be prepared to add a registry entry.

**Example download links (for reference):**

- Phi-3 Mini: Search Hugging Face for "microsoft/Phi-3-mini-4k-instruct-gguf"
- Mistral 7B: Search for "mistralai/Mistral-7B-Instruct-v0.2-GGUF"
- Qwen2.5 7B: Search for "Qwen/Qwen2.5-7B-Instruct-GGUF"

### Step 2: Add the model

```bash
# From repo root
npm run models:add -- ~/Downloads/phi-3-mini-instruct-q4_k_m.gguf
```

This will:

1. Copy the file to `models/` with the correct name
2. Verify the SHA-256 checksum (if configured in registry)
3. Tell you what to do next

**Expected output:**

```
📦 Adding model: phi-3-mini-instruct-q4_k_m.gguf
📋 Copying to: /path/to/usb-llm/models/phi-3-mini-instruct-q4_k_m.gguf
✅ Copy complete
🔍 Verifying SHA-256...
⚠️  No SHA-256 in registry for this model.
Computed: abc123def456...

To enable verification, add this hash to models/registry.json:
  "sha256": "abc123def456..."

✅ Model added (verification skipped)

📚 Next steps:

1. Set environment variable:
   export USBLLM_MODEL_ID=starter-phi3-mini-q4_k_m

2. Enable autostart (if using llama-server):
   export USBLLM_AUTOSTART=1
   export USBLLM_LLAMA_BIN=/path/to/llama-server

3. Start the launcher:
   npm run -w apps/launcher start

4. Test with golden tasks:
   npm run golden

See docs/USAGE.md and docs/MODELS.md for more details.
```

### Step 3: List models

```bash
npm run models:list
```

Shows which models are in the registry and which are present on disk.

**Example output:**

```
📋 Model Registry

✅ Starter — Phi-3 Mini Instruct (Q4_K_M)
   ID:       starter-phi3-mini-q4_k_m
   File:     phi-3-mini-instruct-q4_k_m.gguf
   License:  MIT
   RAM:      4+ GB (8 GB recommended)
   Status:   Present
   SHA-256:  (not set)

❌ Standard — Mistral 7B Instruct (Q4_K_M)
   ID:       standard-mistral-7b-q4_k_m
   File:     mistral-7b-instruct-q4_k_m.gguf
   License:  Apache-2.0
   RAM:      8+ GB (16 GB recommended)
   Status:   Missing
   SHA-256:  (not set)

❌ Pro — Qwen2.5 7B Instruct (Q4_K_M)
   ID:       pro-qwen2_5-7b-q4_k_m
   File:     qwen2.5-7b-instruct-q4_k_m.gguf
   License:  Apache-2.0
   RAM:      12+ GB (16 GB recommended)
   Status:   Missing
   SHA-256:  (not set)

Summary: 1/3 models present
```

---

## Verifying Model Integrity

If a model has a `sha256` field in `models/registry.json`, the `models:add` command automatically verifies it. If you want to manually verify an existing file:

```bash
npm run models:verify -- models/phi-3-mini-instruct-q4_k_m.gguf
```

**If SHA-256 is not set in registry:**

```json
{
  "ok": null,
  "file": "phi-3-mini-instruct-q4_k_m.gguf",
  "id": "starter-phi3-mini-q4_k_m",
  "computed_sha256": "abc123def456...",
  "message": "No sha256 in registry; copy this hash into models/registry.json"
}
```

Copy the hash into `models/registry.json` under the appropriate model entry to enable verification for future downloads.

**If verification passes:**

```json
{
  "ok": true,
  "file": "phi-3-mini-instruct-q4_k_m.gguf",
  "id": "starter-phi3-mini-q4_k_m",
  "expected_sha256": "abc123...",
  "computed_sha256": "abc123..."
}
```

**If verification fails:**

```json
{
  "ok": false,
  "file": "phi-3-mini-instruct-q4_k_m.gguf",
  "id": "starter-phi3-mini-q4_k_m",
  "expected_sha256": "abc123...",
  "computed_sha256": "xyz789..."
}
```

Re-download the model from a trusted source.

---

## Testing with Golden Tasks

After adding a model, test it with the golden tasks harness:

```bash
# Set up autostart
export USBLLM_AUTOSTART=1
export USBLLM_LLAMA_BIN=/path/to/llama-server
export USBLLM_MODEL_ID=starter-phi3-mini-q4_k_m

# Start launcher
npm run -w apps/launcher start &

# Wait for it to be ready
sleep 5

# Run golden tasks
npm run golden

# Stop launcher
pkill -f "apps/launcher"
```

Real models should score much better than Stub mode on heuristics (greeting, CTA, length).

---

## Troubleshooting

**"File not listed in registry":**

- Your `.gguf` filename doesn't match any entry in `models/registry.json`
- Either rename it to match, or add a new entry to the registry

**SHA-256 mismatch:**

- File may be corrupted or from an untrusted source
- Re-download from the official source

**Model is too slow:**

- Try a smaller quantization (Q4_0) or a smaller model (Phi-3 Mini)
- Reduce context size: `export USBLLM_CTX_SIZE=2048`

**Out of memory errors:**

- Model is too large for your RAM
- Try the Starter tier (Phi-3 Mini) or reduce context size

**llama-server not found:**

- Download llama.cpp from https://github.com/ggerganov/llama.cpp
- Build or download the `llama-server` binary for your platform
- Set `USBLLM_LLAMA_BIN` to the full path

---

## Adding New Models to Registry

To add a custom model to `models/registry.json`:

```json
{
  "id": "custom-model-id",
  "name": "Custom Model Name",
  "file": "custom-model.gguf",
  "license": "Apache-2.0",
  "context": 4096,
  "quant": "Q4_K_M",
  "min_ram_gb": 4,
  "recommended_ram_gb": 8,
  "notes": "Brief description",
  "sha256": ""
}
```

After adding to registry:

1. Place the `.gguf` file in `models/` or use `models:add`
2. Run `models:verify` to compute the SHA-256
3. Copy the hash into the registry entry

---

## Next Steps

After setting up a model:

1. Follow `docs/USAGE.md` for detailed launcher configuration
2. Run `npm run golden` to validate quality with the golden tasks
3. Use the UI (`npm run -w apps/ui dev`) for interactive email drafting
