import { TweetInput, Tweet, ScheduleRequest } from "./models";
import dotenv from "dotenv";
import { DateTime } from "luxon";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL_NAME = "gemini-1.5-flash";

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY!);

function toISO8601(ts: number): string {
  const iso = DateTime.fromSeconds(ts, { zone: "utc" }).toISO({ suppressMilliseconds: true });
  if (!iso) throw new Error("Invalid date for ISO conversion: " + ts);
  return iso;
}

function toUnixTimestamp(ts: number): number {
  return ts;
}

export async function getRevisedTweetsWithGemini(request: ScheduleRequest): Promise<Tweet[]> {
  const { tweets, context, preferred_frequency, max_posts_per_day, current_timezone, is_translation_needed, language_to_translate, historical_tweets } = request;

  let prompt = `
You are a social media scheduling assistant. Your job is to optimize tweet posting times based on the provided context and the initial planned times.
`;

  // Add extra context if provided
  if (preferred_frequency) {
    prompt += `\nPreferred posting frequency: ${preferred_frequency}`;
  }
  if (max_posts_per_day !== undefined) {
    prompt += `\nMaximum posts per day: ${max_posts_per_day}`;
  }
  if (current_timezone) {
    prompt += `\nCurrent timezone: ${current_timezone}`;
  }
  if (is_translation_needed) {
    prompt += `\nTranslation is needed for the tweets.`;
    if (language_to_translate) {
      prompt += `\nTranslate tweets to: ${language_to_translate}`;
    }
  }
  if (historical_tweets && historical_tweets.length > 0) {
    prompt += `\nHistorical tweets for context:`;
    historical_tweets.forEach((tweet, i) => {
      prompt += `\n  ${i + 1}. "${tweet.text}" at "${toISO8601(tweet.timestamp)}"`;
    });
  }

  prompt += `\n\nInstructions:
- Consider the context carefully and adjust tweet times to maximize engagement.
- Avoid posting at times when the target audience is likely to be asleep or inactive (e.g., late night hours).
- Take into account time zones if mentioned in the context.
- Avoid posting on holidays or weekends if the context suggests so.
- Avoid posting during major global or local holidays (e.g., Christmas, New Year's Day, Thanksgiving, etc.) unless the context says otherwise.
- Consider the urgency or time-sensitivity of the tweet content (e.g., breaking news, event reminders should be posted sooner).
- Avoid posting multiple tweets too close together; space them out for maximum visibility (at least 1 hour apart unless context says otherwise).
- If the context is about a campaign, align tweets with campaign milestones or peak engagement windows.
- Respect any embargoes or do-not-post-before times mentioned in the context.
- Consider local events or news that may impact engagement if mentioned in the context.
- If the context is unclear, keep the original planned time.
- Always output timestamps in ISO 8601 format in the JSON, but the API will convert them to Unix timestamps for the client.
- If translation or rewriting is needed, modify the tweet text accordingly.
- If translation is requested, translate the tweet text to the specified language.
- If the context or parameters suggest, you may also rewrite or improve the tweet text for clarity, engagement, or localization.
- Respond ONLY with the JSON array, no explanations or markdown.\n`;

  prompt += `Here are some example scenarios:\n\n`;
  prompt += `Context: "Our audience is most active during weekday evenings (6pm-9pm UTC). Avoid weekends."\nTweets:\n`;
  prompt += `1. "Check out our new product!" at "2024-06-01T10:00:00Z"\n2. "Don't miss our live Q&A tomorrow!" at "2024-06-02T15:00:00Z"\n\n`;
  prompt += `Expected output:\n[{"text": "Check out our new product!", "timestamp": "2024-06-03T18:00:00Z"}, {"text": "Don't miss our live Q&A tomorrow!", "timestamp": "2024-06-03T19:00:00Z"}]\nExplanation: This is a good example because the tweets were moved from the weekend to weekday evenings, matching the context's guidance and maximizing engagement.\n\n`;
  prompt += `Context: "This is a campaign for a new video game. Peak engagement is Friday nights and Saturday mornings."\nTweets:\n`;
  prompt += `1. "Game launch trailer drops soon!" at "2024-06-05T12:00:00Z"\n2. "Join our launch event!" at "2024-06-06T14:00:00Z"\n\n`;
  prompt += `Expected output:\n[{"text": "Game launch trailer drops soon!", "timestamp": "2024-06-07T19:00:00Z"}, {"text": "Join our launch event!", "timestamp": "2024-06-08T09:00:00Z"}]\nExplanation: This is a good example because the tweets were rescheduled to the campaign's peak engagement times (Friday night and Saturday morning).\n\n`;
  prompt += `Context: "No special audience pattern."\nTweets:\n`;
  prompt += `1. "Hello world!" at "2024-06-01T10:00:00Z"\n\n`;
  prompt += `Expected output:\n[{"text": "Hello world!", "timestamp": "2024-06-01T10:00:00Z"}]\nExplanation: This is a good example because the context does not suggest any changes, so the original time is kept.\n\n`;
  prompt += `Context: "Our audience is in the US and Europe. Avoid posting between 12am and 6am in both time zones."\nTweets:\n`;
  prompt += `1. "Early morning update" at "2024-06-01T03:00:00Z"\n\n`;
  prompt += `Expected output:\n[{"text": "Early morning update", "timestamp": "2024-06-01T12:00:00Z"}]\nExplanation: This is a good example because the tweet was moved out of the inactive window for both US and Europe.\n\n`;
  prompt += `Context: "${context}"\nTweets:\n`;
  tweets.forEach((tweet, i) => {
    prompt += `${i + 1}. "${tweet.text}" at "${toISO8601(tweet.timestamp)}"\n`;
  });
  prompt += `\nFor each tweet, if the context or parameters suggest a better posting time, change the timestamp. Otherwise, keep it the same.\nRespond ONLY with the JSON array, no explanations or markdown.\n[\n  {"text": "...", "timestamp": "..."},\n  ...\n]\n`;

  try {
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    console.log("[Gemini] Raw response:", text);
    // Extract JSON array
    const start = text.indexOf("[");
    const end = text.lastIndexOf("]") + 1;
    if (start !== -1 && end !== -1) {
      const jsonStr = text.slice(start, end);
      const arr = JSON.parse(jsonStr);
      return arr.map((tweet: any) => ({
        text: tweet.text,
        // Gemini outputs ISO 8601, convert to Unix timestamp
        timestamp: toUnixTimestamp(DateTime.fromISO(tweet.timestamp, { zone: "utc" }).toSeconds())
      }));
    }
  } catch (e) {
    console.error("[Gemini] API error:", e);
  }
  // Fallback: return original tweets as Unix timestamps
  return tweets.map(t => ({ text: t.text, timestamp: toUnixTimestamp(t.timestamp) }));
} 