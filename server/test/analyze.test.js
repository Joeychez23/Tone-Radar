const test = require("node:test");
const assert = require("node:assert/strict");
const { analyzeMessage } = require("../lib/analyze");

function fakeJev() {
  const calls = [];
  return {
    calls,
    ask: async (state, questions) => {
      calls.push({ state, questions });
      const answers = {};
      for (const [id, q] of Object.entries(questions)) {
        if (q.type === "noul") answers[id] = { type: "noul", noul: 0.5 };
        else if (q.type === "choice") answers[id] = { type: "choice", choice: Object.keys(q.criteria)[1], confidence: 0.8, probabilities: {} };
        else answers[id] = { type: "score", score: 1.5, confidence: 0.7, probabilities: { 0: 0.1, 1: 0.4, 2: 0.4, 3: 0.1 } };
      }
      return { answers, usage: { input_tokens: 100, output_tokens: 10 } };
    },
  };
}

test("asks about every sentence plus the whole message in one request", async () => {
  const jevClient = fakeJev();
  const text = `Hi team,\nUnique sentence ${Date.now()} one. And another ${Math.random()} here.\nThanks,\nAl`;
  const result = await analyzeMessage(text, { audience: "team", channel: "chat" }, { jevClient });
  assert.equal(jevClient.calls.length, 1);
  const { state, questions } = jevClient.calls[0];
  assert.equal(state.sentences.length, 2);
  assert.equal(state.audience, "the sender's whole team");
  assert.ok(questions["s1:pa"].instructions.includes("`sentences[1]`"));
  assert.ok(questions["msg:tone"]);
  const analyzed = result.sentences.filter((s) => s.analysis);
  assert.equal(analyzed.length, 2);
  assert.equal(analyzed[0].analysis.pa, 0.5);
  assert.equal(analyzed[0].analysis.ask, 0.25);
  assert.equal(result.message.tone, "neutral");
});

test("only re-analyzes sentences that changed", async () => {
  const jevClient = fakeJev();
  const stable = `Stable sentence ${Math.random()}.`;
  await analyzeMessage(`${stable} First version.`, {}, { jevClient });
  const second = await analyzeMessage(`${stable} Second version.`, {}, { jevClient });
  assert.equal(jevClient.calls.length, 2);
  assert.deepEqual(jevClient.calls[1].state.sentences, ["Second version."]);
  assert.equal(second.stats.cached, 1);
  assert.equal(second.stats.analyzed, 1);
});

test("rejects messages over the length limit", async () => {
  await assert.rejects(analyzeMessage("x".repeat(9000), {}, { jevClient: fakeJev() }), /limited to/);
});

test("splits large messages into parallel batches", async () => {
  const jevClient = fakeJev();
  const text = Array.from({ length: 45 }, (_, i) => `Batch sentence ${i} ${Math.random()}.`).join(" ");
  const result = await analyzeMessage(text, {}, { jevClient });
  assert.equal(jevClient.calls.length, 3);
  assert.equal(result.sentences.filter((s) => s.analysis).length, 45);
});
