import 'reflect-metadata';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import dotenv from 'dotenv';
import { DateTime } from 'luxon';
import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';

var name = "imgelo-api";
var packageJson = {
	name: name};

dotenv.config();
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL_NAME = "gemini-2.0-flash";
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
function toHumanReadable(iso, zone = "utc") {
  const safeIso = iso || DateTime.now().toUTC().toISO({ suppressMilliseconds: true });
  return DateTime.fromISO(safeIso, { zone }).toFormat("cccc, LLLL d, yyyy, t ZZZZ");
}
async function getRevisedTweetsWithGemini(request) {
  const { tweets, context, preferred_frequency, max_posts_per_day, audience_timezone, language_to_translate, historical_tweets } = request;
  let prompt = `
You are a social media scheduling assistant. Your job is to optimize tweet posting times (and tweet content if requested) based on the provided context and the initial planned times.
`;
  if (preferred_frequency) {
    prompt += `
Preferred posting frequency: ${preferred_frequency}`;
  }
  if (max_posts_per_day !== void 0) {
    prompt += `
Maximum posts per day: ${max_posts_per_day}`;
  }
  if (request.current_time) {
    prompt += `
Current time: ${request.current_time}`;
  }
  if (request.current_timezone) {
    prompt += `
Current timezone: ${request.current_timezone}`;
  }
  if (audience_timezone) {
    prompt += `
Audience timezone: ${audience_timezone}`;
  }
  if (language_to_translate) {
    prompt += `
Translate tweets to: ${language_to_translate}`;
  }
  if (historical_tweets && historical_tweets.length > 0) {
    prompt += `
Historical tweets for context:`;
    historical_tweets.forEach((tweet, i) => {
      prompt += `
  ${i + 1}. "${tweet.text}" at "${tweet.timestamp}" (${toHumanReadable(tweet.timestamp, audience_timezone || "utc")})`;
    });
  }
  prompt += `

Instructions:
- Consider the context carefully and adjust tweet times to maximize engagement and change the tweet text if requested.
- Timestamps are in ISO 8601 format.
- Do not schedule any tweet before current_time (converted to audience_timezone if needed). The first tweet should be scheduled as soon as possible after current_time, respecting audience_timezone and engagement rules.
- The timestamp of each tweet must be determined according to the request parameters: preferred_frequency, max_posts_per_day, current_time, current_timezone, and audience_timezone.
- Avoid posting at times when the target audience is likely to be asleep or inactive (e.g., late night hours).
- Take into account time zones if mentioned in the context.
- Be mindful of the audience_timezone of the target audience provided in context and change timestamps accordingly considering current time.
- If max_posts_per_day is 1 and two or more tweets are scheduled for the same day (in the audience's timezone), move the later tweets to the next available day, so that no day has more than one tweet.
- For example: If max_posts_per_day is 1 and you have two tweets scheduled for 2025-05-17 in Europe/Paris timezone, the first tweet should stay on 2025-05-17 and the second should be moved to 2025-05-18.
- Avoid posting during major global or local holidays of target audience if given in context (e.g., Christmas, New Year's Day, Thanksgiving, etc.) unless the context says otherwise.
- Consider the urgency or time-sensitivity of the tweet content (e.g., breaking news, event reminders should be posted sooner irrespective of the audience_timezone or current time or max_posts_per_day or ).
- Avoid posting multiple tweets too close together; space them out for maximum visibility (at least 1 hour apart unless context says otherwise).
- If the context is about a campaign, align tweets with campaign milestones or peak engagement windows.
- Respect any embargoes or do-not-post-before times mentioned in the context.
- Consider local events or news that may impact engagement if mentioned in the context.
- If the context is unclear, keep the original planned time.
- Always output timestamps in ISO 8601 format in the JSON.
- If translation or rewriting is requested in language_to_translate, modify the tweet text accordingly to the language_to_translate.
- If the context or parameters suggest, you may also rewrite or improve the tweet text for clarity, engagement, or localization.
- Respond ONLY with the JSON array, no explanations or markdown.
- IMPORTANT: Do NOT remove or filter out any tweets from the input. Always return the same number of tweets as provided in the input, just modify the timestamp or text as needed.
`;
  prompt += `Context: "${context}"
Tweets:
`;
  tweets.forEach((tweet, i) => {
    prompt += `${i + 1}. "${tweet.text}" at "${tweet.timestamp}" (${toHumanReadable(tweet.timestamp, audience_timezone || "utc")})
`;
  });
  prompt += `
For each tweet, if the context or parameters suggest a better posting time, change the timestamp. Otherwise, keep it the same.
Respond ONLY with the JSON array, no explanations or markdown.
[
  {"text": "...", "timestamp": "..."},
  ...
]
`;
  try {
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    console.log("[Gemini] Raw response:", text);
    const start = text.indexOf("[");
    const end = text.lastIndexOf("]") + 1;
    if (start !== -1 && end !== -1) {
      const jsonStr = text.slice(start, end);
      const arr = JSON.parse(jsonStr);
      return arr.map((tweet) => {
        const iso = tweet.timestamp || request.current_time || DateTime.now().toUTC().toISO({ suppressMilliseconds: true });
        return {
          text: tweet.text,
          timestamp: iso,
          readable_time: toHumanReadable(iso, audience_timezone || "utc")
        };
      });
    }
  } catch (e) {
    console.error("[Gemini] API error:", e);
  }
  return tweets.map((t) => {
    const iso = t.timestamp || request.current_time || DateTime.now().toUTC().toISO({ suppressMilliseconds: true });
    return {
      text: t.text,
      timestamp: iso,
      readable_time: toHumanReadable(iso, audience_timezone || "utc")
    };
  });
}

