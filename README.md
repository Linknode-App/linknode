# Linknode
## Create Post MCP
- given NL input, create a post json object with a timestamp
## Post Scheduler MCP
- view current schedule
- create timestamp
- rearrange given a post and new timestamp

## API Usage: Schedule Tweets

### POST /api/schedule

You can schedule tweets by sending a POST request to `/api/schedule`.

#### 1. Using a Sample JSON File
- Place your sample request JSON in `api/samples/sample1.json` (or any name).
- Call:
  - `POST http://localhost:3300/api/schedule?sample=sample1`
- The server will use the contents of `api/samples/sample1.json` as the request body.

#### 2. Sending Custom JSON (e.g., from Postman or curl)
- Set the URL to `http://localhost:3300/api/schedule` (no `sample` parameter).
- Set the method to POST.
- Set the body to raw JSON, for example:

```json
{
  "context": "Translate and optimize for French audience. Post only in the morning.",
  "tweets": [
    { "text": "Good morning! Join our webinar.", "timestamp": 1718000000 },
    { "text": "Exclusive offer for our followers!", "timestamp": 1718086400 },
    { "text": "Don't miss our weekend surprise!", "timestamp": 1718172800 }
  ],
  "preferred_frequency": "daily",
  "max_posts_per_day": 1,
  "current_timezone": "Europe/Paris",
  "is_translation_needed": true,
  "language_to_translate": "fr"
}
```

- In Postman: set Body to raw, type JSON, and paste your JSON.
- In curl:
  ```sh
  curl -X POST http://localhost:3300/api/schedule \
    -H "Content-Type: application/json" \
    -d @api/samples/sample1.json
  ```
  Or use your own JSON inline with `-d '{...}'`.

#### Optional Parameters Supported
- `preferred_frequency` (string): Preferred posting frequency (e.g., 'daily', 'weekly', 'hourly')
- `max_posts_per_day` (number): Maximum number of posts allowed per day
- `current_timezone` (string): Current timezone of the user or audience (e.g., 'America/New_York')
- `is_translation_needed` (boolean): Whether translation is needed for the tweets
- `language_to_translate` (string): Target language for translation (e.g., 'es', 'fr')
- `historical_tweets` (array): Array of historical tweets for context (text and timestamp)

#### Response
- Returns the revised tweets and timestamps, possibly translated or rewritten according to your parameters.

---

## MCP Server urls:
Non-Authenticated:
- Main Social MCP: https://main-social-mcp.chalmersbrown-app.workers.dev/

Authenticated
- Main MCP: https://main-mcp.chalmersbrown-app.workers.dev/
- Create Post MCP: https://create-post-mcp.chalmersbrown-app.workers.dev/
- Post Scheduler MCP: https://post-scheduler-mcp.chalmersbrown-app.workers.dev/

## Cloudflare
- Example of spinning up new MCP server on cloudlfare: 
```
npm create cloudflare@latest -- tweet-scheduler-mcp --template=cloudflare/ai/demos/remote-mcp-authless
```

## Debug
Test the remote server using Inspector:
```
npx @modelcontextprotocol/inspector@latest
```