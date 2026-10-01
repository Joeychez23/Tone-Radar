// Analyzes a message: splits it into sentences, asks Jev about every
// uncached sentence in a few batched requests, and adds whole-message
// judgments. Only sentences whose text changed hit the API.
const { splitMessage } = require("./split");
const { sentenceQuestions, messageQuestions, readSentence, readMessage } = require("./questions");
const { describeAudience, describeChannel } = require("./audience");
const { LruCache, hashKey } = require("./cache");
const jev = require("./jev");

const MAX_CHARS = 8000;
const MAX_SENTENCES = 60;
const SENTENCES_PER_REQUEST = 20;
const MESSAGE_CONTEXT_CHARS = 6000;
const MAX_CONTEXT_CHARS = 500;

const sentenceCache = new LruCache({ max: 20000 });
const messageCache = new LruCache({ max: 2000 });

class InputError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function normalizeOptions({ audience = "peer", channel = "email", context = "" } = {}) {
  return {
    audience: String(audience),
    channel: String(channel),
    context: typeof context === "string" ? context.trim().slice(0, MAX_CONTEXT_CHARS) : "",
  };
}

function baseState(text, opts) {
  const state = {
    channel: describeChannel(opts.channel),
    audience: describeAudience(opts.audience),
    message: text.slice(0, MESSAGE_CONTEXT_CHARS),
  };
  if (opts.context) state.situation = opts.context;
  return state;
}

async function analyzeMessage(text, rawOpts = {}, { signal, jevClient = jev } = {}) {
  if (typeof text !== "string") throw new InputError("Message text is required.");
  if (text.length > MAX_CHARS) throw new InputError(`Messages are limited to ${MAX_CHARS.toLocaleString()} characters.`, 413);
  const opts = normalizeOptions(rawOpts);
  const started = Date.now();
  const items = splitMessage(text);
  const sentences = items.filter((s) => s.kind === "sentence");
  if (sentences.length > MAX_SENTENCES) {
    throw new InputError(`Messages are limited to ${MAX_SENTENCES} sentences.`, 413);
  }
  if (!sentences.length) {
    return { sentences: items, message: null, stats: emptyStats(started) };
  }

  const keyFor = (s) => hashKey("s1", s.text, opts.audience, opts.channel, opts.context);
  const pending = [];
  for (const s of sentences) {
    const cached = sentenceCache.get(keyFor(s));
    if (cached) {
      s.analysis = cached;
      s.cached = true;
    } else {
      pending.push(s);
    }
  }

  const messageKey = hashKey("m1", text, opts.audience, opts.channel, opts.context);
  let message = messageCache.get(messageKey) || null;

  const batches = [];
  for (let i = 0; i < pending.length; i += SENTENCES_PER_REQUEST) {
    batches.push(pending.slice(i, i + SENTENCES_PER_REQUEST));
  }
  if (!batches.length && !message) batches.push([]);

  const usage = { inputTokens: 0, outputTokens: 0, requests: 0 };
  await Promise.all(
    batches.map(async (batch, b) => {
      const state = { ...baseState(text, opts), sentences: batch.map((s) => s.text.slice(0, 600)) };
      const questions = {};
      batch.forEach((_, j) => Object.assign(questions, sentenceQuestions(`s${j}:`, `sentences[${j}]`)));
      const wantMessage = b === 0 && !message;
      if (wantMessage) Object.assign(questions, messageQuestions());
      if (!Object.keys(questions).length) return;
      const data = await jevClient.ask(state, questions, { signal });
      usage.requests += 1;
      usage.inputTokens += data.usage?.input_tokens || 0;
      usage.outputTokens += data.usage?.output_tokens || 0;
      batch.forEach((s, j) => {
        s.analysis = readSentence(data.answers, `s${j}:`);
        s.cached = false;
        sentenceCache.set(keyFor(s), s.analysis);
      });
      if (wantMessage) {
        message = readMessage(data.answers);
        messageCache.set(messageKey, message);
      }
    })
  );

  return {
    sentences: items,
    message,
    stats: {
      latencyMs: Date.now() - started,
      analyzed: pending.length,
      cached: sentences.length - pending.length,
      ...usage,
    },
  };
}

function emptyStats(started) {
  return { latencyMs: Date.now() - started, analyzed: 0, cached: 0, inputTokens: 0, outputTokens: 0, requests: 0 };
}

module.exports = { analyzeMessage, InputError, normalizeOptions, baseState, MAX_CHARS, MAX_SENTENCES };
