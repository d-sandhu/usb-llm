# Models — USB-LLM

USB-LLM ships **no model weights**. Choose one model below based on your computer’s RAM, download its `.gguf` file, and (optionally) verify it.

> Not sure which to choose? Pick **Starter**. You can switch later without reinstalling.

---

## Which model should I pick?

| Tier         | Pick this if…                | RAM guidance | License    | Notes                                             |
| ------------ | ---------------------------- | ------------ | ---------- | ------------------------------------------------- |
| **Starter**  | You’re unsure / older laptop | ≤ **8 GB**   | **MIT**    | Smallest; runs almost anywhere.                   |
| **Standard** | Typical modern laptop        | **8–16 GB**  | Apache-2.0 | Better phrasing; good default for 2020+ machines. |
| **Pro**      | Newer machine, best quality  | ≥ **16 GB**  | Apache-2.0 | Strongest tone/clarity at this size.              |

**How to check RAM**

- **Windows:** Settings → System → About → _Installed RAM_
- **macOS:**  → About This Mac → _Memory_

---

## Models in this project

These appear in `models/registry.json` with stable IDs and filenames:

- **Starter — Phi-3 Mini Instruct (Q4_K_M)** — MIT  
  `id: starter-phi3-mini-q4_k_m`  
  `file: phi-3-mini-instruct-q4_k_m.gguf`  
  Context: 4k • Great default if unsure

- **Standard — Mistral 7B Instruct (Q4_K_M)** — Apache-2.0  
  `id: standard-mistral-7b-q4_k_m`  
  `file: mistral-7b-instruct-q4_k_m.gguf`  
  Context: 8k • Better phrasing on modern laptops

- **Pro — Qwen2.5 7B Instruct (Q4_K_M)** — Apache-2.0  
  `id: pro-qwen2_5-7b-q4_k_m`  
  `file: qwen2.5-7b-instruct-q4_k_m.gguf`  
  Context: 8k • Best quality here; prefers ≥16 GB RAM

> **USB sizing tip:** For one 7B model, a **16 GB** USB is comfortable. For multiple models, **32 GB+**.

---

## Verify a downloaded model (optional but recommended)

After downloading a `.gguf` file, you can verify its SHA-256 against the registry:

    npm run models:verify -- /path/to/model.gguf

- If the registry entry’s `sha256` is empty, the tool prints the **computed hash** — copy it into `models/registry.json` for that model.
- Run the command again; it should report `"ok": true`.

> Keep models on your **USB**. Do **not** commit weights to this repo.

---

## Related docs

- Running the launcher: see [`docs/USAGE.md`](./USAGE.md) (Stub / External Upstream / Autostart)
