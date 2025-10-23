# USB/Desktop Layout & Start Scripts

This document defines the canonical layout that works **both** on a USB drive and from an extracted `.zip` on your computer.

> In v0.1, the launcher runs fully offline and defaults to **Stub** mode if no model is present. Autostart mode spawns `llama-server` when given a model.

---

## 1) Directory Layout

USB-LLM/
├─ usb-llm-launcher # macOS (or usb-llm-launcher.exe on Windows)
├─ llama/
│ └─ llama-server # macOS (or llama-server.exe on Windows)
├─ models/
│ └─ <model>.gguf # optional: Starter model fits most machines
├─ start-macos.command # macOS launcher script
└─ start-windows.bat # Windows launcher script

**Notes**

- Place the **launcher** and **llama-server** next to each other.
- `models/` may be empty; the launcher will run in **Stub** mode.
- For large models (>4 GB), prefer **exFAT** (FAT32 has a 4 GB per-file limit).

---

## 2) Start Scripts

Copy these into your USB root (or extracted folder). They use **Autostart** to spawn `llama-server` with a model resolved by ID.

### macOS — `start-macos.command`

```bash
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

# --- Autostart configuration ---
export USBLLM_AUTOSTART=1
export USBLLM_LLAMA_BIN="$(pwd)/llama/llama-server"

# Use a registry ID (see models/registry.json and docs/MODELS.md)
export USBLLM_MODEL_ID="starter-phi3-mini-q4_k_m"
export USBLLM_MODELS_DIR="$(pwd)/models"

# Optional tuning (adjust as needed)
export USBLLM_THREADS=6
export USBLLM_CTX_SIZE=4096
export USBLLM_LOG_DISABLE=1

# Ensure binaries are executable
chmod +x "./usb-llm-launcher" || true
chmod +x "./llama/llama-server" || true

# Launch
./usb-llm-launcher
```

### Windows — `start-windows.bat`

```bat
@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

REM --- Autostart configuration ---
set USBLLM_AUTOSTART=1
set USBLLM_LLAMA_BIN=%CD%\llama\llama-server.exe

REM Use a registry ID (see models/registry.json and docs/MODELS.md)
set USBLLM_MODEL_ID=starter-phi3-mini-q4_k_m
set USBLLM_MODELS_DIR=%CD%\models

REM Optional tuning
set USBLLM_THREADS=6
set USBLLM_CTX_SIZE=4096
set USBLLM_LOG_DISABLE=1

REM Launch
"%CD%\\usb-llm-launcher.exe"
```

## 3. Preparing a USB or Desktop Folder

USB drive

Create or format the drive (exFAT recommended for large models).

Copy the directory tree above to the root of the USB.

Add a model to models/ (optional, see §5).

Desktop folder (.zip extraction)

Extract the archive to a folder (e.g., ~/Downloads/USB-LLM or C:\Users\You\USB-LLM).

The same start scripts and layout apply.

## 4. First Run

macOS: Double-click start-macos.command. If Gatekeeper warns:

Right-click the file → Open → Open.

Windows: Double-click start-windows.bat. If SmartScreen warns:

Click More info → Run anyway.

Health check (in a terminal):

```bash
curl http://127.0.0.1:17872/healthz
# => {"ok":true,"mode":"stub"|"upstream","submode": "...", "runtime": {...}}
```

## 5. Adding a Model

- Option A — Copy a .gguf into models/

Recommended Starter: Phi-3 Mini Instruct Q4_K_M (~2.1 GB, MIT).

Ensure the filename matches an entry in models/registry.json, or set USBLLM_MODEL_FILE in the start script.

Option B — Use the helper CLI (dev machines)

From repo root:

```bash
npm run models:add -- ~/Downloads/phi-3-mini-instruct-q4_k_m.gguf
npm run models:list
npm run models:verify -- models/phi-3-mini-instruct-q4_k_m.gguf
```

FAT32 reminder: Files >4 GB won’t fit; use exFAT or pick a smaller quantization.

## 6. Smoke Tests

Stub streaming:

```bash
curl -N -H "Content-Type: application/json" \
  -d '{"prompt":"Draft a polite follow-up about the Q3 report."}' \
  http://127.0.0.1:17872/api/stream
```

Golden tasks (dev):

```bash
npm run golden -- --limit 5
```

## 7. Troubleshooting

- Model missing → Stub mode activates automatically.
- Port in use → Launcher auto-increments from 17872.
- llama-server fails to start → Check paths in the start script; try running the llama binary manually to confirm it works.
- Slow / OOM → Use Starter model; lower USBLLM_CTX_SIZE; reduce USBLLM_THREADS.
- **Out of memory** — Pick a smaller model or reduce `USBLLM_CTX_SIZE` (ask a developer to adjust the start script).

```

```
