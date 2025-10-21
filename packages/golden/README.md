# Golden Tasks & Offline Quality Harness

A lightweight CLI to validate USB-LLM's `/api/stream` endpoint by sending representative email-drafting tasks and scoring basic heuristics.

## Purpose

- **Infrastructure testing:** Verify SSE streaming, request validation, and response format work correctly
- **Baseline quality:** Ensure responses meet basic heuristics (length, greeting, CTA)
- **Offline-first:** No external APIs or dependencies
- **CI-friendly:** Exit code 0 (pass) or 1 (fail)

## Quick Start

### Run all tasks (Stub mode, no model required)

```bash
# From repo root - convenience script
npm run golden

# Or run directly
node packages/golden/golden.mjs
```

### Run with options

**Note:** Due to npm workspace limitations, use direct `node` calls when passing CLI flags:

```bash
# First 5 tasks only
node packages/golden/golden.mjs --limit 5

# Only Reply tasks
node packages/golden/golden.mjs --flow reply

# Formal tone only
node packages/golden/golden.mjs --tone formal

# Combine filters
node packages/golden/golden.mjs --flow compose --tone friendly --limit 10
```

### Test against a real model

If you have `llama-server` running externally:

```bash
node packages/golden/golden.mjs --url http://127.0.0.1:8080
```

Or with autostart mode (see `docs/USAGE.md`):

```bash
export USBLLM_AUTOSTART=1
export USBLLM_LLAMA_BIN=/path/to/llama-server
export USBLLM_MODEL_ID=starter-phi3-mini-q4_k_m
npm run -w apps/launcher start &

# Wait for launcher to be ready, then:
npm run golden
```

## CLI Options

```
--url <url>          Launcher URL (default: http://127.0.0.1:17872)
--flow <flow>        Filter by flow: reply, compose, rewrite
--tone <tone>        Filter by tone: formal, friendly, concise, neutral, enthusiastic, apologetic
--length <length>    Filter by length: short, medium, long
--limit <n>          Max number of tasks to run
--timeout-ms <ms>    Timeout per task (default: 30000)
--help, -h           Show help
```

**Examples:**

```bash
node packages/golden/golden.mjs --help
node packages/golden/golden.mjs --limit 3
node packages/golden/golden.mjs --flow reply --limit 5
node packages/golden/golden.mjs --timeout-ms 60000
```

## Heuristics

The CLI scores three basic heuristics per task:

1. **Length band:** Word count falls within expected range for `short` / `medium` / `long`
   - Short: 10-80 words
   - Medium: 60-180 words
   - Long: 150-400 words

2. **Has greeting:** Response includes common greetings (`Hi`, `Hello`, `Dear`, etc.)

3. **Has CTA:** Response includes a call-to-action (question mark or action verbs like "schedule", "confirm", "let me know")

These are **not** semantic quality checks — they're lightweight structural validators to catch obvious regressions.

## Exit Codes

- `0`: All tasks completed and all heuristics passed
- `1`: At least one task failed (network error or heuristic failure)
- `2`: Fatal error (missing tasks.json, invalid arguments, etc.)

## Stub Mode vs Real Models

### Stub Mode (default, no model required)

The launcher's Stub mode returns predictable placeholder text. This is perfect for:

- Testing that the CLI works correctly
- Validating request/response format
- Ensuring SSE streaming doesn't break

**Expected results in Stub mode:**

```
Total tasks:       25
Completed:         25
Failed (network):  0

Heuristic scores:
  Length band:     14/25  ← Some pass, some fail (stub is verbose)
  Has greeting:    25/25  ← Should all pass
  Has CTA:         14/25  ← Partial (stub includes some CTAs)

⚠️  SOME CHECKS FAILED
```

This is **normal and expected**. Stub mode validates infrastructure, not quality. The key metric is "Completed: 25" with zero network failures.

### Real Model Mode

Once you have a model set up (see `docs/MODELS.md`), re-run the golden tasks with a real model for better heuristic scores.

## Adding Tasks

Edit `tasks.json` to add more scenarios:

```json
{
  "label": "Reply: Example task",
  "flow": "reply",
  "tone": "formal",
  "length": "short",
  "context": "Context for Reply or Rewrite flows",
  "instructions": "Instructions for Compose flow"
}
```

**Valid values:**

- **flow:** `reply`, `compose`, `rewrite`
- **tone:** `formal`, `friendly`, `concise`, `neutral`, `enthusiastic`, `apologetic`
- **length:** `short`, `medium`, `long`

**Note:** The launcher doesn't accept a standalone `subject` field. Include subject lines as part of `context` or `instructions` instead (e.g., "Subject: Meeting Tomorrow. ...").

## Troubleshooting

**No tasks matched filters:**

- Check `--flow`, `--tone`, `--length` values match valid options listed above

**Network timeout:**

- Increase `--timeout-ms` (e.g., `--timeout-ms 60000` for 60 seconds)
- Model inference can be slow on older hardware

**Heuristics don't pass in Stub mode:**

- Expected! Stub mode returns generic text. Heuristics are calibrated for real models.
- Focus on "Completed" count in Stub mode to validate infrastructure

**All tasks fail with connection error:**

- Ensure launcher is running (`npm run -w apps/launcher start`)
- Check `--url` points to the correct endpoint (default: `http://127.0.0.1:17872`)
