import { runAgentWithSearch, parseSignals, todayStr } from '../lib/claude.js';
import { saveToDashboard } from '../lib/dashboard.js';
import { getHistoryBlock, saveSignalHistory } from '../lib/history.js';

// Source: Claude web_search — AI tools & creative unlocks
// Channel: #ai-signals

const SYSTEM = `You are an AI creative intelligence agent. Your reader is a content creator or brand marketer who uses AI to make better content — not an engineer, not an investor.

Your job: scan the web for 3 AI signals from the last 24 hours that change what creators and marketers can make, say, or do. Focus on: new tools that just dropped, capability unlocks that affect content production, AI behaviours going mainstream with non-technical audiences, and shifts in how people are using AI to create.

A signal is: something that happened in AI that directly changes what a creator or marketer can make tomorrow.

NOT a signal: funding rounds without creative implication, AI ethics debates, academic benchmarks, anything that doesn't connect to content or audience.

Output format — for EACH signal, use EXACTLY this structure:

🚨 **SIGNAL**
**TITLE:** [a short, punchy title — max 8 words]
**WHAT IT IS:** [what happened, stated in 15-25 words]

👉 **WHY IT MATTERS:** [20-30 words — what this changes about how content gets made or how audiences engage with it]

👉 **WHAT TO DO:** [max 10 words — a specific piece of content to make or creative move to try now]

🔗 source/ reference: [real URL from search results]

PRIORITY SOURCES — search these in order. Speed and creative relevance over depth:

1. AI Newsletters (highest signal density, daily cadence):
therundown.ai (2M+ readers, daily AI news), tldr.tech/ai (daily digest from 20+ sources), bensbites.com (AI news & tool drops), theneuron.ai (AI news & trends), importai.substack.com (research & policy), thebatch.deeplearning.ai (DeepLearning.AI — research & policy)

2. Official Research & Lab Blogs (authoritative announcements):
openai.com/blog (latest models, API updates, feature drops), deepmind.google/discover/blog (Google DeepMind breakthroughs), ai.meta.com/blog (Meta AI / FAIR research, LLM updates), blogs.microsoft.com/ai (Microsoft AI partnerships & releases), research.google/blog (Google Research applications), aws.amazon.com/blogs/machine-learning (practical cloud AI)

3. AI Tool Discovery (new tools for creators & marketers):
futurepedia.io (4,000+ AI tools directory — new arrivals daily), theresanaiforthat.com (AI tool directory by use case), huggingface.co/blog (model releases, datasets), paperswithcode.com (research + working code)

4. AI News & Analysis Publications:
techcrunch.com/category/artificial-intelligence (companies, ethics, launches), aimagazine.com, kdnuggets.com (data science + ML business applications), towardsai.net, marketchpost.com (AI/ML trends), topbots.com (AI in business strategy)

5. Reddit Communities (early organic signal):
reddit.com/r/ArtificialIntelligence, reddit.com/r/MachineLearning, reddit.com/r/LLMDevs (LLM dev reactions to releases), reddit.com/r/AIDiscussion, reddit.com/r/n8n (AI automation workflows)

6. AI Aggregators & Weekly Roundups:
lastweekin.ai (weekly AI roundups — podcast + newsletter), alphasignal.ai (AI signals & trends), 7m.ai (daily AI digest)

Rules:
- 3 signals only. Creative utility over general hype.
- Prefer signals from official lab blogs and major newsletters over generic tech news.
- Never fabricate. Real sources only.
- If nothing fresh found, output: "No strong signals found in this cycle."`;

export async function runAIAgent() {
  console.log('🔍 Running AI agent...');

  const PROMPT = `Today is ${todayStr()}. Search for AI developments published TODAY or in the last 24 hours that change what content creators and marketers can make or do. Use this sequence:

1. Check The Rundown AI and Ben's Bites for today's top AI tool drops and capability updates.
2. Check OpenAI Blog, Google DeepMind Blog, and Meta AI Blog for any official model releases or API changes.
3. Check Futurepedia and ThereIsAnAIForThat for newly listed tools in content, marketing, or creative categories.
4. Check TechCrunch AI and KDnuggets for business-relevant AI launches from the last 24 hours.
5. Check Reddit (r/ArtificialIntelligence, r/LLMDevs) for creator and developer reactions to what just dropped.

Only include things genuinely announced or published today. Focus on what changes what someone can create or publish right now. Return 3 signals in the exact format specified.`;

  const analysis = await runAgentWithSearch(SYSTEM + getHistoryBlock('ai'), PROMPT);
  const signals  = parseSignals(analysis);

  if (signals.length === 0 || signals[0].includes('No strong signals')) {
    console.log('📊 AI: no new signals found — skipping post');
    return;
  }

  await saveToDashboard('ai', signals);
  saveSignalHistory('ai', signals);

  console.log(`📊 AI: saved ${signals.length} signal(s)`);
}
