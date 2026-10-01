// Known tone patterns and the edits that defuse them. Code proposes the
// edits; Jev decides which resulting sentences keep the meaning, read
// naturally, and actually sound better. A replacement can be a string (with
// $1-style groups) or a function receiving the regex match.
//
// dim: pa (passive-aggression), blame, hedge, ask (unclear asks)

const E_VERBS = new Set([
  "take", "make", "share", "write", "schedule", "update", "create", "have", "give", "move", "use",
  "close", "merge", "approve", "provide", "prepare", "complete", "resolve", "change", "include",
  "finalize", "organize", "prioritize", "come", "leave", "save", "issue", "release", "rebase",
  "upgrade", "configure", "remove", "replace", "continue", "type", "note", "debate", "escalate",
  "invite", "decline", "receive", "file", "double-check", "re-share", "estimate", "scope", "deprecate",
]);

const IRREGULAR = {
  sent: "send", done: "do", did: "do", told: "tell", made: "make", written: "write", wrote: "write",
  given: "give", gave: "give", taken: "take", took: "take", got: "get", gotten: "get", seen: "see",
  saw: "see", read: "read", built: "build", run: "run", ran: "run", shared: "share", paid: "pay",
  said: "say", found: "find", left: "leave", brought: "bring", thought: "think", bought: "buy",
  heard: "hear", kept: "keep", let: "let", set: "set", put: "put", spent: "spend", understood: "understand",
};

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// "sending" -> "send", "taking" -> "take", "updated" -> "update", "sent" -> "send"
function baseVerb(word) {
  const w = word.toLowerCase();
  if (IRREGULAR[w]) return IRREGULAR[w];
  for (const suffix of ["ing", "ed"]) {
    if (w.endsWith(suffix) && w.length > suffix.length + 2) {
      let stem = w.slice(0, -suffix.length);
      if (/([bdgklmnprt])\1$/.test(stem) && !/(ll|ss)$/.test(stem)) stem = stem.slice(0, -1);
      if (suffix === "ed" && stem.endsWith("i")) return stem.slice(0, -1) + "y";
      if (E_VERBS.has(stem + "e")) return stem + "e";
      return stem;
    }
  }
  return w;
}

const ACRONYMS = new Set(["ASAP", "HTTP", "HTTPS", "JSON", "HTML", "YAML", "TODO", "FIXME", "NOTE", "UTC", "GMT", "AWS", "GCP", "SDK", "CRUD", "REST", "SOC2", "GDPR", "HIPAA", "KPIS", "OKRS", "EMEA", "APAC", "NASA", "UTF8", "CEO", "CTO", "CFO", "COO", "UX", "UI", "PDF", "CSV", "SQL", "URL", "README", "LGTM", "WIP", "IMHO", "FYI", "EOD", "EOW", "COB", "ETA", "MVP", "QA", "PR"]);

