import { diffWords, joinTokens } from "./diff";

test("marks removed and added words", () => {
  const d = diffWords("Per my last email, the report was due Friday.", "The report was due Friday.");
  expect(d[0]).toMatchObject({ type: "del", text: "Per my last email,", space: false });
  expect(d.filter((p) => p.type === "add")).toEqual([]);
  expect(d.find((p) => p.type === "same").text).toBe("The report was due Friday.");
});

test("keeps placeholders as single tokens", () => {
  const d = diffWords("Can someone look into this?", "[name], could you look into [what]?");
  expect(d.some((p) => p.type === "add" && p.text.includes("[name]"))).toBe(true);
  expect(d.some((p) => p.type === "add" && p.text === "[what]")).toBe(true);
});

test("joins tokens without spaces before punctuation", () => {
  expect(joinTokens(["Hi", ",", "Sam", "!"])).toBe("Hi, Sam!");
});
