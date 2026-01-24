# HubSpot MCP Server

This is a local MCP server that provides HubSpot integration for the AI Assistant.
It replaces the broken "hubspot-advan" server.

## Installation

You must install the dependencies for this server to work:

```bash
cd scripts/hubspot-mcp
npm install
# or
bun install
```

## Configuration

The server expects `HUBSPOT_API_KEY` to be present in the root `.env` file of the workspace.
