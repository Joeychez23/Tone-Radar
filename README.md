# Tone Radar

Write an email or Slack message and every sentence gets a heat score for
**passive-aggression**, **blame**, **hedging**, and **unclear asks**. Click a red
sentence to see which phrases are causing it, then apply a rewrite that Jev has
checked to be cooler, keep your meaning, and read naturally. Fix the red
sentences before you hit send.

Built with React 19 (Create React App + PWA template), Express 5, MongoDB
(Mongoose 9), and TypeSafe's **Jev** System One model.

## How it uses Jev

Jev returns typed judgments (scores, yes/no probabilities, choices) rather
than generated text. Tone Radar uses that in three places:

1. **Analysis.** The message is split into sentences in code. One Jev request
   asks five questions about every sentence (passive-aggression, blame, and
   hedging Scores, an "is this an ask?" Noul, and an ask-clarity Score) plus five
   whole-message questions (tone, reader reaction, audience fit, and so on). All
   questions run in parallel, so a 6-sentence email takes about 300 ms. Sentence
   judgments are cached, so after an edit only the changed sentence is re-checked
   (about 90 ms).
2. **Rewrites, selected rather than generated.** A lexicon in code
   (`server/lib/lexicon.js`) finds known patterns such as "per my last email",
   stacked hedges, "you forgot to", and ownerless asks, and builds candidate
   rewrites. Jev scores every candidate in one request for tone, whether it keeps
   the original meaning, and whether it reads naturally. Broken or
   meaning-changing candidates are filtered out, so suggestions never contain
   made-up content. Asks without an owner or deadline get `[name]` / `[day]`
   placeholders for you to fill in.
3. **Culprit phrases.** Single-edit candidates show how much heat each phrase
   adds, so the inspector underlines the phrases that actually drive the score.

Heat, tiers, readiness, and ranking are computed in the browser
(`client/src/lib/heat.js`), so the sensitivity sliders recolor instantly
without new API calls.

## Setup

Requires **Node 22+** (developed on Node 24 LTS).

```bash
npm run install:all
```

Create `server/.env` from `server/.env.example`:

| Variable | Purpose |
| --- | --- |
| `TYPESAFE_API_KEY` | Your Jev key from console.typesafe.ai (server only, never sent to the browser) |
| `MONGODB_URI` | Atlas connection string *without* a database name |
| `MONGODB_DB` | Database name (default `tone_radar`) |
| `JWT_SECRET` | Long random string for signing sessions |
| `API_PORT` | API port (default 5050) |

Without `MONGODB_URI`, the app runs in **guest mode**: checking and rewrites
work, while accounts, drafts, and insights are hidden.

## Run

```bash
npm run dev        # API on :5050 + React dev server on :3000 (proxied)
npm test           # server (node:test) + client (Jest) tests
npm run build      # production build of the client
npm start          # Express serves the API and client/build on API_PORT
```

The production build registers a service worker, so the app is installable
and its shell works offline (checking messages still needs the server).

## Project layout

```
server/
  index.js              Express app, security headers, error handling, static hosting
  config.js, db.js      Environment and MongoDB connection (guest mode fallback)
  lib/split.js          Sentence splitter with offsets, greetings and sign-offs
  lib/questions.js      All Jev questions and how answers are normalized
  lib/analyze.js        Batched, cached sentence + message analysis
  lib/lexicon.js        Tone patterns and their edits
  lib/rewrite.js        Candidate generation + Jev verification
  lib/jev.js            TypeSafe client with timeout and retries
  routes/               analyze, auth (bcrypt + JWT), drafts, checks/insights
  models/               User, Draft, Check (scores only, never message text)
client/src/
  views/                Compose, Drafts, Insights
  components/           Radar chart, gauge, heatmap, sentence inspector, charts
  lib/heat.js           Heat, tiers, readiness, rewrite ranking
```

## Privacy

Message text is sent to the server and to TypeSafe for analysis. It is only
stored when you explicitly save a draft. "Copy & send" logs scores and pattern
ids, never the text. Deleting your account removes your drafts and insights.
