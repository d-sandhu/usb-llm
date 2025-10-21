#!/usr/bin/env node

/**
 * Model helper CLI — manage .gguf models in the models/ directory
 * Commands:
 *   add <source>     Copy a .gguf file into models/ with registry filename
 *   list             Show registry entries and files on disk
 *   verify <path>    Verify SHA-256 (use models:verify instead)
 */

import { readFile, copyFile, access, readdir } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const MODELS_DIR = join(__dirname, '..', 'models');
const REG_PATH = join(__dirname, '..', 'models', 'registry.json');

// ──────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────

async function loadRegistry() {
  try {
    const raw = await readFile(REG_PATH, 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data?.models) ? data.models : [];
  } catch (e) {
    console.error('Failed to read models/registry.json:', e instanceof Error ? e.message : e);
    process.exit(2);
  }
}

function sha256File(path) {
  return new Promise((resolve, reject) => {
    const h = createHash('sha256');
    const s = createReadStream(path);
    s.on('error', reject);
    s.on('data', (chunk) => h.update(chunk));
    s.on('end', () => resolve(h.digest('hex')));
  });
}

async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

// ──────────────────────────────────────────────────────────────────
// Command: add <source>
// ──────────────────────────────────────────────────────────────────

async function cmdAdd(sourcePath) {
  if (!sourcePath) {
    console.error('Usage: npm run models:add -- <path/to/model.gguf>');
    process.exit(2);
  }

  const exists = await fileExists(sourcePath);
  if (!exists) {
    console.error(`Error: File not found: ${sourcePath}`);
    process.exit(1);
  }

  const sourceBasename = basename(sourcePath);
  console.log(`📦 Adding model: ${sourceBasename}`);

  const registry = await loadRegistry();
  const entry = registry.find((m) => m.file === sourceBasename);

  if (!entry) {
    console.error(`\n❌ File not listed in registry: ${sourceBasename}`);
    console.error('\nAvailable models in registry:');
    registry.forEach((m) => {
      console.error(`  - ${m.file} (${m.name})`);
    });
    console.error('\nEither:');
    console.error('  1. Rename your file to match a registry entry, or');
    console.error('  2. Add a new entry to models/registry.json');
    process.exit(1);
  }

  const destPath = join(MODELS_DIR, entry.file);
  const destExists = await fileExists(destPath);

  if (destExists) {
    console.log(`⚠️  File already exists: ${destPath}`);
    console.log('Verifying existing file...');
  } else {
    console.log(`📋 Copying to: ${destPath}`);
    try {
      await copyFile(sourcePath, destPath);
      console.log('✅ Copy complete');
    } catch (e) {
      console.error('❌ Copy failed:', e instanceof Error ? e.message : e);
      process.exit(1);
    }
  }

  // Verify SHA-256
  console.log('🔍 Verifying SHA-256...');
  const computed = await sha256File(destPath);

  if (!entry.sha256) {
    console.log('\n⚠️  No SHA-256 in registry for this model.');
    console.log(`Computed: ${computed}`);
    console.log('\nTo enable verification, add this hash to models/registry.json:');
    console.log(`  "sha256": "${computed}"`);
    console.log('\n✅ Model added (verification skipped)');
    printNextSteps(entry);
    process.exit(0);
  }

  const expected = entry.sha256.toLowerCase();
  const match = computed.toLowerCase() === expected;

  if (match) {
    console.log('✅ SHA-256 verified');
    console.log(`   Expected: ${expected}`);
    console.log(`   Computed: ${computed}`);
    console.log('\n✅ Model added successfully');
    printNextSteps(entry);
    process.exit(0);
  } else {
    console.error('\n❌ SHA-256 MISMATCH');
    console.error(`   Expected: ${expected}`);
    console.error(`   Computed: ${computed}`);
    console.error('\nThis file may be:');
    console.error('  - Corrupted during download');
    console.error('  - The wrong file (different quantization or version)');
    console.error('  - From an untrusted source');
    console.error('\nRecommendation: Re-download from the official source and try again.');
    process.exit(1);
  }
}

function printNextSteps(entry) {
  console.log('\n📚 Next steps:');
  console.log(`\n1. Set environment variable:`);
  console.log(`   export USBLLM_MODEL_ID=${entry.id}`);
  console.log(`\n2. Enable autostart (if using llama-server):`);
  console.log(`   export USBLLM_AUTOSTART=1`);
  console.log(`   export USBLLM_LLAMA_BIN=/path/to/llama-server`);
  console.log(`\n3. Start the launcher:`);
  console.log(`   npm run -w apps/launcher start`);
  console.log(`\n4. Test with golden tasks:`);
  console.log(`   npm run golden`);
  console.log(`\nSee docs/USAGE.md and docs/MODELS.md for more details.`);
}

// ──────────────────────────────────────────────────────────────────
// Command: list
// ──────────────────────────────────────────────────────────────────

async function cmdList() {
  console.log('📋 Model Registry\n');

  const registry = await loadRegistry();

  if (registry.length === 0) {
    console.log('No models in registry.');
    process.exit(0);
  }

  let files;
  try {
    files = await readdir(MODELS_DIR);
  } catch {
    files = [];
  }

  const ggufFiles = files.filter((f) => f.endsWith('.gguf'));

  for (const entry of registry) {
    const onDisk = ggufFiles.includes(entry.file);
    const icon = onDisk ? '✅' : '❌';
    console.log(`${icon} ${entry.name}`);
    console.log(`   ID:       ${entry.id}`);
    console.log(`   File:     ${entry.file}`);
    console.log(`   License:  ${entry.license}`);
    console.log(
      `   RAM:      ${entry.min_ram_gb}+ GB (${entry.recommended_ram_gb} GB recommended)`
    );
    console.log(`   Status:   ${onDisk ? 'Present' : 'Missing'}`);
    if (entry.sha256) {
      console.log(`   SHA-256:  ${entry.sha256.slice(0, 16)}...`);
    } else {
      console.log(`   SHA-256:  (not set)`);
    }
    console.log('');
  }

  const extraFiles = ggufFiles.filter((f) => !registry.some((e) => e.file === f));
  if (extraFiles.length > 0) {
    console.log('⚠️  Unrecognized .gguf files in models/:');
    extraFiles.forEach((f) => console.log(`   - ${f}`));
    console.log('\nThese files are not in the registry and will be ignored.\n');
  }

  const presentCount = registry.filter((e) => ggufFiles.includes(e.file)).length;
  console.log(`Summary: ${presentCount}/${registry.length} models present`);
}

// ──────────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log(`
USB-LLM Model Helper

Commands:
  add <source>     Copy a .gguf file into models/ with registry filename
  list             Show registry entries and files on disk
  verify <path>    Verify SHA-256 (use: npm run models:verify -- <path>)

Examples:
  npm run models:add -- ~/Downloads/phi-3-mini-instruct-q4_k_m.gguf
  npm run models:list
  npm run models:verify -- models/phi-3-mini-instruct-q4_k_m.gguf

See docs/MODELS.md for model recommendations and setup instructions.
    `);
    process.exit(0);
  }

  const cmd = args[0];
  const cmdArgs = args.slice(1);

  if (cmd === 'add') {
    await cmdAdd(cmdArgs[0]);
  } else if (cmd === 'list') {
    await cmdList();
  } else {
    console.error(`Unknown command: ${cmd}`);
    console.error('Run with --help for usage.');
    process.exit(2);
  }
}

main().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(2);
});
