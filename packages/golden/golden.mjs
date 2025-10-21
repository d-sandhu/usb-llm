#!/usr/bin/env node

/**
 * Golden tasks CLI — sends email-drafting tasks to USB-LLM and scores basic heuristics.
 * Usage: node golden.mjs [--url http://...] [--flow reply] [--limit 10]
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ──────────────────────────────────────────────────────────────────
// CLI argument parsing
// ──────────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const args = argv.slice(2);
  const opts = {
    url: 'http://127.0.0.1:17872',
    flow: null,
    tone: null,
    length: null,
    limit: null,
    timeoutMs: 30000,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];

    if (arg === '--url' && next) {
      opts.url = next;
      i++;
    } else if (arg === '--flow' && next) {
      opts.flow = next;
      i++;
    } else if (arg === '--tone' && next) {
      opts.tone = next;
      i++;
    } else if (arg === '--length' && next) {
      opts.length = next;
      i++;
    } else if (arg === '--limit' && next) {
      opts.limit = parseInt(next, 10);
      i++;
    } else if (arg === '--timeout-ms' && next) {
      opts.timeoutMs = parseInt(next, 10);
      i++;
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Usage: node golden.mjs [options]

Options:
  --url <url>          Launcher URL (default: http://127.0.0.1:17872)
  --flow <flow>        Filter by flow: reply, compose, rewrite
  --tone <tone>        Filter by tone: formal, friendly, concise
  --length <length>    Filter by length: short, medium, long
  --limit <n>          Max number of tasks to run
  --timeout-ms <ms>    Timeout per task (default: 30000)
  --help, -h           Show this help

Examples:
  npm run golden                          # Run all tasks (Stub mode)
  npm run golden -- --limit 5             # Run first 5 tasks
  npm run golden -- --flow reply          # Only Reply tasks
  npm run golden -- --url http://...:8080 # Test external llama-server
      `);
      process.exit(0);
    }
  }

  return opts;
}

// ──────────────────────────────────────────────────────────────────
// Load tasks
// ──────────────────────────────────────────────────────────────────
async function loadTasks() {
  const tasksPath = join(__dirname, 'tasks.json');
  try {
    const raw = await readFile(tasksPath, 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data.tasks) ? data.tasks : [];
  } catch (e) {
    console.error('Failed to load tasks.json:', e instanceof Error ? e.message : e);
    process.exit(2);
  }
}

// ──────────────────────────────────────────────────────────────────
// Filter tasks by CLI options
// ──────────────────────────────────────────────────────────────────
function filterTasks(tasks, opts) {
  let filtered = tasks;

  if (opts.flow) {
    filtered = filtered.filter((t) => t.flow === opts.flow);
  }
  if (opts.tone) {
    filtered = filtered.filter((t) => t.tone === opts.tone);
  }
  if (opts.length) {
    filtered = filtered.filter((t) => t.length === opts.length);
  }
  if (opts.limit && opts.limit > 0) {
    filtered = filtered.slice(0, opts.limit);
  }

  return filtered;
}

// ──────────────────────────────────────────────────────────────────
// Send task to launcher and collect SSE response
// ──────────────────────────────────────────────────────────────────
async function runTask(task, url, timeoutMs) {
  const endpoint = `${url}/api/stream`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const body = {
    flow: task.flow,
    tone: task.tone,
    length: task.length,
    context: task.context || '',
    instructions: task.instructions || '',
  };

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    if (!res.body) {
      throw new Error('No response body');
    }

    let fullText = '';
    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (!line.trim() || line.startsWith(':')) continue;

        if (line.startsWith('event:')) continue;

        if (line.startsWith('data:')) {
          const dataStr = line.slice(5).trim();
          if (!dataStr) continue;

          try {
            const parsed = JSON.parse(dataStr);
            // Handle both "text" (current stub format) and "token" (alternative format)
            const tokenText = parsed.text || parsed.token;
            if (tokenText) {
              fullText += tokenText;
            }
          } catch {
            // Ignore parse errors
          }
        }
      }
    }

    return { ok: true, text: fullText };
  } catch (err) {
    clearTimeout(timeoutId);
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ──────────────────────────────────────────────────────────────────
// Heuristics scoring
// ──────────────────────────────────────────────────────────────────
function scoreHeuristics(text, expectedLength) {
  const scores = {
    length_band: false,
    has_greeting: false,
    has_cta: false,
  };

  const wordCount = text.split(/\s+/).filter((w) => w.length > 0).length;

  // Length bands (rough guidance)
  const bands = {
    short: [10, 80],
    medium: [60, 180],
    long: [150, 400],
  };

  const [min, max] = bands[expectedLength] || [0, Infinity];
  scores.length_band = wordCount >= min && wordCount <= max;

  // Greeting detection
  const lowerText = text.toLowerCase();
  const greetings = ['hi ', 'hello', 'dear ', 'good morning', 'good afternoon', 'greetings'];
  scores.has_greeting = greetings.some((g) => lowerText.includes(g));

  // CTA detection (question mark or action verbs)
  const hasQuestion = text.includes('?');
  const actionVerbs = [
    'schedule',
    'confirm',
    'share',
    'reply',
    'respond',
    'let me know',
    'please',
    'feel free',
    'reach out',
  ];
  const hasCta = hasQuestion || actionVerbs.some((v) => lowerText.includes(v));
  scores.has_cta = hasCta;

  return scores;
}

// ──────────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────────
async function main() {
  const opts = parseArgs(process.argv);
  console.log('🧪 USB-LLM Golden Tasks Harness');
  console.log(`📍 Target: ${opts.url}`);
  console.log(`⏱️  Timeout: ${opts.timeoutMs}ms per task\n`);

  const allTasks = await loadTasks();
  const tasks = filterTasks(allTasks, opts);

  if (tasks.length === 0) {
    console.log('⚠️  No tasks matched your filters.');
    process.exit(0);
  }

  console.log(`Running ${tasks.length} task(s)...\n`);

  const results = [];

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const label = task.label || `Task ${i + 1}`;
    process.stdout.write(`  [${i + 1}/${tasks.length}] ${label} ... `);

    const result = await runTask(task, opts.url, opts.timeoutMs);

    if (!result.ok) {
      console.log(`❌ FAIL (${result.error})`);
      results.push({ task, ok: false, error: result.error });
      continue;
    }

    const scores = scoreHeuristics(result.text, task.length);
    const allPass = scores.length_band && scores.has_greeting && scores.has_cta;

    if (allPass) {
      console.log('✅ PASS');
    } else {
      console.log('⚠️  PARTIAL');
    }

    results.push({
      task,
      ok: true,
      text: result.text,
      scores,
    });
  }

  // ──────────────────────────────────────────────────────────────────
  // Summary
  // ──────────────────────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(60));
  console.log('📊 SUMMARY');
  console.log('─'.repeat(60));

  const completed = results.filter((r) => r.ok);
  const failed = results.filter((r) => !r.ok);

  console.log(`Total tasks:       ${tasks.length}`);
  console.log(`Completed:         ${completed.length}`);
  console.log(`Failed (network):  ${failed.length}`);

  if (completed.length > 0) {
    const lengthPass = completed.filter((r) => r.scores.length_band).length;
    const greetingPass = completed.filter((r) => r.scores.has_greeting).length;
    const ctaPass = completed.filter((r) => r.scores.has_cta).length;

    console.log(`\nHeuristic scores:`);
    console.log(`  Length band:     ${lengthPass}/${completed.length}`);
    console.log(`  Has greeting:    ${greetingPass}/${completed.length}`);
    console.log(`  Has CTA:         ${ctaPass}/${completed.length}`);

    const allHeuristicsPass =
      lengthPass === completed.length &&
      greetingPass === completed.length &&
      ctaPass === completed.length;

    if (allHeuristicsPass && failed.length === 0) {
      console.log('\n✅ ALL CHECKS PASSED');
      process.exit(0);
    } else {
      console.log('\n⚠️  SOME CHECKS FAILED');
      process.exit(1);
    }
  } else {
    console.log('\n❌ NO TASKS COMPLETED');
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(2);
});