const ENTRIES = [
  // ---------- hedging ----------
  { id: "hedge.wondering", dim: "hedge", label: "Roundabout ask", pattern: /\bI(?: was|'m| am) (?:just )?wondering if you (?:could|might|would be able to|can)\b/i, replace: ["Could you"] },
  { id: "hedge.wanted_chance", dim: "hedge", label: "Roundabout check-in", pattern: /\bI (?:just )?wanted to (?:\w+ )?(?:check|ask|see|confirm) (?:if|whether) you (?:had|have|got|get) (?:a )?(?:chance|moment|time) to\b/i, replace: ["Did you get a chance to", "Could you"] },
  { id: "hedge.wanted_could", dim: "hedge", label: "Roundabout ask", pattern: /\bI (?:just )?wanted to (?:\w+ )?(?:check|ask|see) (?:if|whether) you (?:could|can|would be able to)\b/i, replace: ["Could you"] },
  { id: "hedge.wanted_follow", dim: "hedge", label: "Throat-clearing opener", pattern: /\bI (?:just )?wanted to (?:check in|follow up|reach out|touch base|circle back) (?:on|about|regarding)\b/i, replace: ["Following up on"] },
  { id: "hedge.mind", dim: "hedge", label: "Roundabout ask", pattern: /\b(?:would|do) you mind (\w+ing)\b/i, replace: [(m) => `could you ${baseVerb(m[1])}`] },
  { id: "hedge.ithink", dim: "hedge", label: "Self-undermining opener", pattern: /\bI (?:just )?(?:think|feel like|feel|guess|believe|suppose)(?: that)?,?\s+/i, replace: [""] },
  { id: "hedge.sorrybother", dim: "hedge", label: "Unneeded apology", pattern: /\b(?:so |really )?sorry to (?:bother|bug|pester|trouble) you(?: again)?\b[,.!]?\s*/i, replace: [""] },
  { id: "hedge.sorrydelay", dim: "hedge", label: "Apology that could be thanks", pattern: /\b(?:so |really )?sorry (?:for|about) the (?:late|delayed|slow) (?:reply|response)\b/i, replace: ["Thanks for your patience"] },
  { id: "hedge.sorrybut", dim: "hedge", label: "Unneeded apology", pattern: /\bsorry,? but\s*/i, replace: [""] },
  { id: "hedge.couldbewrong", dim: "hedge", label: "Pre-emptive retreat", pattern: /\bI (?:could|might|may) be wrong,? but\s*/i, replace: [""] },
  { id: "hedge.ifok", dim: "hedge", label: "Permission-seeking", pattern: /,?\s*\bif (?:that's|that is|it's|it is) (?:ok|okay|alright|all right|possible|not too much trouble|not a problem)\b/i, replace: [""] },
  { id: "hedge.ifchance", dim: "hedge", label: "Permission-seeking", pattern: /,?\s*\bif you (?:get a chance|have a (?:moment|minute|sec|second)|have time|don't mind|get a minute)\b/i, replace: [""] },
  { id: "hedge.noworries", dim: "hedge", label: "Pre-emptive retreat", pattern: /[,.;]?\s*\b(?:but )?(?:no worries|no pressure|no rush|totally fine|all good) if not\b[.!]?/i, replace: [""] },
  { id: "hedge.makesense", dim: "hedge", label: "Self-doubting closer", pattern: /[,.;]?\s*\b(?:does that make sense|if that makes sense|hope that makes sense|not sure if that makes sense)\b\??/i, replace: [""] },
  { id: "hedge.quickq", dim: "hedge", label: "Minimizing", pattern: /\b(?:quick|small|dumb|stupid|silly|random) question[:,.!-]?\s*/i, replace: [""] },
  { id: "hedge.just", dim: "hedge", label: "Minimizer \"just\"", pattern: /\bjust\s+(?=\w)/i, replace: [""] },
  { id: "hedge.maybe", dim: "hedge", label: "Qualifier", pattern: /\b(?:maybe|perhaps|possibly)\b,?\s*/i, replace: [""] },
  { id: "hedge.sortof", dim: "hedge", label: "Qualifier", pattern: /\b(?:sort of|kind of|kinda|sorta)\s+/i, replace: [""] },
  { id: "hedge.abit", dim: "hedge", label: "Qualifier", pattern: /\ba (?:little )?bit\s+(?=(?:late|behind|concerned|worried|confused|unclear|off|early|longer|more|less|over)\b)/i, replace: [""] },
  { id: "hedge.qualifier", dim: "hedge", label: "Qualifier", pattern: /\b(?:somewhat|fairly|relatively|slightly)\s+(?=\w)/i, replace: [""] },
  { id: "hedge.hopefully", dim: "hedge", label: "Qualifier", pattern: /\bhopefully\b,?\s*/i, replace: [""] },
  { id: "hedge.actually", dim: "hedge", label: "Filler", pattern: /\bactually,?\s+/i, replace: [""] },

  // ---------- passive-aggression ----------
  { id: "pa.perlast", dim: "pa", label: "\"Per my last email\"", pattern: /\b(?:as )?per my (?:last|previous|earlier|below|prior) (?:email|e-mail|message|note|comment|reply)\b,?\s*/i, replace: ["", "Following up on my last email: "] },
  { id: "pa.asmentioned", dim: "pa", label: "\"As I already said\"", pattern: /,?\s*\bas (?:I |we )?(?:have )?(?:previously |already |clearly |explicitly )?(?:mentioned|stated|said|noted|explained|discussed|communicated|requested|pointed out)(?: (?:before|earlier|previously|above|below|multiple times|several times))?\b,?\s*/i, replace: [""] },
  { id: "pa.asdiscussed", dim: "pa", label: "Pointed callback", pattern: /\b(?:as discussed|(?:as )?per our (?:conversation|discussion|call|chat))\b,?\s*/i, replace: ["", "Following our conversation, "] },
  { id: "pa.reminder", dim: "pa", label: "\"Friendly reminder\"", pattern: /\b(?:just )?(?:a )?(?:friendly|gentle|quick|kind|polite) reminder(?: that)?\b[:,]?\s*/i, replace: ["", "Reminder: "] },
  { id: "pa.notsureifsaw", dim: "pa", label: "\"Not sure if you saw\"", pattern: /\b(?:not sure if|in case) you (?:saw|got|missed|forgot)(?: (?:this|it|my (?:last |previous )?(?:email|message|note)))?\b[,.]?\s*/i, replace: [""] },
  { id: "pa.busy", dim: "pa", label: "Backhanded excuse", pattern: /\bI(?:'m| am) sure you(?:'re| are) (?:very |super |really )?busy,? but\s*/i, replace: [""] },
  { id: "pa.respect", dim: "pa", label: "\"With all due respect\"", pattern: /\bwith (?:all )?due respect,?\s*/i, replace: [""] },
  { id: "pa.obviously", dim: "pa", label: "Condescending aside", pattern: /\b(?:obviously|clearly|of course|needless to say|as you (?:should |may |might )?know|as you(?:'re| are) (?:well )?aware)\b,?\s*/i, replace: [""] },
  { id: "pa.mistaken", dim: "pa", label: "Sarcastic hedge", pattern: /\bunless I(?:'m| am) (?:mistaken|missing something),?\s*/i, replace: [""] },
  { id: "pa.ifyouhad", dim: "pa", label: "\"If you had read…\"", pattern: /\bif you (?:had|would have|'d) (?:actually )?(?:read|checked|looked at|opened)\b[^,.]*,\s*/i, replace: [""] },
  { id: "pa.finally", dim: "pa", label: "\"Finally\"", pattern: /\bfinally\s+/i, replace: [""] },
  { id: "pa.again", dim: "pa", label: "\"Again\"", pattern: /,?\s*\b(?:once )?again\b/i, replace: [""] },
  { id: "pa.already", dim: "pa", label: "\"Already\"", pattern: /\balready\s+/i, replace: [""] },
  { id: "pa.still", dim: "pa", label: "\"Still\"", pattern: /\bstill\s+/i, replace: [""] },
  { id: "pa.yet", dim: "pa", label: "Impatient \"yet\"", pattern: /,?\s+yet(?=[.!?]*$)/i, replace: [""] },
  { id: "pa.goingforward", dim: "pa", label: "Scolding \"going forward\"", pattern: /,?\s*\b(?:going forward|moving forward|in (?:the )?future|next time)\b,?\s*/i, replace: [""] },
  { id: "pa.tia", dim: "pa", label: "\"Thanks in advance\"", pattern: /\bthanks in advance\b/i, replace: ["Thanks", "Thank you"] },
  { id: "pa.kindly", dim: "pa", label: "\"Kindly\"", pattern: /\bkindly\b/i, replace: ["please"] },
  { id: "pa.advise", dim: "pa", label: "\"Please advise\"", pattern: /\bplease advise\b/i, replace: ["let me know what you think", "what do you recommend?"] },
  { id: "pa.noted", dim: "pa", label: "Curt \"Noted\"", pattern: /^noted[.!]*$/i, replace: ["Got it, thanks."] },
  { id: "pa.circling", dim: "pa", label: "Nudge phrasing", pattern: /\b(?:circling back|bumping this(?: up)?|bump)\b/i, replace: ["following up"] },
  { id: "pa.sigh", dim: "pa", label: "Exasperated interjection", pattern: /\b(?:sigh|ugh|smh|welp|wow)\b[.,!]*\s*/i, replace: [""] },
  { id: "pa.punct", dim: "pa", label: "Stacked punctuation", pattern: /(?:\?!|!\?|[!?]{2,})/, replace: [(m) => (m[0].includes("?") ? "?" : "!")] },
  { id: "pa.caps", dim: "pa", label: "Shouting in caps", pattern: /\b[A-Z]{4,}\b/, filter: (m) => !ACRONYMS.has(m[0]), replace: [(m) => m[0].toLowerCase()] },

  // ---------- blame ----------
  { id: "blame.droppedball", dim: "blame", label: "\"Dropped the ball\"", pattern: /\b(?:you|your team|they|their team|he|she|[A-Z][a-z]+(?:'s team)?)\s+(?:really\s+)?dropped the ball on ([^,;.!?]+?)(?:,?\s*(?:once\s+)?again)?(?=\s*(?:[,;.!?]|$)|\s+(?:so|and|but|which)\b)/i, replace: [(m) => `${m[1]} slipped`, (m) => `we need to get ${m[1]} back on track`] },
  { id: "blame.forgot", dim: "blame", label: "\"You forgot to\"", pattern: /\byou (?:forgot|failed|neglected|didn't bother|did not bother) to\b/i, replace: ["we still need to", "it looks like we still need to"] },
  { id: "blame.shouldhave", dim: "blame", label: "\"You should have\"", pattern: /\byou (?:should|could|would) have (\w+)/i, replace: [(m) => `next time, let's ${baseVerb(m[1])}`] },
  { id: "blame.whydidnt", dim: "blame", label: "\"Why didn't you…?\"", pattern: /^why (?:didn't|did not|haven't|have not|hasn't|wasn't|weren't|isn't|aren't) (?:you|your team|they|the team) (\w+)/i, replace: [(m) => `Could you ${baseVerb(m[1])}`] },
  { id: "blame.youdidnt", dim: "blame", label: "Accusatory \"you didn't\"", pattern: /\byou (didn't|did not|haven't|have not|never|weren't|wasn't)\b/i, replace: [(m) => `we ${m[1].toLowerCase() === "never" ? "haven't" : m[1]}`] },
  { id: "blame.yourteam", dim: "blame", label: "\"Your team\"", pattern: /\b(?:your|their) (team|group|department|side|people|code|change|PR)\b/i, replace: ["the $1"] },
  { id: "blame.becauseof", dim: "blame", label: "Pointing fingers", pattern: /,?\s*\b(?:because of|thanks to|due to) (?:you|your (?:team|mistake|error|delay|change)|them|their (?:mistake|error|delay|change))\b/i, replace: [""] },
  { id: "blame.yourfault", dim: "blame", label: "\"Your mistake\"", pattern: /\byour (mistake|fault|error|oversight|screw-?up|bug)\b/i, replace: ["the $1"] },
  { id: "blame.unacceptable", dim: "blame", label: "Scolding verdict", pattern: /\b(?:this|that|it) is (?:completely |totally |simply )?(?:unacceptable|ridiculous|absurd|a joke|not okay|not ok)\b/i, replace: ["this is a problem", "this needs to be fixed"] },
  { id: "blame.asusual", dim: "blame", label: "Generalizing", pattern: /,?\s*\b(?:as usual|as always|yet again|for the (?:hundredth|third|fourth|nth|umpteenth|last) time)\b/i, replace: [""] },
  { id: "blame.always", dim: "blame", label: "Generalizing", pattern: /\b(?:always|constantly)\s+(?=\w)/i, replace: [""] },

  // ---------- unclear asks ----------
  { id: "ask.someone", dim: "ask", label: "No owner", pattern: /\b(?:can|could|would|will) (?:someone|somebody|anyone|anybody|one of you|somebody please|someone please)\b/i, replace: ["[name], could you", "could you"] },
  { id: "ask.someoneshould", dim: "ask", label: "No owner", pattern: /\b(?:someone|somebody) (?:should|needs to|must|has to)\b/i, replace: ["[name], could you"] },
  { id: "ask.asap", dim: "ask", label: "Vague timing", pattern: /\b(?:asap|as soon as possible|at your earliest convenience|when you (?:get|have) a (?:chance|minute|moment|sec)|whenever you (?:can|get a chance)|when you can|soon-?ish)\b/i, replace: ["by [day]"] },
  { id: "ask.vagueobject", dim: "ask", label: "Vague \"this\"", pattern: /\b(look into|take a look at|look at|check on|deal with|handle|sort out|fix|review) (this|that|it)\b(?=\s*[.!?]*$)/i, replace: ["$1 [what]"] },
  { id: "ask.thoughts", dim: "ask", label: "Open-ended ask", pattern: /^(?:any )?(?:thoughts|ideas|feedback|lmk|let me know)\??[.!]*$/i, replace: ["Could you share your thoughts on [topic] by [day]?"] },
];

const TIME_EXPRESSION = /\b(?:today|tonight|tomorrow|tmrw|eod|eow|cob|monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tues?|wed|thu|thurs|fri|this (?:week|morning|afternoon|evening|sprint)|next (?:week|month|sprint)|by (?:the )?\w+|before \w+|until|deadline|end of (?:day|week|month|sprint)|noon|midnight|asap|\d{1,2}(?::\d{2})?\s?(?:am|pm)|\d{1,2}\/\d{1,2}|[ap]\.m\.)\b/i;

const REQUEST_SHAPE = /^(?:please|could|can|would|will|let me know|send|share|update|review|confirm|make sure|\[name\])\b|\?\s*$/i;

module.exports = { ENTRIES, TIME_EXPRESSION, REQUEST_SHAPE, baseVerb, cap };
