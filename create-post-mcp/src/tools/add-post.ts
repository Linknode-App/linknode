import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// Define the shape of our parameters
const paramsShape = {
  title: z.string(),
  description: z.string(),
  userId: z.string().optional()
};

// Extract TypeScript type directly from the shape
type CreatePostParams = {
  [K in keyof typeof paramsShape]: z.infer<typeof paramsShape[K]>
};

interface Post {
  id: string;
  title: string;
  description: string;
  userId: string;
  timestamp: string;
  tweetMessage: string;
}

// The actual implementation of the post creation functionality
export function createPost({ title, description, userId = "default-user" }: CreatePostParams): Post {
    const timestamp = new Date().toISOString();
    const id = crypto.randomUUID();
    
    // Create tweet message - limit to 280 chars
    const tweetMessage = `${title}\n\n${description}`.slice(0, 280);

    return {
        id,
        title,
        description,
        userId,
        timestamp,
        tweetMessage
    };
}

// The handler that formats the response from the tool
export async function createPostHandler(params: CreatePostParams) {
    const result = createPost(params);
    return {
        content: [
            { 
                type: "text" as const, 
                text: JSON.stringify({
                    tweetMessage: result.tweetMessage,
                    userId: result.userId,
                    timestamp: result.timestamp
                }, null, 2)
            }
        ],
    };
}

// The registration of the tool with the server
export function registerCreatePostTool(server: McpServer) {
    server.tool(
        "createPost",
        "Create a new post with title and description, returns tweet message, user ID, and timestamp",
        paramsShape,
        createPostHandler
    );
}