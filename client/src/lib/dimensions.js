// The four tone dimensions Tone Radar measures for every sentence.

export const DIMENSIONS = [
  {
    id: "pa",
    label: "Passive-aggression",
    short: "Passive-aggr.",
    axis: "Passive-\naggression",
    question: "Is there a hidden jab?",
    levels: [
      "Sincere and direct",
      "Slightly pointed",
      "Polite surface, implied criticism",
      "Sarcastic or thinly veiled hostility",
    ],
    tip: "Say the thing directly, or drop it. Phrases like \"per my last email\" or \"finally\" read as scolding even when you mean them neutrally.",
  },
  {
    id: "blame",
    label: "Blame",
    short: "Blame",
    axis: "Blame",
    question: "Does it point fingers?",
    levels: [
      "No blame",
      "Names who was involved, factually",
      "Implies someone failed",
      "Directly accuses or scolds",
    ],
    tip: "Describe the problem and the next step instead of who caused it. \"We still need to…\" gets the same result as \"You forgot to…\" without the defensiveness.",
  },
  {
    id: "hedge",
    label: "Hedging",
    short: "Hedging",
    axis: "Hedging",
    question: "Is the point buried in qualifiers?",
    levels: [
      "Direct and confident",
      "Normal politeness",
      "Qualifiers weaken the point",
      "So hedged the point gets lost",
    ],
    tip: "One softener is polite; three is apologizing for existing. Cut \"just\", \"maybe\", \"sort of\", and \"if that's okay\" and let the request stand.",
  },
  {
    id: "ask",
    label: "Unclear ask",
    short: "Unclear ask",
    axis: "Unclear\nasks",
    question: "If it asks for something, is it clear what, who, and when?",
    levels: ["Specific ask", "Who or when only implied", "Missing who or when", "Reader can't tell what's wanted"],
    tip: "A clear ask names what you need, who should do it, and by when. Fill in the [name] and [day] placeholders in the suggestions.",
  },
];

export const DIM_IDS = DIMENSIONS.map((d) => d.id);
export const DIM_BY_ID = Object.fromEntries(DIMENSIONS.map((d) => [d.id, d]));

export const CLARITY_LEVELS = [
  "Vague: unclear what is wanted",
  "Clear what, but not who or when",
  "Who or when only implied",
  "Specific: what, who, and when",
];

export const AUDIENCES = [
  { id: "manager", label: "My manager" },
  { id: "peer", label: "A peer" },
  { id: "report", label: "My direct report" },
  { id: "team", label: "My team" },
  { id: "executive", label: "An executive" },
  { id: "customer", label: "A customer" },
  { id: "vendor", label: "A vendor or partner" },
  { id: "friend", label: "A close teammate" },
];

export const CHANNELS = [
  { id: "email", label: "Email" },
  { id: "chat", label: "Slack" },
  { id: "text", label: "Text" },
  { id: "review", label: "Review" },
];

export const TONES = {
  warm: { label: "Warm", detail: "Friendly, appreciative, or encouraging" },
  neutral: { label: "Neutral", detail: "Matter-of-fact and professional" },
  curt: { label: "Curt", detail: "Short in a way that could feel cold" },
  frustrated: { label: "Frustrated", detail: "Shows annoyance or impatience" },
  hostile: { label: "Hostile", detail: "Openly angry, accusatory, or sarcastic" },
};

export const REACTIONS = ["Appreciated", "Neutral", "Mildly annoyed", "Defensive or hurt"];
