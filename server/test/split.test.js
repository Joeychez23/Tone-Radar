const test = require("node:test");
const assert = require("node:assert/strict");
const { splitMessage } = require("../lib/split");

test("splits sentences with offsets that point back into the text", () => {
  const text = "Hi Sam,\n\nPer my last email, the report was due Friday. Dr. Lee said 3 p.m. works! Can you check?\n\nThanks,\nJoe";
  const items = splitMessage(text);
  for (const s of items) assert.equal(text.slice(s.start, s.end), s.text);
  assert.deepEqual(items.map((s) => s.kind), ["greeting", "sentence", "sentence", "sentence", "signoff", "signature"]);
  assert.equal(items[2].text, "Dr. Lee said 3 p.m. works!");
});

test("splits an inline greeting from the first sentence", () => {
  const items = splitMessage("Hey Dana, can you send the deck?");
  assert.deepEqual(items.map((s) => [s.kind, s.text]), [["greeting", "Hey Dana,"], ["sentence", "can you send the deck?"]]);
});

test("treats bullets as separate sentences without the bullet marker", () => {
  const text = "Next steps:\n- Send the deck\n2) Fix the typo";
  const items = splitMessage(text);
  assert.deepEqual(items.map((s) => s.text), ["Next steps:", "Send the deck", "Fix the typo"]);
  for (const s of items) assert.equal(text.slice(s.start, s.end), s.text);
});

test("keeps URLs, decimals, and lowercase continuations together", () => {
  const items = splitMessage("See https://example.com/a.b for v2.5 details... it is short. Done.");
  assert.deepEqual(items.map((s) => s.text), ["See https://example.com/a.b for v2.5 details... it is short.", "Done."]);
});

test("detects a trailing sign-off on the same line", () => {
  const items = splitMessage("can you look at this? thx");
  assert.deepEqual(items.map((s) => s.kind), ["sentence", "signoff"]);
});

test("returns nothing for blank input", () => {
  assert.deepEqual(splitMessage("   \n  "), []);
  assert.deepEqual(splitMessage(undefined), []);
});
