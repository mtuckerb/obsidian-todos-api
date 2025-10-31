# Obsidian Todos REST API

This Obsidian plugin extends the [Local REST API](https://github.com/coddingtonbear/obsidian-local-rest-api) plugin to expose todos/tasks via a REST endpoint using the Dataview plugin's API.

## 🚀 MCP Server Available!

This plugin now includes an **MCP (Model Context Protocol) server** that lets AI assistants like Claude Desktop directly manage your Obsidian todos! See the [`mcp-server/`](./mcp-server/) directory for installation and usage instructions.

## Prerequisites

- [Obsidian](https://obsidian.md/) installed
- [Local REST API](https://github.com/coddingtonbear/obsidian-local-rest-api) plugin installed and enabled
- [Dataview](https://github.com/blacksmithgu/obsidian-dataview) plugin installed and enabled

## Installation

### From Release

1. Download the latest release files (`main.js`, `manifest.json`, `styles.css`)
2. Create a folder named `obsidian-todos-api` in your vault's `.obsidian/plugins/` directory
3. Copy the downloaded files into this folder
4. Enable the plugin in Obsidian Settings → Community Plugins
5. Ensure both Local REST API and Dataview plugins are enabled

### Manual Build

1. Clone this repository
2. Run `npm install` to install dependencies
3. Run `npm run build` to compile the plugin
4. Copy `main.js`, `manifest.json`, and `styles.css` to your vault's `.obsidian/plugins/obsidian-todos-api/` directory

## Usage

### Get All Todos

```bash
curl http://localhost:27124/todos/
```

### Query Parameters

- `completed` - Filter by completion status (`true` or `false`)
  ```bash
  curl "http://localhost:27124/todos/?completed=false"
  ```

- `path` - Filter by file path (partial match)
  ```bash
  curl "http://localhost:27124/todos/?path=Projects"
  ```

- `tag` - Filter by tag (partial match)
  ```bash
  curl "http://localhost:27124/todos/?tag=urgent"
  ```

### Combine Multiple Filters

```bash
curl "http://localhost:27124/todos/?completed=false&path=Work&tag=urgent"
```

### Response Format

```json
{
  "count": 5,
  "tasks": [
    {
      "task": true,
      "status": " ",
      "checked": false,
      "completed": false,
      "fullyCompleted": false,
      "text": "Complete project documentation",
      "path": "Projects/MyProject.md",
      "line": 15,
      "lineCount": 1,
      "link": {
        "path": "Projects/MyProject.md",
        "type": "file"
      },
      "section": {
        "path": "Projects/MyProject.md",
        "subpath": "#Tasks",
        "type": "header"
      },
      "tags": ["#work", "#urgent"],
      "outlinks": [],
      "due": "2025-10-30",
      "children": []
    }
  ]
}
```

## Task Fields

Each task includes the following fields from Dataview:

### Core Fields
- `task`: Always `true` for tasks
- `status`: Status character between brackets (` ` for unchecked, `x` for completed)
- `checked`: Whether the task has any non-space status
- `completed`: Whether explicitly marked complete (`x` or `X`)
- `fullyCompleted`: Whether task and all subtasks are complete
- `text`: The task text content
- `visual`: Optional display text override

### Location Fields
- `path`: File path containing the task
- `line`: Line number where task appears
- `lineCount`: Number of lines the task spans
- `position`: Internal Obsidian position tracker
- `list`: Line number of the list this item belongs to
- `blockId`: Optional block ID
- `parent`: Optional parent item line number

### Link Fields
- `link`: Link to the task location
- `section`: Link to containing section
- `tags`: Array of tags in the task
- `outlinks`: Links contained in the task

### Structure
- `children`: Array of subtasks (SListItem[])
- `annotated`: Whether task has metadata annotations

### Date Fields (Optional)
- `created`: When the task was created
- `due`: When the task is due
- `completion`: When the task was completed
- `start`: When the task can be started
- `scheduled`: When work on the task is scheduled

### Custom Fields
Any additional fields added through Dataview annotations will also be included.

## Development

```bash
# Install dependencies
npm install

# Run in development mode with hot reload
npm run dev

# Build for production
npm run build

# Bump version
npm version patch|minor|major
```

## API Reference

This plugin uses:
- [Dataview API](https://github.com/blacksmithgu/obsidian-dataview) - for querying tasks
- [Local REST API](https://github.com/coddingtonbear/obsidian-local-rest-api) - for exposing HTTP endpoints

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
