import 'reflect-metadata';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import colors from 'colors';
import packageJson from '../package.json';
import { getRevisedTweetsWithGemini } from "./gemini";
import { ScheduleRequest, ScheduleResponse, Tweet } from "./models";
import fs from "fs";
import { DateTime } from "luxon";
import path from "path";

const app = express();
const httpServer = createServer(app);

const port = parseInt(process.env.PORT || '3300', 10);

// Configure CORS with specific options
app.use(cors());

app.use(express.json());

// Serve sample JSON files
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
  let body: ScheduleRequest;
  // Support loading from sample JSON
  if (req.query.sample) {
    const sampleName = req.query.sample as string;
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
    const revisedTweets: Tweet[] = await getRevisedTweetsWithGemini(body);
    const response: ScheduleResponse = { tweets: revisedTweets };

    // Prepare output with ISO 8601 timestamps and readable_time
    const output = {
      ...response,
      tweets: response.tweets.map(t => ({
        text: t.text,
        timestamp: t.timestamp, // already ISO 8601
        ...(t.readable_time ? { readable_time: t.readable_time } : {})
      }))
    };
    // Generate filename with current date and time
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
  const listenOptions: { port: number; host?: string } = {
    port,
  };

  httpServer.listen(listenOptions, () => {
    const listenAddress = listenOptions.host
      ? `${listenOptions.host}:${listenOptions.port}`
      : `port ${listenOptions.port}`;
    console.log(`${packageJson.name} running on ${listenAddress}`);
  });
}

start();
