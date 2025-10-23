# Release Checklist (Developer)

## Goal

Ensure every release is reproducible and ready for USB/Desktop distribution (v0.1.0 target).

## 0) Preparation

- Update CHANGELOG.md: move Unreleased items into a new "## [0.1.0] - YYYY-MM-DD".
- Ensure README is developer-focused and links to end-user docs.
- Decide which model(s) you will publish or recommend (Starter recommended).

## 1) Build launcher binaries

**macOS:**

```bash
npm ci
npm run -w apps/launcher pack:sea:mac
```

(artifact: apps/launcher/build/usb-llm-launcher)

**Windows (PowerShell):**

```bash
npm ci
npm run -w apps/launcher pack:sea:win
```

(artifact: apps\launcher\build\usb-llm-launcher.exe)

## 2) (Optional for v0.1) Build UI bundle

```bash
npm run -w apps/ui build
```

(artifact: apps/ui/dist/)

Note: PR H2 will let the launcher serve a local www/ folder for offline UI. Until then, this step is optional.

## 3) Assemble Core bundles (per OS)

Create a minimal folder:

```
usb-llm-core-<os>/
  usb-llm-launcher[.exe]
  llama/llama-server[.exe]
  models/            (empty)
  start-macos.command  (mac)
  start-windows.bat    (win)
```

**Archive:**

- **macOS:**
  ```bash
  tar -czf usb-llm-core-mac.tar.gz -C usb-llm-core-mac .
  ```
- **Windows:**
  ```powershell
  Compress-Archive -Path usb-llm-core-win\* -DestinationPath usb-llm-core-win.zip -Force
  ```

## 4) (Optional) Starter Pack

Add the Starter model (.gguf) to models/ and archive as:

- usb-llm-starter-<os>.tar.gz or .zip

Record SHA-256 for the model and the archive.

## 5) Checksums (record for each artifact you publish)

- **macOS:**
  ```bash
  shasum -a 256 <file>
  ```
- **Windows (PowerShell):**
  ```powershell
  Get-FileHash <file> -Algorithm SHA256
  ```

## 6) Sanity tests

- Run the launcher locally and check:
  ```bash
  curl http://127.0.0.1:17872/healthz
  ```
- Run a quick stream test:
  ```bash
  curl -N -H "Content-Type: application/json" \
    -d "{\"prompt\":\"Draft a polite follow-up about the Q3 report.\"}" \
    http://127.0.0.1:17872/api/stream
  ```
- Optional: run golden tasks in stub mode:
  ```bash
  npm run golden -- --limit 5
  ```
- Test both start scripts on their respective OS.

## 7) Publish

- Create a GitHub Release, upload binaries/archives, and include the SHA-256 checksums.
- Update docs/USB_LAYOUT.md or docs/MODELS.md with any last-minute notes (e.g., model hashes).

## 8) Tag and bump

- Tag the release:
  ```bash
  git tag v0.1.0
  git push --tags
  ```
- Bump package.json for next 0.1.x and re-open [Unreleased] in CHANGELOG.md.
