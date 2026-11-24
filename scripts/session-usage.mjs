#!/usr/bin/env node
// Sums token use, cost and time of Claude Code sessions, sub-agents included.
// Usage: node scripts/session-usage.mjs [--json] <session.jsonl> [more.jsonl ...]
// Sessions live in ~/.claude/projects/<project>/<session-id>.jsonl; sub-agents in <session-id>/subagents/*.jsonl.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";

// US dollars per million tokens, from the Anthropic pricing table as of 2026-11-03.
// Cache writes: 1.25 times input for the 5-minute cache, 2 times for the 1-hour cache.
// Check https://platform.claude.com/docs/en/about-claude/pricing before using the numbers.
const prices = {
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.1 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5, cacheRead: 0.01 },
};

function readLines(file) {
  return readFileSync(file, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function subagentFiles(sessionFile) {
  const dir = join(dirname(sessionFile), basename(sessionFile, ".jsonl"), "subagents");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith(".jsonl"))
    .map((name) => join(dir, name));
}

// A line is the person typing when it is a user message with text, not a tool result or a harness note.
function isPersonTyping(line) {
  if (line.type !== "user" || line.isMeta || line.isSidechain) return false;
  const content = line.message?.content;
  if (typeof content === "string") return !content.startsWith("<");
  return Array.isArray(content) && content.some((block) => block.type === "text");
}

function addUsage(totals, model, usage) {
  const t = (totals[model] ??= {
    input: 0,
    cacheWrite5m: 0,
    cacheWrite1h: 0,
    cacheRead: 0,
    output: 0,
    messages: 0,
  });
  const write1h = usage.cache_creation?.ephemeral_1h_input_tokens ?? 0;
  t.input += usage.input_tokens ?? 0;
  t.cacheWrite1h += write1h;
  t.cacheWrite5m += (usage.cache_creation_input_tokens ?? 0) - write1h;
  t.cacheRead += usage.cache_read_input_tokens ?? 0;
  t.output += usage.output_tokens ?? 0;
  t.messages += 1;
}

function cost(model, t) {
  const p = prices[model];
  if (!p) return undefined;
  const dollars =
    t.input * p.input +
    t.cacheWrite5m * p.input * 1.25 +
    t.cacheWrite1h * p.input * 2 +
    t.cacheRead * p.cacheRead +
    t.output * p.output;
  return dollars / 1e6;
}

const args = process.argv.slice(2);
const asJson = args.includes("--json");
const sessions = args.filter((arg) => arg !== "--json");
if (sessions.length === 0) {
  console.error("Usage: node scripts/session-usage.mjs [--json] <session.jsonl> [more.jsonl ...]");
  process.exit(1);
}

const totals = {};
const seen = new Set();
let toolCalls = 0;
let start;
let end;
let waitingMs = 0;
let personMessages = 0;
let questionsToPerson = 0;
let subagents = 0;

for (const session of sessions) {
  const files = [session, ...subagentFiles(session)];
  subagents += files.length - 1;
  for (const file of files) {
    const lines = readLines(file);
    const isMain = file === session;
    const asked = new Map();
    let lastAssistantAt;
    for (const line of lines) {
      const at = line.timestamp ? Date.parse(line.timestamp) : undefined;
      if (isMain && at !== undefined) {
        start = start === undefined ? at : Math.min(start, at);
        end = end === undefined ? at : Math.max(end, at);
      }
      const message = line.message;
      if (line.type === "assistant" && message?.usage && message.id) {
        if (isMain) lastAssistantAt = at;
        // One API response is logged once per content block; count its usage once.
        if (!seen.has(message.id)) {
          seen.add(message.id);
          addUsage(totals, message.model ?? "unknown", message.usage);
        }
        for (const block of message.content ?? []) {
          if (block.type !== "tool_use") continue;
          toolCalls += 1;
          if (isMain && block.name === "AskUserQuestion") {
            questionsToPerson += 1;
            asked.set(block.id, at);
          }
        }
      }
      if (!isMain || line.type !== "user") continue;
      // Waiting for the person: from a question to its answer, and from the agent's last reply to the person's next message.
      for (const block of Array.isArray(message?.content) ? message.content : []) {
        if (block.type === "tool_result" && asked.has(block.tool_use_id) && at !== undefined) {
          waitingMs += at - asked.get(block.tool_use_id);
          asked.delete(block.tool_use_id);
        }
      }
      if (isPersonTyping(line)) {
        personMessages += 1;
        if (lastAssistantAt !== undefined && at !== undefined)
          waitingMs += Math.max(0, at - lastAssistantAt);
        lastAssistantAt = undefined;
      }
    }
  }
}

// Claude Code logs some local messages under the model "<synthetic>" with no tokens; leave out models with none.
const models = Object.entries(totals)
  .filter(([, t]) => t.input + t.cacheWrite5m + t.cacheWrite1h + t.cacheRead + t.output > 0)
  .map(([model, t]) => ({ model, ...t, usd: cost(model, t) }));
const totalUsd = models.reduce((sum, m) => sum + (m.usd ?? 0), 0);
const minutes = (ms) => Math.round(ms / 60000);
const result = {
  sessions,
  subagents,
  wallClockMinutes: start === undefined ? 0 : minutes(end - start),
  waitingForPersonMinutes: minutes(waitingMs),
  agentMinutes: start === undefined ? 0 : minutes(end - start - waitingMs),
  personMessages,
  questionsToPerson,
  apiResponses: seen.size,
  toolCalls,
  models,
  totalUsd: Math.round(totalUsd * 100) / 100,
  unpricedModels: models.filter((m) => m.usd === undefined).map((m) => m.model),
};

if (asJson) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log(`Sessions: ${sessions.length}, sub-agents: ${subagents}`);
  console.log(
    `Wall clock: ${result.wallClockMinutes} min, agent: ${result.agentMinutes} min, waiting for the person: ${result.waitingForPersonMinutes} min`,
  );
  console.log(
    `Person messages: ${personMessages}, questions asked: ${questionsToPerson}, API responses: ${seen.size}, tool calls: ${toolCalls}`,
  );
  console.table(
    models.map((m) => ({
      model: m.model,
      input: m.input,
      "cache write 5m": m.cacheWrite5m,
      "cache write 1h": m.cacheWrite1h,
      "cache read": m.cacheRead,
      output: m.output,
      USD: m.usd === undefined ? "no price" : m.usd.toFixed(2),
    })),
  );
  console.log(
    `Total: $${result.totalUsd.toFixed(2)}${result.unpricedModels.length ? ` (no price for ${result.unpricedModels.join(", ")})` : ""}`,
  );
}
