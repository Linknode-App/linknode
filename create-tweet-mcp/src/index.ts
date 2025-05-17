import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// Define our MCP agent with tools
export class MyMCP extends McpAgent {
	server = new McpServer({
		name: "Tweet Creator",
		version: "1.0.0",
	});

	async init() {
		// Tweet creation tool
		this.server.tool(
			"createTweet",
			{
				message: z.string().max(280), // Twitter's character limit
				username: z.string(),
				scheduledTime: z.string().datetime(), // ISO 8601 datetime string
			},
			async ({ message, username, scheduledTime }) => {
				const tweet = {
					message,
					username,
					scheduledTime,
					createdAt: new Date().toISOString(),
				};

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(tweet, null, 2),
						},
					],
				};
			}
		);
	}
}

export default {
	fetch(request: Request, env: Env, ctx: ExecutionContext) {
		const url = new URL(request.url);

		if (url.pathname === "/sse" || url.pathname === "/sse/message") {
			// @ts-ignore
			return MyMCP.serveSSE("/sse").fetch(request, env, ctx);
		}

		if (url.pathname === "/mcp") {
			// @ts-ignore
			return MyMCP.serve("/mcp").fetch(request, env, ctx);
		}

		return new Response("Not found", { status: 404 });
	},
};
