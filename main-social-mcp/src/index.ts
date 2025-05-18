import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { experimental_createMCPClient, generateText } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { z } from "zod";

// Define our MCP agent with tools
export class MyMCP extends McpAgent {
	server = new McpServer({
		name: "vibe-poster",
		version: "1.0.0",
		description: "Coordinates post creation and scheduling using other MCP services.",
	});

	async init() {
		// Simple addition tool
		
		
		this.server.tool(
			"createAndScheduleVibePost",
			"Creates post content and schedules it based on a natural language description. It uses specialized services for content generation and scheduling.",
			{ // Input schema for this tool
				description: z.string().describe("Natural language input describing the post content and desired schedule. e.g., 'Draft a tweet about AI ethics and schedule it for tomorrow afternoon.'"),
			},
			async ({ description }) => { // Handler function
				// URLs for the dependent MCP services from README.md
				const createPostMCPUrl = 'https://create-tweet-mcp.chalmersbrown-app.workers.dev/sse';
				const postSchedulerMCPUrl = 'https://tweet-scheduler-mcp.chalmersbrown-app.workers.dev/sse';
		
				let createPostClient;
				let postSchedulerClient;
		
				console.error(`[vibe-poster] Tool 'createAndScheduleVibePost' invoked with description: "${description}"`);
		
				try {
					// Initialize MCP clients for dependent services
					console.error(`[vibe-poster] Connecting to Create Tweet MCP at ${createPostMCPUrl}`);
					createPostClient = await experimental_createMCPClient({
						transport: { type: 'sse', url: createPostMCPUrl },
						// Note: If these endpoints require authentication (e.g., Bearer token),
						// the transport options might need a `headers` field:
						// headers: { 'Authorization': 'Bearer YOUR_TOKEN' }
						// This depends on the auth mechanism of the target MCPs and SSE client capabilities.
					});
					console.error('[vibe-poster] Connected to Create Tweet MCP.');
		
					console.error(`[vibe-poster] Connecting to Tweet Scheduler MCP at ${postSchedulerMCPUrl}`);
					postSchedulerClient = await experimental_createMCPClient({
						transport: { type: 'sse', url: postSchedulerMCPUrl },
					});
					console.error('[vibe-poster] Connected to Tweet Scheduler MCP.');
		
					// Fetch tools from dependent services
					console.error('[vibe-poster] Fetching tools from Create Tweet MCP...');
					const toolSetCreatePost = await createPostClient.tools();
					const createPostToolNames = Object.keys(toolSetCreatePost).join(', ') || 'none';
					console.error(`[vibe-poster] Fetched tools from Create Tweet MCP: ${createPostToolNames}`);
		
					console.error('[vibe-poster] Fetching tools from Tweet Scheduler MCP...');
					const toolSetPostScheduler = await postSchedulerClient.tools();
					const postSchedulerToolNames = Object.keys(toolSetPostScheduler).join(', ') || 'none';
					console.error(`[vibe-poster] Fetched tools from Tweet Scheduler MCP: ${postSchedulerToolNames}`);
		
					// Combine toolsets
					const allTools = {
						...toolSetCreatePost,
						...toolSetPostScheduler,
					};
		
					if (Object.keys(allTools).length === 0) {
						const errorMsg = "[vibe-poster] Critical: No tools loaded from dependent MCPs (create-tweet-mcp, tweet-scheduler-mcp). Ensure they are running, accessible via their URLs, and correctly exposing tools. Also check for any authentication issues if applicable.";
						console.error(errorMsg);
						return { content: [{ type: 'text', text: errorMsg }] };
					}
					console.error(`[vibe-poster] Combined tools for AI: ${Object.keys(allTools).join(', ')}`);
		
					// Call Anthropic model using generateText with the combined tools
					console.error('[vibe-poster] Calling Anthropic model via generateText...');
					const { text, toolCalls, toolResults, finishReason, usage, warnings } = await generateText({
						// @ts-ignore
						model: createAnthropic('claude-3-7-sonnet-20250219', {
							apiKey: process.env.ANTHROPIC_API_KEY,
						}), // Using Haiku for potentially faster/cheaper iterations. Can be switched to Opus.
						tools: allTools,
						system: `You are an AI assistant named "Vibe Poster Coordinator".
		Your task is to manage the creation and scheduling of social media posts based on user requests.
		You have access to specialized tools from two services:
		1. Tools from 'Create Tweet MCP': These tools will help you generate the content of the post. They are expected to handle the creative aspects and return structured post data (likely a JSON object that might include a timestamp).
		2. Tools from 'Tweet Scheduler MCP': These tools will help you schedule the generated post. They will likely require the post data (e.g., the JSON object from the creation step) and timing information.
		
		Follow these steps meticulously:
		- Analyze the user's description to understand the desired post content and schedule.
		- First, use an appropriate tool from 'Create Tweet MCP' to generate the post content.
		- Once the content is successfully generated, use an appropriate tool from 'Tweet Scheduler MCP' to schedule it.
		- Provide a clear summary of the actions taken, the results from each tool call, and the final outcome. If any step fails, report it clearly.
		
		You MUST use the provided tools to accomplish these tasks. Do not attempt to create or schedule posts by just generating text.
		Prioritize calling the content creation tool first, then the scheduling tool with the output of the first.
		The user has provided a single description for both content and scheduling. You must interpret it and call the appropriate tools in sequence.`,
						messages: [
							{ role: 'user', content: description }
						],
					});
		
					console.error('[vibe-poster] Anthropic model call completed.');
					console.error(`[vibe-poster] AI Raw Text Response: ${text}`);
					if (warnings && warnings.length > 0) console.warn('[vibe-poster] AI Warnings:', warnings);
					if (toolCalls && toolCalls.length > 0) {
						console.error(`[vibe-poster] AI Tool Calls made: ${JSON.stringify(toolCalls, null, 2)}`);
					}
					if (toolResults && toolResults.length > 0) {
						console.error(`[vibe-poster] AI Tool Results received: ${JSON.stringify(toolResults, null, 2)}`);
					}
		
					// Prepare the response for the Vibe Poster MCP tool call
					let resultText = `Vibe Poster AI decision: ${text}\n`;
					if (toolResults && toolResults.length > 0) {
						resultText += `\nTool Actions and Results:\n${toolResults.map(tr => `  - Tool: ${tr.toolName} (Call ID: ${tr.toolCallId})\n    Result: ${JSON.stringify(tr.result)}`).join('\n\n')}`;
					} else if (toolCalls && toolCalls.length > 0) {
						resultText += "\nTool calls were made by the AI, but results were not explicitly processed or are part of the main text response. This might indicate the AI is explaining its plan or the tools executed without returning structured data to this orchestrator directly through toolResults.";
					} else {
						resultText += "\nNo specific tool actions were reported by the AI through structured tool calls/results. The AI's main text response should contain the outcome or explanation.";
					}
					
					return {
						content: [{ type: 'text', text: resultText }],
					};
		
				} catch (error) {
					console.error(`[vibe-poster] Error in 'createAndScheduleVibePost' tool execution:`, error);
					let errorMessage = `Error processing your request in Vibe Poster.`;
					if (error instanceof Error) {
						errorMessage += ` Details: ${error.message}`;
						// Log stack for more detailed debugging on the server
						console.error(`[vibe-poster] Stack trace: ${error.stack}`);
					}
					// Safely access error.cause
					if (typeof error === 'object' && error !== null && 'cause' in error) {
						console.error(`[vibe-poster] Error Cause:`, (error as { cause: unknown }).cause);
					}
					
					return {
						content: [{ type: 'text', text: errorMessage + " Check server logs for vibe-poster and potentially the downstream MCP services (create-tweet-mcp, tweet-scheduler-mcp) for more details." }],
					};
				} finally {
					console.error('[vibe-poster] Attempting to close downstream MCP clients...');
					const clientClosePromises = [];
					if (createPostClient) {
						clientClosePromises.push(
							createPostClient.close().catch(e => console.error("[vibe-poster] Error closing Create Tweet MCP client:", e))
						);
					}
					if (postSchedulerClient) {
						clientClosePromises.push(
							postSchedulerClient.close().catch(e => console.error("[vibe-poster] Error closing Tweet Scheduler MCP client:", e))
						);
					}
					await Promise.allSettled(clientClosePromises);
					console.error('[vibe-poster] Downstream MCP client cleanup finished.');
				}
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
