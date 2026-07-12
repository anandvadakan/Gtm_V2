require("dotenv").config();
const express = require("express");
const cors = require("cors");
const Groq = require("groq-sdk");
const { ApifyClient } = require("apify-client");

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const apify = new ApifyClient({ token: process.env.APIFY_API_KEY });

// Step 1: AI expands keywords before scraping
async function expandKeywords(brand, category, competitor) {
  const prompt = `You are a social media research expert. Generate search queries for scraping Reddit, Twitter, and Google News.

Brand: "${brand}"
Category: "${category}"
${competitor ? `Competitor: "${competitor}"` : ""}

Return JSON only:
{
  "brandQueries": ["query1", "query2", ...], // 6 queries humans would type about this brand
  "categoryQueries": ["query1", "query2", ...], // 6 queries about the category generally
  "competitorQueries": ["query1", ...], // 4 queries about competitor (empty array if none)
  "redditSubreddits": ["subreddit1", ...] // 8 likely subreddits where this category is discussed
}

Make queries natural, varied - include slang, abbreviations, common complaints, comparisons people actually type.`;

  const res = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    max_tokens: 800,
    messages: [{ role: "user", content: prompt }],
  });
  const raw = res.choices[0].message.content.trim().replace(/```json|```/g, "").trim();
  return JSON.parse(raw);
}

// Scrape Reddit posts + comments
async function scrapeReddit(queries, subreddits) {
  try {
    const searches = [
      ...queries.slice(0, 4),
      ...subreddits.slice(0, 4).map(s => `subreddit:${s}`)
    ];
    const run = await apify.actor("trudax/reddit-scraper-lite").call({
      searches,
      maxItems: 60,
      type: "posts",
    },{ waitSecs: 60 });
    const { items } = await apify.dataset(run.defaultDatasetId).listItems();
    return items.map(i => ({
      title: i.title || "",
      body: i.body || i.selftext || "",
      subreddit: i.subreddit || "",
      score: i.score || 0,
      comments: i.numberOfComments || 0,
      url: i.url || "",
      type: "reddit",
    })).filter(i => i.title.length > 5);
  } catch (e) {
    console.error("Reddit failed:", e.message);
    return [];
  }
}

// Scrape Twitter/X
async function scrapeTwitter(queries) {
  try {
    const run = await apify.actor("apidojo/tweet-scraper").call({
      searchTerms: queries.slice(0, 3),
      maxTweets: 20,
      queryType: "Latest",
    }{ waitSecs: 60 });
    const { items } = await apify.dataset(run.defaultDatasetId).listItems();
    return items.map(i => ({
      text: i.text || i.fullText || "",
      likes: i.likeCount || 0,
      retweets: i.retweetCount || 0,
      author: i.author?.userName || "",
      type: "twitter",
    })).filter(i => i.text.length > 10);
  } catch (e) {
    console.error("Twitter failed:", e.message);
    return [];
  }
}

// Scrape Google News
async function scrapeNews(query) {
  try {
    const run = await apify.actor("apify/google-news-scraper").call({
      query,
      maxItems: 20,
    }{ waitSecs: 60 });
    const { items } = await apify.dataset(run.defaultDatasetId).listItems();
    return items.map(i => ({
      title: i.title || "",
      description: i.description || "",
      source: i.source || "",
      date: i.publishedAt || "",
      type: "news",
    })).filter(i => i.title.length > 5);
  } catch (e) {
    console.error("News failed:", e.message);
    return [];
  }
}

// Median helper
function median(arr) {
  if (!arr.length) return 50;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid];
}

