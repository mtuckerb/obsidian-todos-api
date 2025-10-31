# Obsidian Todos MCP Server

Model Context Protocol (MCP) server that provides AI assistants with direct access to Obsidian todos through the Local REST API.

## Features

- 🔍 **List todos** - Get all incomplete todos from your vault
- ➕ **Add todos** - Create new todos in today's daily note
- ✏️ **Update todos** - Modify existing todos or mark them complete
- 📊 **Get stats** - View todo statistics by file

## Prerequisites

1. **Obsidian** with the following plugins installed and enabled:
   - Local REST API
   - Dataview
   - Todos REST API (this plugin)

2. **Node.js** 18+ installed

## Installation

### From npm (coming soon)
```bash
npm install -g obsidian-todos-mcp-server
```

### From source
```bash
cd mcp-server
npm install
npm run build
```

## Configuration

### Environment Variables

- `OBSIDIAN_API_URL` - Base URL for the REST API (default: `http://localhost:27124`)
- `OBSIDIAN_API_KEY` - API key if authentication is enabled

### Claude Desktop Configuration

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "obsidian-todos": {
      "command": "npx",
      "args": ["-y", "obsidian-todos-mcp-server"],
      "env": {
        "OBSIDIAN_API_URL": "http://localhost:27124"
      }
    }
  }
}
```

Or use the direct binary name after npm link:

```json
{
  "mcpServers": {
    "obsidian-todos": {
      "command": "obsidian-todos-mcp",
      "env": {
        "OBSIDIAN_API_URL": "http://localhost:27124"
      }
    }
  }
}
```

Or if running from source:

```json
{
  "mcpServers": {
    "obsidian-todos": {
      "command": "node",
      "args": ["/path/to/obsidian-todos-api/mcp-server/dist/index.js"],
      "env": {
        "OBSIDIAN_API_URL": "http://localhost:27124"
      }
    }
  }
}
```

## Available Tools

### `list_todos`

Lists all incomplete todos from your Obsidian vault.

**Example:**
```typescript
// No parameters needed
await use_mcp_tool({
  server_name: "obsidian-todos",
  tool_name: "list_todos",
  arguments: {}
});
```

### `add_todo`

Adds a new todo to today's daily note.

**Parameters:**
- `text` (string, required) - The todo text

**Example:**
```typescript
await use_mcp_tool({
  server_name: "obsidian-todos",
  tool_name: "add_todo",
  arguments: {
    text: "Review pull requests"
  }
});
```

### `update_todo`

Updates an existing todo (mark complete, change text, etc.).

**Parameters:**
- `file` (string, required) - Path to file containing the todo
- `line` (number, required) - Line number of the todo (0-indexed)
- `text` (string, optional) - New text for the todo
- `completed` (boolean, optional) - Mark as complete/incomplete

**Example:**
```typescript
await use_mcp_tool({
  server_name: "obsidian-todos",
  tool_name: "update_todo",
  arguments: {
    file: "Daily/2025-10-31.md",
    line: 5,
    completed: true
  }
});
```

### `get_todo_stats`

Get statistics about your todos.

**Example:**
```typescript
await use_mcp_tool({
  server_name: "obsidian-todos",
  tool_name: "get_todo_stats",
  arguments: {}
});
```

## Development

```bash
# Watch mode for development
npm run dev

# Build for production
npm run build

# Test the server
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node dist/index.js
```

## Troubleshooting

### Connection Issues

1. Ensure Obsidian Local REST API is running
2. Check the API URL is correct (default: `http://localhost:27124`)
3. Verify the Todos REST API plugin is enabled in Obsidian

### Authentication Errors

If you have authentication enabled in Local REST API:
1. Set the `OBSIDIAN_API_KEY` environment variable
2. Or update your Claude Desktop config with the API key

## License

MIT
