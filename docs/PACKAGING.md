# Packaging & Portable Builds (Node SEA)

This produces a **single-file** launcher for USB-LLM. We **do not** bundle `llama-server` or models; place them next to the launcher on the USB.

## 0) Prereqs

- Node **22+**
- Built launcher once: `npm run -w apps/launcher build`

## 1) Make the SEA blob

```bash
npm run -w apps/launcher build:sea:blob
# blob → apps/launcher/build/usb-llm-launcher.blob
```

## 2) Pack a portable binary

**macOS**

```bash
cd apps/launcher
npm run pack:sea:mac
# output: ./build/usb-llm-launcher
```

First run may prompt Gatekeeper; Right-click → Open.

**Windows (PowerShell)**

```powershell
cd apps/launcher
npm run pack:sea:win
# output: .\build\usb-llm-launcher.exe
```

First run may show SmartScreen → More info → Run anyway.

## 3) Recommended USB layout

```
USB-LLM/
├─ usb-llm-launcher            # or usb-llm-launcher.exe
├─ llama/
│  └─ llama-server             # or llama-server.exe
├─ models/
│  ├─ phi-3-mini-...q4....gguf
│  └─ mistral-7b-...q4....gguf
├─ start-macos.command         # optional helper
└─ start-windows.bat           # optional helper
```

Example env (Autostart mode, macOS)

```bash
# start-macos.command
export USBLLM_AUTOSTART=1
export USBLLM_LLAMA_BIN="$(pwd)/llama/llama-server"
export USBLLM_MODEL_ID="starter-phi3-mini-q4_k_m"
export USBLLM_MODELS_DIR="$(pwd)/models"
export USBLLM_THREADS=6
export USBLLM_CTX_SIZE=4096
"./usb-llm-launcher"
```

Example env (Autostart mode, Windows)

```bat
:: start-windows.bat
set USBLLM_AUTOSTART=1
set USBLLM_LLAMA_BIN=%CD%\llama\llama-server.exe
set USBLLM_MODEL_ID=starter-phi3-mini-q4_k_m
set USBLLM_MODELS_DIR=%CD%\models
set USBLLM_THREADS=6
set USBLLM_CTX_SIZE=4096
usb-llm-launcher.exe
```

## 4) Smoke test

```bash
curl http://127.0.0.1:17872/healthz
# -> Stub or Upstream depending on env
```

## 5) AV / Gatekeeper / SmartScreen

macOS: first run of unsigned binaries shows a warning → Right-click → Open.

Windows: SmartScreen → More info → Run anyway.

## 6) Troubleshooting

Blob mismatch → rebuild: `npm run -w apps/launcher build:sea:blob`

Port busy → launcher auto-increments from 17872 (up to 10 tries)

Model not found → verify `USBLLM_MODEL_FILE` or `USBLLM_MODEL_ID` + `USBLLM_MODELS_DIR`
