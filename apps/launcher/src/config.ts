export type LauncherConfig = {
  // Upstream proxy mode (if provided, supervisor is skipped)
  upstreamUrl: string | null; // e.g., "http://127.0.0.1:8080"
  model: string; // model name/alias the upstream expects
  temperature: number;

  // Optional supervisor/autostart (used only when upstreamUrl is null)
  autostart: boolean; // USBLLM_AUTOSTART=true|1
  binPath: string | null; // path to llama-server binary
  modelFile: string | null; // path to .gguf
  preferPort: number | null; // desired port, else auto-pick
};

function toBool(s: string | undefined): boolean {
  if (!s) return false;
  const v = s.trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

export function loadConfig(): LauncherConfig {
  const upstreamUrl = (process.env.USBLLM_UPSTREAM_URL || '').trim() || null;
  const model = (process.env.USBLLM_MODEL || 'default').trim();
  const temperature = Number(process.env.USBLLM_TEMPERATURE || 0.3);

  const autostart = toBool(process.env.USBLLM_AUTOSTART);
  const binPath = (process.env.USBLLM_LLAMA_BIN || '').trim() || null;
  const modelFile = (process.env.USBLLM_MODEL_FILE || '').trim() || null;
  const preferPort = process.env.USBLLM_LLAMA_PORT ? Number(process.env.USBLLM_LLAMA_PORT) : null;

  return {
    upstreamUrl,
    model,
    temperature: Number.isFinite(temperature) ? temperature : 0.3,
    autostart,
    binPath,
    modelFile,
    preferPort: Number.isFinite(preferPort ?? NaN) ? (preferPort as number) : null,
  };
}
