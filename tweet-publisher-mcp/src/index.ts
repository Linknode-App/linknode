import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// Define environment interface for Cloudflare Workers
interface Env {
  X_BEARER_TOKEN: string;
}

// X API configuration
const X_API_URL = "https://api.x.com/2/tweets";

// Function to post a tweet using X API
async function postTweet(message: string, env: Env): Promise<{ success: boolean; tweetId?: string; error?: string }> {
  try {
    const response = await fetch(X_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.X_BEARER_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: message }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`X API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    return { success: true, tweetId: data.data.id };
  } catch (error) {
    console.error(`Error posting tweet: ${message}`, error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

// MCP agent for publishing tweets
export class TweetPublisherMCP extends McpAgent {
  server = new McpServer({
    name: "Tweet Publisher",
    version: "1.0.0",
  });

  async init() {
    // Tool to publish tweets immediately
    this.server.tool(
      "publishTweet",
      {
        message: z.string().max(280, "Tweet must be 280 characters or less"),
        username: z.string(),
      },
      async ({ message, username }) => {
        const result = await postTweet(message, this.env as Env);

        const response = {
          username,
          message,
          publishedAt: new Date().toISOString(),
          success: result.success,
          ...(result.success ? { tweetId: result.tweetId } : { error: result.error }),
        };

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(response, null, 2),
            },
          ],
        };
      }
    );
  }
}

// Export for Cloudflare Workers
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/sse" || url.pathname === "/sse/message") {
      // @ts-ignore (MCP SDK may lack TypeScript definitions)
      return TweetPublisherMCP.serveSSE("/sse").fetch(request, env, ctx);
    }

    if (url.pathname === "/mcp") {
      // @ts-ignore (MCP SDK may lack TypeScript definitions)
      return TweetPublisherMCP.serve("/mcp").fetch(request, env, ctx);
    }

    return new Response("Not found", { status: 404 });
  },
};