// Main analyze endpoint
app.post("/api/analyze", async (req, res) => {
  const { brand, category, competitor, isLaunch } = req.body;
  if (!brand || !category) return res.status(400).json({ error: "Brand and category required" });

  try {
    // Step 1: Expand keywords with AI
    console.log("Expanding keywords...");
    const keywords = await expandKeywords(brand, category, competitor);

    // Step 2: Scrape all sources in parallel
    console.log("Scraping sources...");
    const [brandReddit, twitterData, newsData, competitorReddit] = await Promise.all([
      scrapeReddit(keywords.brandQueries, keywords.redditSubreddits),
      scrapeTwitter(keywords.brandQueries),
      scrapeNews(`${brand} ${category}`),
      competitor ? scrapeReddit(keywords.competitorQueries, keywords.redditSubreddits) : Promise.resolve([]),
    ]);

    // Step 3: Build context
    const redditContext = brandReddit.slice(0, 25).map(r =>
      `[r/${r.subreddit} | score:${r.score}] ${r.title}: ${r.body.slice(0, 200)}`
    ).join("\n");

    const twitterContext = twitterData.slice(0, 20).map(t =>
      `[@${t.author} | likes:${t.likes}] ${t.text.slice(0, 200)}`
    ).join("\n");

    const newsContext = newsData.slice(0, 10).map(n =>
      `[${n.source}] ${n.title}: ${n.description}`
    ).join("\n");

    const competitorContext = competitorReddit.slice(0, 15).map(r =>
      `[r/${r.subreddit}] ${r.title}: ${r.body.slice(0, 150)}`
    ).join("\n");

    // Subreddit frequency map
    const subredditCounts = {};
    brandReddit.forEach(r => {
      if (r.subreddit) subredditCounts[r.subreddit] = (subredditCounts[r.subreddit] || 0) + 1;
    });
    const topSubreddits = Object.entries(subredditCounts)
      .sort((a, b) => b[1] - a[1]).slice(0, 8)
      .map(([name, count]) => ({ name, count }));

    // Sentiment scores array for median
    const redditScores = brandReddit.map(r => {
      const text = (r.title + " " + r.body).toLowerCase();
      const pos = (text.match(/good|great|love|excellent|amazing|best|recommend|perfect|happy|satisfied/g) || []).length;
      const neg = (text.match(/bad|worst|terrible|hate|awful|disappoint|broken|waste|refund|issue|problem/g) || []).length;
      if (pos + neg === 0) return 50;
      return Math.round((pos / (pos + neg)) * 100);
    });

    const twitterScores = twitterData.map(t => {
      const text = t.text.toLowerCase();
      const pos = (text.match(/good|great|love|amazing|best|recommend|happy|satisfied|excellent/g) || []).length;
      const neg = (text.match(/bad|worst|hate|awful|disappoint|broken|waste|issue|problem|scam/g) || []).length;
      if (pos + neg === 0) return 50;
      return Math.round((pos / (pos + neg)) * 100);
    });

    const allScores = [...redditScores, ...twitterScores];
    const medianScore = median(allScores);

    // Step 4: Groq analysis
    const prompt = `You are a senior GTM Strategy Analyst with deep expertise in Indian and global markets.

Analyze this social listening data for "${brand}" (${category})${competitor ? ` vs "${competitor}"` : ""}.
${isLaunch ? `\nIMPORTANT: The user is planning to LAUNCH A NEW PRODUCT in this category. Include detailed launch intelligence.` : ""}

REDDIT DATA (${brandReddit.length} posts):
${redditContext || "No data"}

TWITTER DATA (${twitterData.length} tweets):
${twitterContext || "No data"}

NEWS DATA (${newsData.length} articles):
${newsContext || "No data"}

${competitor ? `COMPETITOR DATA (${competitorReddit.length} posts):\n${competitorContext || "No data"}` : ""}

CALCULATED MEDIAN SENTIMENT SCORE: ${medianScore}/100

Return ONLY valid JSON:
{
  "executiveSummary": "3 sentence sharp summary of brand position, sentiment, and key insight",
  "overallSentiment": {
    "score": ${medianScore},
    "label": "Positive/Neutral/Negative",
    "reasoning": "why this score based on data"
  },
  "audienceInsights": {
    "whereTheyHangOut": ["community with reason"],
    "painPoints": ["specific pain point from real data"],
    "delightFactors": ["what users genuinely love"],
    "languageTheyUse": ["exact phrases real users use"]
  },
  "messagingIntelligence": {
    "resonatingThemes": ["themes with high engagement"],
    "avoidThemes": ["angles that generate negative response"],
    "contentAngles": ["specific content ideas that would land organically"]
  },
  "twitterInsights": {
    "dominantSentiment": "what Twitter says overall",
    "viralAngles": ["topics that could go viral based on tweet patterns"],
    "hashtagOpportunities": ["hashtags worth targeting"]
  },
  "competitorGaps": ${competitor ? `{
    "whereBrandWins": ["where ${brand} outperforms"],
    "whereCompetitorWins": ["where ${competitor} outperforms"],
    "unmetNeeds": ["needs neither brand serves - your opportunity"]
  }` : "null"},
  "channelRecommendations": [
    {
      "channel": "channel name",
      "reason": "why based on data",
      "approach": "specific organic approach",
      "priority": "High/Medium/Low"
    }
  ],
  "redditOpportunities": [
    {
      "subreddit": "name",
      "opportunity": "specific engagement opportunity",
      "approach": "how to add genuine value"
    }
  ],
  "gtmRecommendations": [
    {
      "recommendation": "specific actionable recommendation",
      "rationale": "why based on data",
      "effort": "High/Medium/Low",
      "impact": "High/Medium/Low"
    }
  ],
  "marketSignals": ["important trend or signal from news/discussions"],
  ${isLaunch ? `"launchPlaybook": {
    "optimalTiming": "when to launch based on market signals",
    "launchChannelSequence": ["channel in order with rationale"],
    "prelaunchActions": ["specific action before launch day"],
    "launchDayPlaybook": ["specific action on launch day"],
    "firstWeekActions": ["specific action in first week post launch"],
    "messagingForLaunch": "core launch message that would resonate based on gap data",
    "risksToWatch": ["specific risk based on competitor/market data"]
  }` : `"launchPlaybook": null`}
}`;

    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      max_tokens: 4000,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = response.choices[0].message.content.trim().replace(/```json|```/g, "").trim();
    const result = JSON.parse(raw);

    result.meta = {
      brand, category,
      competitor: competitor || null,
      isLaunch: !!isLaunch,
      redditPostsAnalyzed: brandReddit.length,
      tweetsAnalyzed: twitterData.length,
      newsArticlesAnalyzed: newsData.length,
      competitorPostsAnalyzed: competitorReddit.length,
      topSubreddits,
      expandedKeywords: keywords,
      medianScore,
    };

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Analysis failed", details: err.message });
  }
});

app.get("/health", (req, res) => res.json({ status: "ok" }));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`GTM Intelligence v2 running on port ${PORT}`));
