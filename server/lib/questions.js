// Question builders for Jev. Every sentence-level judgment takes a backticked
// path to the sentence so many sentences can share one request.

const PA_LEVELS = [
  "Sincere and direct, with no hidden jab",
  "Slightly pointed wording a reader might notice, such as 'as discussed' or 'just a reminder', but most readers take it as neutral",
  "Polite on the surface but carries a clear implied criticism, such as 'per my last email' or 'as I already mentioned'",
  "Sarcastic or thinly veiled hostility that the reader will clearly feel as a jab",
];

const BLAME_LEVELS = [
  "No blame: states facts, thanks, or next steps without pointing at anyone's fault",
  "Names who was involved in a problem in a factual, non-judgmental way",
  "Implies that a specific person or team caused a problem or failed to do their job",
  "Directly accuses or scolds someone for a failure",
];

const HEDGE_LEVELS = [
  "Direct and confident wording",
  "Light, normal politeness softening such as 'could you' or 'I think'",
  "Several qualifiers that weaken the point, such as 'just', 'maybe', 'sort of', or 'if that's okay'",
  "So hedged or apologetic that the point or request gets lost",
];

const CLARITY_LEVELS = [
  "Vague: the reader cannot tell exactly what is wanted",
  "Roughly clear what is wanted, but not who should do it or when it is needed",
  "Clear what is wanted, but who should do it or when it is needed is only implied",
  "Specific: clear what is wanted, who should do it, and by when",
];

const SCORE_DIMENSIONS = {
  pa: { levels: PA_LEVELS, ask: (p, ctx) => `How passive-aggressive is the sentence ${p}${ctx}?` },
  blame: { levels: BLAME_LEVELS, ask: (p, ctx) => `How much does the sentence ${p} blame the reader or another person${ctx}?` },
  hedge: { levels: HEDGE_LEVELS, ask: (p) => `How much hedging, qualifying, or over-apologizing is in the sentence ${p}?` },
};

// Questions for one sentence. `path` is a state path such as sentences[3];
// `withContext` adds the surrounding message as context for the judgment.
function sentenceQuestions(prefix, path, { withContext = true } = {}) {
  const p = `\`${path}\``;
  const ctx = withContext ? ", read as part of `message`" : "";
  const q = {};
  for (const [dim, def] of Object.entries(SCORE_DIMENSIONS)) {
    q[`${prefix}${dim}`] = { type: "score", instructions: def.ask(p, ctx), criteria: def.levels };
  }
  q[`${prefix}request`] = {
    type: "noul",
    instructions: `Does the sentence ${p} ask the reader to do, decide, send, or answer something?`,
  };
  q[`${prefix}clarity`] = {
    type: "score",
    instructions: `Suppose the sentence ${p} asks the reader for something. How clear is that ask${withContext ? ", using `message` for context" : ""}?`,
    criteria: CLARITY_LEVELS,
  };
  return q;
}

// Whole-message judgments that feed the summary panel.
function messageQuestions() {
  return {
    "msg:tone": {
      type: "choice",
      instructions: "Which word best describes the overall tone of `message` as the reader will experience it?",
      criteria: {
        warm: "Friendly, appreciative, or encouraging",
        neutral: "Matter-of-fact and professional",
        curt: "Short or brusque in a way that could feel cold",
        frustrated: "Shows annoyance or impatience",
        hostile: "Openly angry, accusatory, or sarcastic",
      },
    },
    "msg:reaction": {
      type: "score",
      instructions: "How is the reader, described by `audience`, most likely to feel after reading `message`?",
      criteria: [
        "Appreciated or motivated",
        "Neutral, simply informed",
        "Mildly annoyed or put on the spot",
        "Defensive, hurt, or angry",
      ],
    },
    "msg:has_request": {
      type: "noul",
      instructions: "Does `message` ask the reader to do, decide, send, or answer something?",
    },
    "msg:next_step": {
      type: "noul",
      instructions: "After reading `message`, would the reader know exactly what they are expected to do next and by when?",
    },
    "msg:fit": {
      type: "score",
      instructions: "How appropriate is the tone of `message` for the relationship in `audience` and the medium in `channel`?",
      criteria: [
        "Inappropriate: likely to damage the relationship or embarrass the sender",
        "Somewhat off: too blunt, too casual, or too stiff for this reader",
        "Appropriate for this reader and medium",
      ],
    },
  };
}

