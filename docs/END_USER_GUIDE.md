# USB-LLM — End-User Guide (Offline Email Assistant)

## Purpose

This guide helps you run USB-LLM from a USB drive or from an extracted folder on your computer. No installation. No cloud. If you're a developer, use the repository README instead—this guide is for non-technical users.

## What you need

- A Windows 10/11 PC or a macOS 12+ Mac
- A USB drive with at least 8 GB free space (exFAT recommended for large models)
- Optional: an offline model file (.gguf) in the models/ folder for better quality

## What's included

The USB-LLM folder typically contains:

- usb-llm-launcher (or usb-llm-launcher.exe on Windows)
- llama/llama-server (or llama-server.exe on Windows)
- models/ (may be empty)
- start-macos.command (macOS)
- start-windows.bat (Windows)

## Quick start: run from a USB drive

1. Copy the entire USB-LLM folder to your USB drive (or download a prepared package).
2. Optional: copy a model file into USB-LLM/models/ (see "Adding a model").
3. On Windows: double-click start-windows.bat. If SmartScreen appears, click "More info" → "Run anyway".
4. On macOS: double-click start-macos.command. If you see a warning, Right-click the file → Open → Open.
5. The app runs locally at http://127.0.0.1:17872. If your browser doesn't open automatically, type that address in the URL bar.

## Quick start: run from your computer (no USB)

1. Download or copy the USB-LLM folder to your computer (e.g., Downloads or Desktop).
2. Optional: add a model to USB-LLM/models/.
3. Launch using the same start script for your OS (see above).
4. Open http://127.0.0.1:17872 in your browser.

## Using the app

- **Flows**: Reply, Compose, Rewrite, Check Grammar
- **Tone**: neutral, friendly, formal, concise, enthusiastic, apologetic
- **Length**: short, medium, long (ignored in Grammar mode)
- Paste context (original email, notes, or text), add instructions, then click "Generate draft".
- Click "Copy to clipboard" to paste the result into your email client.

## Modes and models

- **Stub mode**: runs without a model, useful for trying the interface.
- **With a model**: better quality; still fully offline. Place a .gguf file into models/.
- **Starter recommendation** (fits most machines): Phi-3 Mini Instruct (Q4_K_M), around ~2 GB, permissive license.

## File system notes

- FAT32 has a 4 GB per-file limit. Large models can exceed this. Prefer exFAT for large model files.
- On macOS, the first run of unsigned binaries/scripts may show a Gatekeeper prompt. Use Right-click → Open once.

## Troubleshooting

- App says "Stub" or quality seems generic: add a model to models/ and relaunch.
- Nothing appears in the browser: open http://127.0.0.1:17872 manually.
- Slow or memory errors: choose the Starter model; reduce context size; close other apps; lower context settings if available.
- Port in use: the launcher automatically tries the next ports. Try re-running if something else was already using the default port.

## Privacy

USB-LLM is designed to run locally and offline. Your text stays on your machine. No telemetry is sent.
