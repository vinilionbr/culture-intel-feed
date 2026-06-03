# Cultural Intelligence Feed

## Project purpose
Automated AI agent system that scrapes social platforms daily, synthesises signals with Claude, and posts one signal at a time to designated Slack channels.

## Architecture
- **Social agent** → Apify (TikTok + Instagram + Threads) → Claude → #socials-signals
- **Culture agent** → Apify (Reddit: culture/entertainment/music/streetwear) → Claude → #culture-signals
- **AI agent** → Claude web_search → #ai-signals
- **Web3 agent** → Claude web_search → #web3-signals

## Signal format (per post)
```
📡 SIGNAL

WHAT: [10-20 words]
WHY IT MATTERS: [20-30 words]
WHAT TO DO: [max 10 words]

🔗 Source: [URL]
```
Each signal is posted as a separate Slack message. 3-5 signals per channel per day.

## Environment variables needed
- ANTHROPIC_API_KEY
- APIFY_API_KEY
- SLACK_WEBHOOK_SOCIAL
- SLACK_WEBHOOK_CULTURE
- SLACK_WEBHOOK_AI
- SLACK_WEBHOOK_WEB3

## Running
- `node index.js` — scheduled mode (7am daily AEST, runs immediately on start)
- `node index.js --now` — run all agents immediately
- `node index.js --channel social` — run single agent (social | culture | ai | web3)

## Key rules
- Never hallucinate signals. Only post real, evidenced findings.
- Signal format is STRICT — WHAT / WHY IT MATTERS / WHAT TO DO.
- 3-5 signals per channel, never more.
- Tone: sharp, direct, zero fluff. Senior marketer audience.
