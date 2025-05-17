# Linknode
## Create Post MCP
- given NL input, create a post json object with a timestamp
## Post Scheduler MCP
- view current schedule
- create timestamp
- rearrange given a post and new timestamp

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