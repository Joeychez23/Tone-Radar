const test = require("node:test");
const assert = require("node:assert/strict");
const { generateCandidates, tidy, addDeadline, suggestRewrites } = require("../lib/rewrite");
const { baseVerb } = require("../lib/lexicon");

const texts = (s) => generateCandidates(s).candidates.map((c) => c.text);

test("removes passive-aggressive openers and repairs capitalization", () => {
  assert.ok(texts("Per my last email, the report was due Friday.").includes("The report was due Friday."));
  assert.ok(texts("Thanks for finally getting back to me.").includes("Thanks for getting back to me."));
});

test("strips stacked hedges into a direct question", () => {
  const out = texts("I just wanted to maybe check if you had a chance to possibly look at it, if that's okay?");
  assert.equal(out[0], "Did you get a chance to look at it?");
});

test("turns accusations into shared next steps", () => {
  const out = texts("As I already mentioned, you forgot to update the docs AGAIN.");
  assert.ok(out.includes("We still need to update the docs."));
});

test("gives ownerless asks a placeholder owner and deadline", () => {
  const out = texts("Can someone look into this?");
  assert.ok(out.includes("[name], could you look into [what]?"));
  assert.ok(out.some((t) => t.includes("by [day]")));
});

test("does not add a deadline when one exists", () => {
  assert.equal(addDeadline("Please send the numbers by 3pm Thursday."), null);
  assert.equal(addDeadline("Can you send me the file?"), "Can you send me the file by [day]?");
  assert.deepEqual(texts("Please send the final Q3 numbers to Dana by 3pm Thursday."), []);
});

test("does not lowercase known acronyms", () => {
  const ids = generateCandidates("Please send the JSON and the PDF ASAP.").hits.map((h) => h.entry.id);
  assert.ok(!ids.includes("pa.caps"));
});

test("tidy repairs punctuation left by removed phrases", () => {
  assert.equal(tidy(" , but the numbers are off , !", "Sorry, but the numbers are off!"), "The numbers are off!");
  assert.equal(tidy("could you send it.", "Would you mind sending it."), "Could you send it?");
});

test("baseVerb handles common verb forms", () => {
  assert.equal(baseVerb("sending"), "send");
  assert.equal(baseVerb("taking"), "take");
  assert.equal(baseVerb("reviewing"), "review");
  assert.equal(baseVerb("sent"), "send");
  assert.equal(baseVerb("updated"), "update");
  assert.equal(baseVerb("getting"), "get");
});

test("suggestRewrites scores the original alongside candidates in one request", async () => {
  const calls = [];
  const jevClient = {
    ask: async (state, questions) => {
      calls.push({ state, questions });
      const answers = {};
      for (const [id, q] of Object.entries(questions)) {
        answers[id] = q.type === "noul" ? { type: "noul", noul: 0.9 } : { type: "score", score: id.startsWith("c0:") ? 2 : 0.3, confidence: 0.9, probabilities: { 0: 0.7, 1: 0.3, 2: 0, 3: 0 } };
      }
      return { answers, usage: { input_tokens: 10, output_tokens: 2 } };
    },
  };
  const res = await suggestRewrites({ sentence: "Per my last email, the deck is late." }, { jevClient });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].state.candidates[0], "Per my last email, the deck is late.");
  assert.ok(res.original.pa > res.candidates[0].pa);
  assert.equal(res.candidates[0].meaning, 0.9);
  const again = await suggestRewrites({ sentence: "Per my last email, the deck is late." }, { jevClient });
  assert.equal(calls.length, 1, "second call is served from cache");
  assert.equal(again.cached, true);
});
