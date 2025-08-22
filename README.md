# USB-LLM

USB-LLM is a plug-and-play **offline** email-drafting assistant that runs from a **USB stick** on **Windows & macOS**. No install. No cloud.
v0.1 focuses on three flows: **Reply**, **Compose**, **Rewrite** — plus tone & length presets and one-click copy.

## Platforms (v0.1)
- Windows portable `.exe`
- macOS portable `.app` (unsigned)

## Tech (initial)
React + TypeScript (Vite) UI, a Node launcher packaged as a **single executable** (Node SEA), and a local `llama.cpp` server using **GGUF** models.

## Versioning
We follow **Semantic Versioning** (MAJOR.MINOR.PATCH). First public cut will be `0.1.0`. Learn more at semver.org.

## License
Code: Apache-2.0 (see `LICENSE`). Model weights keep their original licenses.