const app = express();
const httpServer = createServer(app);
const port = parseInt(process.env.PORT || "3300", 10);
app.use(cors());
app.use(express.json());
app.get("/api/sample/:name", (req, res) => {
  const sampleName = req.params.name;
  const samplePath = path.join(__dirname, "../samples", sampleName + ".json");
  if (!fs.existsSync(samplePath)) {
    return res.status(404).json({ error: "Sample not found" });
  }
  const data = fs.readFileSync(samplePath, "utf-8");
  res.type("application/json").send(data);
});
app.post("/api/schedule", async (req, res) => {
  let body;
  if (req.query.sample) {
    const sampleName = req.query.sample;
    const samplePath = path.join(__dirname, "../samples", sampleName + ".json");
    if (!fs.existsSync(samplePath)) {
      return res.status(404).json({ error: "Sample not found" });
    }
    body = JSON.parse(fs.readFileSync(samplePath, "utf-8"));
  } else {
    body = req.body;
  }
  if (!body || !body.tweets || !body.context) {
    return res.status(400).json({ error: "Missing tweets or context" });
  }
  try {
    const revisedTweets = await getRevisedTweetsWithGemini(body);
    const response = { tweets: revisedTweets };
    const output = {
      ...response,
      tweets: response.tweets.map((t) => ({
        text: t.text,
        timestamp: t.timestamp,
        // already ISO 8601
        ...t.readable_time ? { readable_time: t.readable_time } : {}
      }))
    };
    const now = DateTime.now().setZone("utc");
    const filename = `schedule_output_${now.toFormat("yyyy-LL-dd_HH-mm-ss")}.json`;
    fs.writeFileSync(filename, JSON.stringify(output, null, 2), "utf-8");
    res.json(output);
  } catch (e) {
    console.error("[API] Error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});
async function start() {
  const listenOptions = {
    port
  };
  httpServer.listen(listenOptions, () => {
    const listenAddress = listenOptions.host ? `${listenOptions.host}:${listenOptions.port}` : `port ${listenOptions.port}`;
    console.log(`${packageJson.name} running on ${listenAddress}`);
  });
}
start();
