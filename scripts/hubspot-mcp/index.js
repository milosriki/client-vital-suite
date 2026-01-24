import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import axios from "axios";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Attempt to load .env from project root
dotenv.config({ path: path.join(__dirname, '../../.env') });

const API_KEY = process.env.HUBSPOT_API_KEY;

const server = new Server(
  {
    name: "hubspot-advanced",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "create_engagement",
        description: "Create a new engagement (note, call, email, meeting) in HubSpot.",
        inputSchema: {
          type: "object",
          properties: {
            type: {
              type: "string",
              enum: ["NOTE", "CALL", "EMAIL", "MEETING"],
              description: "The type of engagement",
            },
            contactId: {
              type: "string",
              description: "The HubSpot Contact ID to associate with",
            },
            body: {
              type: "string",
              description: "The content/body of the engagement",
            },
            metadata: {
              type: "object",
              description: "Additional metadata",
              properties: {
                 durationMilliseconds: { type: "number" },
                 status: { type: "string" },
                 subject: { type: "string" }
              }
            }
          },
          required: ["type", "contactId"],
        },
      },
      {
        name: "search_contacts",
        description: "Search for contacts by email, name or phone.",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search term (email, name, or phone)",
            },
            properties: {
              type: "array",
              items: { type: "string" },
              description: "List of properties to retrieve",
            },
          },
          required: ["query"],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const apiKey = API_KEY || process.env.HUBSPOT_API_KEY;
  if (!apiKey) {
    return {
      isError: true,
      content: [{ type: "text", text: "HUBSPOT_API_KEY is not configured in .env" }]
    };
  }

  const { name, arguments: args } = request.params;

  try {
    if (name === "create_engagement") {
      const { type, contactId, body, metadata } = args;
      
      const engagementData = {
        engagement: {
          active: true,
          type: type,
          timestamp: Date.now(),
        },
        associations: {
          contactIds: [Number(contactId)],
        },
        metadata: {
          body: body || "",
          ...metadata
        }
      };

      const response = await axios.post(
        "https://api.hubapi.com/engagements/v1/engagements",
        engagementData,
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(response.data, null, 2),
          },
        ],
      };
    }

    if (name === "search_contacts") {
      const { query, properties } = args;
      
      const searchPayload = {
        filterGroups: [
          { filters: [{ propertyName: "email", operator: "EQ", value: query }] },
          { filters: [{ propertyName: "firstname", operator: "CONTAINS_TOKEN", value: query }] },
          { filters: [{ propertyName: "lastname", operator: "CONTAINS_TOKEN", value: query }] },
          { filters: [{ propertyName: "phone", operator: "CONTAINS_TOKEN", value: query }] },
        ],
        properties: properties || ["email", "firstname", "lastname", "phone", "lifecyclestage"],
        limit: 5,
      };

      const response = await axios.post(
        "https://api.hubapi.com/crm/v3/objects/contacts/search",
        searchPayload,
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(response.data, null, 2),
          },
        ],
      };
    }

    throw new Error(`Unknown tool: ${name}`);
  } catch (error) {
    const errorDetails = error.response ? JSON.stringify(error.response.data) : error.message;
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: `HubSpot API Error: ${errorDetails}`,
        },
      ],
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
