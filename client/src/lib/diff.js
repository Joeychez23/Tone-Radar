// Word-level diff (LCS) used to show what a rewrite changed.
const tokenize = (s) => s.match(/\[[a-z]+\]|[\w'’-]+|[^\s\w]/g) || [];
const key = (t) => t.toLowerCase();

export function diffWords(a, b) {
  const x = tokenize(a);
  const y = tokenize(b);
  const n = x.length;
  const m = y.length;
  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = key(x[i]) === key(y[j]) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out = [];
  const push = (type, text) => {
    const last = out[out.length - 1];
    if (last && last.type === type) last.tokens.push(text);
    else out.push({ type, tokens: [text] });
  };
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (key(x[i]) === key(y[j])) {
      push("same", y[j]);
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      push("del", x[i++]);
    } else {
      push("add", y[j++]);
    }
  }
  while (i < n) push("del", x[i++]);
  while (j < m) push("add", y[j++]);
  // `space` says whether a space separates this part from the previous one.
  return out.map((p, i) => ({ type: p.type, text: joinTokens(p.tokens), space: i > 0 && !PUNCT.test(p.tokens[0]) }));
}

const PUNCT = /^[,.;:!?)]$/;

// Joins tokens with spaces, except before punctuation.
export function joinTokens(tokens) {
  return tokens.reduce((acc, t, i) => (i === 0 ? t : PUNCT.test(t) ? acc + t : `${acc} ${t}`), "");
}
