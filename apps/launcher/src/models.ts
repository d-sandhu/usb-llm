import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { LauncherConfig } from './config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export type ModelRegistryEntry = {
  id: string;
  file: string; // filename only
  name?: string;
  license?: string; // e.g., "MIT", "Apache-2.0"
  ctx?: number;
  quant?: string;
  size_mb?: number;
};

export type ResolvedModel = {
  status: 'ok' | 'missing' | 'none';
  // internal (launcher-only)
  absPath?: string; // absolute path to .gguf (never send to UI)
  // public (safe to UI)
  id?: string | null;
  basename?: string | null;
  name?: string | null;
  license?: string | null;
  ctx?: number | null;
  quant?: string | null;
};

/** Try to read models/registry.json from common locations; return [] if absent. */
async function readRegistryJson(): Promise<ModelRegistryEntry[]> {
  const candidates = [
    path.resolve(process.cwd(), 'models', 'registry.json'),
    path.resolve(__dirname, '../../..', 'models', 'registry.json'), // when running from dist
  ];
  for (const p of candidates) {
    try {
      const raw = await readFile(p, 'utf8');
      const j = JSON.parse(raw);
      if (Array.isArray(j)) return j as ModelRegistryEntry[];
      if (Array.isArray(j?.models)) return j.models as ModelRegistryEntry[];
    } catch {
      // ignore; try next
    }
  }
  return [];
}

async function isFile(p: string): Promise<boolean> {
  try {
    const s = await stat(p);
    return s.isFile();
  } catch {
    return false;
  }
}

function byId(reg: ModelRegistryEntry[], id: string): ModelRegistryEntry | undefined {
  return reg.find((e) => e.id === id);
}

function byFilename(reg: ModelRegistryEntry[], filename: string): ModelRegistryEntry | undefined {
  const base = path.basename(filename).toLowerCase();
  return reg.find((e) => e.file.toLowerCase() === base);
}

/**
 * Resolve a single local model (headless). Always safe:
 * - If nothing configured or downloaded -> { status: 'none' }   (Stub is used)
 * - If configured but file missing       -> { status: 'missing' } (Stub is used)
 * - If found                             -> { status: 'ok', absPath, ... }
 *
 * Precedence:
 *   1) USBLLM_MODEL_FILE (if exists)
 *   2) USBLLM_MODEL_ID + modelsDir + registry entry (if exists)
 *   3) none
 */
export async function resolveLocalModel(cfg: LauncherConfig): Promise<ResolvedModel> {
  const registry = await readRegistryJson();

  // 1) explicit file path override
  if (cfg.modelFile) {
    const abs = path.resolve(cfg.modelFile);
    const exists = await isFile(abs);
    const match = byFilename(registry, abs);
    if (exists) {
      return {
        status: 'ok',
        absPath: abs,
        id: match?.id ?? null,
        basename: path.basename(abs),
        name: match?.name ?? null,
        license: match?.license ?? null,
        ctx: match?.ctx ?? null,
        quant: match?.quant ?? null,
      };
    }
    return {
      status: 'missing',
      id: match?.id ?? cfg.modelId ?? null,
      basename: path.basename(abs),
      name: match?.name ?? null,
      license: match?.license ?? null,
      ctx: match?.ctx ?? null,
      quant: match?.quant ?? null,
    };
  }

  // 2) modelId + modelsDir (+registry)
  if (cfg.modelId) {
    const entry = byId(registry, cfg.modelId);
    if (!entry) {
      // configured ID but no registry or no match => missing (safe: Stub is used)
      return {
        status: 'missing',
        id: cfg.modelId,
        basename: null,
        name: null,
        license: null,
        ctx: null,
        quant: null,
      };
    }
    const abs = path.resolve(cfg.modelsDir || 'models', entry.file);
    const exists = await isFile(abs);
    if (exists) {
      return {
        status: 'ok',
        absPath: abs,
        id: entry.id,
        basename: entry.file,
        name: entry.name ?? null,
        license: entry.license ?? null,
        ctx: entry.ctx ?? null,
        quant: entry.quant ?? null,
      };
    }
    return {
      status: 'missing',
      id: entry.id,
      basename: entry.file,
      name: entry.name ?? null,
      license: entry.license ?? null,
      ctx: entry.ctx ?? null,
      quant: entry.quant ?? null,
    };
  }

  // 3) nothing configured => none (Stub)
  return { status: 'none' };
}
