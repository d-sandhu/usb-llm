export type LauncherConfig = {
  upstreamUrl: string | null; // e.g., "http://127.0.0.1:8080"
  model: string; // model name/alias accepted by upstream
  temperature: number;
};

export function loadConfig(): LauncherConfig {
  const upstreamUrl = (process.env.USBLLM_UPSTREAM_URL || '').trim() || null;
  const model = (process.env.USBLLM_MODEL || 'default').trim();
  const temperature = Number(process.env.USBLLM_TEMPERATURE || 0.3);
  return { upstreamUrl, model, temperature: Number.isFinite(temperature) ? temperature : 0.3 };
}
