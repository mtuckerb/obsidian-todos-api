#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import fetch from "node-fetch";

interface ServerConfig {
  apiUrl: string;
  apiKey?: string;
}

const DEFAULT_CONFIG: ServerConfig = {
  apiUrl: process.env.OBSIDIAN_API_URL || "http://localhost:27124",
  apiKey: process.env.OBSIDIAN_API_KEY,
};

class ObsidianTodosServer {
  private server: Server;
  private config: ServerConfig;

  constructor(config: ServerConfig = DEFAULT_CONFIG) {
    this.config = config;
    this.server = new Server(
      {
        name: "obsidian-todos-mcp-server",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  private async fetchApi(endpoint: string, options: any = {}) {
    const url = `${this.config.apiUrl}${endpoint}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string> || {}),
    };

    if (this.config.apiKey) {
      headers["Authorization"] = this.config.apiKey;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    return await response.json() as any;
  }

  private setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "list_todos",
          description: "List all incomplete todos from Obsidian vault using Dataview",
          inputSchema: {
            type: "object",
            properties: {},
          },
        },
        {
          name: "add_todo",
          description: "Add a new todo to today's daily note in Obsidian",
          inputSchema: {
            type: "object",
            properties: {
              text: {
                type: "string",
                description: "The todo text to add",
              },
            },
            required: ["text"],
          },
        },
        {
          name: "update_todo",
          description: "Update an existing todo in Obsidian (mark complete, change text, etc.)",
          inputSchema: {
            type: "object",
            properties: {
              file: {
                type: "string",
                description: "Path to the file containing the todo",
              },
              line: {
                type: "number",
                description: "Line number of the todo (0-indexed)",
              },
              text: {
                type: "string",
                description: "New text for the todo",
              },
              completed: {
                type: "boolean",
                description: "Whether the todo should be marked complete",
              },
            },
            required: ["file", "line"],
          },
        },
        {
          name: "get_todo_stats",
          description: "Get statistics about todos (total, by file, etc.)",
          inputSchema: {
            type: "object",
            properties: {},
          },
        },
      ],
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case "list_todos": {
            const result = await this.fetchApi("/todos/");
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          case "add_todo": {
            const { text } = args as { text: string };
            const result = await this.fetchApi("/todos/", {
              method: "POST",
              body: JSON.stringify({ text }),
            });
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          case "update_todo": {
            const { file, line, text, completed } = args as {
              file: string;
              line: number;
              text?: string;
              completed?: boolean;
            };
            const result = await this.fetchApi("/todos/", {
              method: "PUT",
              body: JSON.stringify({ file, line, text, completed }),
            });
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          case "get_todo_stats": {
            const todos = await this.fetchApi("/todos/");
            const stats = {
              total: todos.todos?.length || 0,
              byFile: todos.todos?.reduce((acc: Record<string, number>, todo: any) => {
                acc[todo.file] = (acc[todo.file] || 0) + 1;
                return acc;
              }, {}),
            };
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(stats, null, 2),
                },
              ],
            };
          }

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: "text",
              text: `Error: ${errorMessage}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Obsidian Todos MCP Server running on stdio");
  }
}

// Start the server
const server = new ObsidianTodosServer();
server.run().catch(console.error);
