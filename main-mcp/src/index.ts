import OAuthProvider from "@cloudflare/workers-oauth-provider";
import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { Octokit } from "octokit";
import { GitHubHandler } from "./github-handler";
import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";

// Context from the auth process, encrypted & stored in the auth token
// and provided to the DurableMCP as this.props
type Props = {
	login: string;
	name: string;
	email: string;
	accessToken: string;
};

const ALLOWED_USERNAMES = new Set([
        // Add GitHub usernames of users who should have access to the image generation tool
        // For example: 'yourusername', 'coworkerusername'
]);

const CREATE_POST_MCP_URL =
        "https://create-post-mcp.chalmersbrown-app.workers.dev/";
const POST_SCHEDULER_MCP_URL =
        "https://post-scheduler-mcp.chalmersbrown-app.workers.dev/";

export class MyMCP extends McpAgent<Props, Env> {
	server = new McpServer({
		name: "Github OAuth Proxy Demo",
		version: "1.0.0",
	});

	async init() {
		// Hello, world!
		this.server.tool(
			"add",
			"Add two numbers the way only MCP can",
			{ a: z.number(), b: z.number() },
			async ({ a, b }) => ({
				content: [{ type: "text", text: String(a + b) }],
			}),
		);

		// Use the upstream access token to facilitate tools
		this.server.tool(
			"userInfoOctokit",
			"Get user info from GitHub, via Octokit",
			{},
			async () => {
				const octokit = new Octokit({ auth: this.props.accessToken });
				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(await octokit.rest.users.getAuthenticated()),
						},
					],
				};
			},
		);

		// Dynamically add tools based on the user's login. In this case, I want to limit
		// access to my Image Generation tool to just me
                if (ALLOWED_USERNAMES.has(this.props.login)) {
                        this.server.tool(
                                "generateImage",
                                "Generate an image using the `flux-1-schnell` model. Works best with 8 steps.",
				{
					prompt: z
						.string()
						.describe("A text description of the image you want to generate."),
					steps: z
						.number()
						.min(4)
						.max(8)
						.default(4)
						.describe(
							"The number of diffusion steps; higher values can improve quality but take longer. Must be between 4 and 8, inclusive.",
						),
				},
				async ({ prompt, steps }) => {
					const response = await this.env.AI.run("@cf/black-forest-labs/flux-1-schnell", {
						prompt,
						steps,
					});

					return {
						content: [{ type: "image", data: response.image!, mimeType: "image/jpeg" }],
					};
                                },
                        );
                }

                this.server.tool(
                        "coordinateTask",
                        "Given user input, orchestrate other MCP servers to complete the request",
                        { input: z.string() },
                        async ({ input }) => {
                                const { object: plan } = await generateObject({
                                        model: openai("gpt-3.5-turbo"),
                                        prompt:
                                                "Extract a post title, description and timestamp from the following user request. Return JSON with keys title, description and timestamp.",
                                        schema: z.object({
                                                title: z.string(),
                                                description: z.string(),
                                                timestamp: z.string(),
                                        }),
                                        messages: [{ role: "user", content: input }],
                                });

                                const postResp = await fetch(
                                        CREATE_POST_MCP_URL + "api/create",
                                        {
                                                method: "POST",
                                                headers: { "Content-Type": "application/json" },
                                                body: JSON.stringify({
                                                        title: plan.title,
                                                        description: plan.description,
                                                }),
                                        },
                                );
                                const post = await postResp.json();

                                await fetch(POST_SCHEDULER_MCP_URL + "api/schedule", {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({ post, timestamp: plan.timestamp }),
                                });

                                return {
                                        content: [
                                                {
                                                        type: "text",
                                                        text: `Post scheduled for ${plan.timestamp}`,
                                                },
                                        ],
                                };
                        },
                );
        }
}

export default new OAuthProvider({
	apiRoute: "/sse",
	apiHandler: MyMCP.mount("/sse"),
	defaultHandler: GitHubHandler,
	authorizeEndpoint: "/authorize",
	tokenEndpoint: "/token",
	clientRegistrationEndpoint: "/register",
});
