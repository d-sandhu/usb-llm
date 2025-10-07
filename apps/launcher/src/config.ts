export type LauncherConfig = {
  // Upstream proxy mode (if provided, supervisor is skipped)
  upstreamUrl: string | null; // e.g., "http://127.0.0.1:8080"
  model: string; // model name/alias the upstream expects
  temperature: number;

  // Optional supervisor/autostart (used only when upstreamUrl is null)
  autostart: boolean; // USBLLM_AUTOSTART=true|1
  binPath: string | null; // path to llama-server binary
  modelFile: string | null; // path to .gguf (explicit override)
  preferPort: number | null; // desired port, else auto-pick

  // Headless local model resolution (no picker)
  modelId: string | null; // matches models/registry.json
  modelsDir: string; // directory where .gguf is expected
  uiAllowPicker: boolean; // exposed via /v1/models for dev toggles (default false)

  // Llama flags (optional)
  ctxSize: number | null; // USBLLM_CTX_SIZE
  threads: number | null; // USBLLM_THREADS
  tempDir: string | null; // USBLLM_TEMP_DIR
  logDisable: boolean; // USBLLM_LOG_DISABLE=1/true

  // Prompt / system prelude (optional)
  systemPrelude: string | null; // USBLLM_SYSTEM_PRELUDE
};

function toBool(s: string | undefined): boolean {
  if (!s) return false;
  const v = s.trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

function toIntOrNull(s: string | undefined): number | null {
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function loadConfig(): LauncherConfig {
  const upstreamUrl = (process.env.USBLLM_UPSTREAM_URL || '').trim() || null;
  const model = (process.env.USBLLM_MODEL || 'default').trim();
  const temperature = Number(process.env.USBLLM_TEMPERATURE || 0.3);

  const autostart = toBool(process.env.USBLLM_AUTOSTART);
  const binPath = (process.env.USBLLM_LLAMA_BIN || '').trim() || null;
  const modelFile = (process.env.USBLLM_MODEL_FILE || '').trim() || null;
  const preferPort = process.env.USBLLM_LLAMA_PORT ? Number(process.env.USBLLM_LLAMA_PORT) : null;

  // Headless resolution
  const modelId = (process.env.USBLLM_MODEL_ID || '').trim() || null;
  const modelsDir = (process.env.USBLLM_MODELS_DIR || 'models').trim() || 'models';
  const uiAllowPicker = toBool(process.env.USBLLM_UI_ALLOW_PICKER); // default false

  // Llama flags
  const ctxSize = toIntOrNull(process.env.USBLLM_CTX_SIZE);
  const threads = toIntOrNull(process.env.USBLLM_THREADS);
  const tempDir = (process.env.USBLLM_TEMP_DIR || '').trim() || null;
  const logDisable = toBool(process.env.USBLLM_LOG_DISABLE);

  // Prompt / system prelude
  const systemPrelude = (process.env.USBLLM_SYSTEM_PRELUDE || '').trim() || null;

  return {
    upstreamUrl,
    model,
    temperature: Number.isFinite(temperature) ? temperature : 0.3,
    autostart,
    binPath,
    modelFile,
    preferPort: Number.isFinite(preferPort ?? NaN) ? (preferPort as number) : null,
    modelId,
    modelsDir,
    uiAllowPicker,
    ctxSize,
    threads,
    tempDir,
    logDisable,
    systemPrelude,
  };
}
