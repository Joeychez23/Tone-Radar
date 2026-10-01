// Splits a message into sentences with character offsets so the client can
// highlight them in place. Greetings, sign-offs, and signatures are tagged so
// they can be shown without being analyzed.

const ABBREVIATIONS = new Set([
  "mr", "mrs", "ms", "dr", "prof", "sr", "jr", "st", "vs", "etc", "e.g", "i.e", "eg", "ie",
  "inc", "ltd", "co", "corp", "approx", "dept", "est", "no", "fig", "a.m", "p.m", "u.s",
  "jan", "feb", "mar", "apr", "jun", "jul", "aug", "sep", "sept", "oct", "nov", "dec",
]);

const GREETING = /^(?:hi|hey|hello|dear|hiya|yo|greetings|good (?:morning|afternoon|evening)|morning|afternoon)\b[^.!?\n,]{0,40}[,!:—-]/i;
const GREETING_ONLY = /^(?:hi|hey|hello|dear|hiya|yo|greetings|good (?:morning|afternoon|evening)|morning|afternoon)\b[^.!?\n]{0,40}[,!.:]?$/i;
const SIGNOFF = /^(?:thanks|thank you|thx|ty|cheers|best|best regards|kind regards|warm regards|warmly|regards|sincerely|talk soon|all the best|many thanks|thanks again|thanks so much|thank you so much|appreciate it|much appreciated|take care)[\s,!.]*$/i;
const BULLET = /^(\s*)(?:[-*•‣◦]|\d{1,2}[.)])\s+/;

const MAX_SENTENCE_CHARS = 600;

function splitMessage(text) {
  const items = [];
  if (typeof text !== "string" || !text.trim()) return items;

  let offset = 0;
  let paragraph = 0;
  let afterSignoff = false;
  let seenContent = false;
  const lines = text.split("\n");

  lines.forEach((rawLine, lineNo) => {
    const lineStart = offset;
    offset += rawLine.length + 1;
    const line = rawLine.replace(/\s+$/, "");
    if (!line.trim()) {
      if (seenContent) paragraph += 1;
      return;
    }

    let contentStart = lineStart + (line.length - line.trimStart().length);
    let content = line.trim();
    const bullet = content.match(BULLET);
    if (bullet) {
      contentStart += bullet[0].length - bullet[1].length;
      content = content.slice(bullet[0].length - bullet[1].length);
    }

    if (afterSignoff && wordCount(content) <= 6 && !/[.!?]$/.test(content)) {
      push(items, content, contentStart, "signature", paragraph);
      return;
    }

    if (SIGNOFF.test(content)) {
      push(items, content, contentStart, "signoff", paragraph);
      afterSignoff = true;
      return;
    }

    if (!seenContent || isFirstLineOfMessage(lines, lineNo)) {
      if (GREETING_ONLY.test(content) && wordCount(content) <= 5) {
        push(items, content, contentStart, "greeting", paragraph);
        seenContent = true;
        return;
      }
      const g = content.match(GREETING);
      if (g && wordCount(g[0]) <= 5) {
        push(items, g[0], contentStart, "greeting", paragraph);
        const rest = content.slice(g[0].length);
        const lead = rest.length - rest.trimStart().length;
        contentStart += g[0].length + lead;
        content = rest.trim();
        if (!content) {
          seenContent = true;
          return;
        }
      }
    }

    seenContent = true;
    afterSignoff = false;
    for (const s of splitSentences(content)) {
      push(items, s.text, contentStart + s.start, SIGNOFF.test(s.text) ? "signoff" : "sentence", paragraph);
    }
  });

  return items.map((item, index) => ({ index, ...item }));
}

function isFirstLineOfMessage(lines, lineNo) {
  for (let i = 0; i < lineNo; i++) if (lines[i].trim()) return false;
  return true;
}

function push(items, text, start, kind, paragraph) {
  // Very long run-on chunks are kept whole but capped for analysis.
  items.push({ text, start, end: start + text.length, kind, paragraph, truncated: text.length > MAX_SENTENCE_CHARS });
}

function wordCount(s) {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

// Splits one line into sentences, returning offsets relative to the line.
function splitSentences(line) {
  const out = [];
  let start = 0;
  const re = /[.!?…]+["'”’)\]]*(?=\s+|$)/g;
  let m;
  while ((m = re.exec(line))) {
    const end = m.index + m[0].length;
    const before = line.slice(start, m.index);
    const after = line.slice(end);
    if (m[0][0] === "." && m[0].length === 1 && isAbbreviation(before)) continue;
    const next = after.trimStart();
    // Ellipses or punctuation followed by lowercase usually continue the sentence.
    if (next && /^[a-z]/.test(next) && !/[!?]/.test(m[0])) continue;
    const text = line.slice(start, end).trim();
    if (text) out.push({ text, start: start + (line.slice(start, end).length - line.slice(start, end).trimStart().length) });
    start = end;
  }
  const tail = line.slice(start);
  if (tail.trim()) out.push({ text: tail.trim(), start: start + (tail.length - tail.trimStart().length) });
  return out;
}

function isAbbreviation(before) {
  const word = before.match(/([A-Za-z][A-Za-z.]*)$/);
  if (!word) return false;
  const w = word[1].toLowerCase();
  if (ABBREVIATIONS.has(w)) return true;
  // Single initials such as "J. Smith".
  return /^[a-z]$/.test(w) && /(^|\s)[A-Z]$/.test(before);
}

module.exports = { splitMessage, splitSentences };