// Questions comparing rewrite candidates to the original sentence.
function candidateQuestions(k) {
  const p = `\`candidates[${k}]\``;
  return {
    ...sentenceQuestions(`c${k}:`, `candidates[${k}]`, { withContext: false }),
    [`c${k}:meaning`]: {
      type: "noul",
      instructions: {
        question: `Ignoring tone, attitude, and politeness, does ${p} carry the same core information and the same request as \`original\`?`,
        counts_as_same: [
          "removing a jab, sarcasm, blame, or a complaint about timing",
          "removing a pointed reference to an earlier message, such as 'per my last email' or 'as I already said'",
          "replacing who is at fault with a neutral description of the problem",
          "removing filler words, qualifiers, or apologies",
          "rephrasing a statement as a direct question",
          "adding a placeholder such as [day] or [name] for the reader to fill in",
        ],
        counts_as_different: [
          "dropping or changing a fact, number, date, name, or deliverable",
          "dropping the request or asking for something else",
        ],
      },
    },
    [`c${k}:natural`]: {
      type: "noul",
      instructions: `Is ${p} a natural, grammatical sentence that a professional would write? Treat bracketed placeholders such as [day] as filled in.`,
    },
  };
}

// Converts raw Jev answers for one prefix into normalized 0..1 dimensions.
function readSentence(answers, prefix) {
  const get = (k) => answers[`${prefix}${k}`];
  const norm = (a) => (a ? a.score / 3 : 0);
  const pa = get("pa");
  const blame = get("blame");
  const hedge = get("hedge");
  const request = get("request");
  const clarity = get("clarity");
  const requestP = request ? request.noul : 0;
  const clarityN = norm(clarity);
  return {
    pa: round(norm(pa)),
    blame: round(norm(blame)),
    hedge: round(norm(hedge)),
    ask: round(requestP * (1 - clarityN)),
    request: round(requestP),
    clarity: round(clarityN),
    confidence: {
      pa: round(pa?.confidence ?? 0),
      blame: round(blame?.confidence ?? 0),
      hedge: round(hedge?.confidence ?? 0),
      ask: round(clarity?.confidence ?? 0),
    },
    levels: {
      pa: dist(pa),
      blame: dist(blame),
      hedge: dist(hedge),
      clarity: dist(clarity),
    },
  };
}

function readMessage(answers) {
  const tone = answers["msg:tone"];
  const reaction = answers["msg:reaction"];
  const fit = answers["msg:fit"];
  return {
    tone: tone?.choice ?? null,
    toneProbabilities: tone?.probabilities ?? {},
    toneConfidence: round(tone?.confidence ?? 0),
    reaction: round(reaction ? reaction.score / 3 : 0),
    reactionLevel: reaction ? Math.round(reaction.score) : null,
    hasRequest: round(answers["msg:has_request"]?.noul ?? 0),
    nextStepClear: round(answers["msg:next_step"]?.noul ?? 0),
    fit: round(fit ? fit.score / 2 : 1),
  };
}

const dist = (a) => (a?.probabilities ? Object.values(a.probabilities).map(round) : []);
const round = (n) => Math.round(n * 1000) / 1000;

module.exports = {
  sentenceQuestions,
  messageQuestions,
  candidateQuestions,
  readSentence,
  readMessage,
  LEVELS: { pa: PA_LEVELS, blame: BLAME_LEVELS, hedge: HEDGE_LEVELS, clarity: CLARITY_LEVELS },
};
