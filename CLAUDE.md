# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with
code in this repository.

## Project Overview

This is a **WebDAV MCP Server** - a Model Context Protocol (MCP) server that
enables Claude Desktop and other MCP clients to interact with WebDAV file
systems through natural language commands. The server exposes CRUD operations on
WebDAV endpoints as MCP resources, tools, and prompts.

## Development Commands

### Core Development

```bash
# Install dependencies
npm install

# Build the TypeScript project
npm run build

# Run development mode with auto-rebuild
npm run dev

# Run in watch mode for continuous compilation
npm run watch

# Start the server (stdio transport)
npm start

# Start server with HTTP transport
node dist/index.js --http
```

### Code Quality

```bash
# Lint the codebase
npm run lint

# Run tests (when available)
npm test
```

### Password Utilities

```bash
# Generate bcrypt hash for secure password storage
npm run generate-hash -- yourpassword [rounds]
# or
npx webdav-mcp-generate-hash yourpassword [rounds]
```

## Architecture

### Core Components

1. **Server Entry Points**
   - `src/index.ts` - CLI entry point that reads environment variables and
     starts the server
   - `src/lib.ts` - Main library export with `startWebDAVServer()` function for
     programmatic usage

2. **Service Layer**
   - `src/services/webdav-service.ts` - Core WebDAV operations (CRUD, list,
     stat, etc.)
   - `src/services/webdav-connection-pool.ts` - Connection pooling for
     performance optimization

3. **MCP Integration**
   - `src/handlers/resource-handlers.ts` - MCP resource handlers
     (`webdav://{path}/list`, `webdav://{path}/content`, etc.)
   - `src/handlers/tool-handlers.ts` - MCP tool handlers for file operations
     (create, read, update, delete, etc.)
   - `src/handlers/prompt-handlers.ts` - MCP prompt handlers for natural
     language interactions

4. **HTTP Server**
   - `src/servers/express-server.ts` - Express server with SSE transport for
     HTTP mode
   - `src/middleware/auth-middleware.ts` - Basic authentication middleware for
     HTTP server

5. **Configuration & Validation**
   - `src/config/validation.ts` - Zod schemas for runtime configuration
     validation
   - `src/utils/password-utils.ts` - Password encryption utilities
   - `src/utils/logger.ts` - Structured logging utility

### Key Design Patterns

1. **Transport Flexibility**: Supports both stdio (for Claude Desktop) and
   HTTP/SSE transports
2. **Connection Pooling**: Optimizes performance by reusing WebDAV connections
3. **Configuration Validation**: Uses Zod schemas with runtime validation
4. **Authentication**: Supports basic auth for both WebDAV servers and MCP
   server itself
5. **Password Security**: bcrypt hashing for MCP server passwords (WebDAV
   passwords remain plain text due to protocol requirements)

### Available MCP Operations

**Resources:**

- `webdav://{path}/list` - List directory contents
- `webdav://{path}/content` - Get file content
- `webdav://{path}/info` - Get file/directory metadata

**Tools:**

- `webdav_create_remote_file` - Create new files
- `webdav_get_remote_file` - Read file content
- `webdav_read_remote_file` - Enhanced file reading with head/tail options
- `webdav_update_remote_file` - Update existing files
- `webdav_edit_remote_file` - Smart file editing with diff preview
- `webdav_delete_remote_item` - Delete files/directories
- `webdav_create_remote_directory` - Create directories
- `webdav_move_remote_item` - Move/rename files/directories
- `webdav_copy_remote_item` - Copy files/directories
- `webdav_list_remote_directory` - List directory contents
- `webdav_list_directory_with_sizes` - Enhanced directory listing with sizes and
  sorting
- `webdav_search_files` - Search files using glob patterns with exclusion
  support
- `webdav_get_directory_tree` - Get recursive directory tree as JSON
- `webdav_read_multiple_files` - Read multiple files simultaneously
- `webdav_get_file_info` - Get detailed file/directory metadata

**Prompts:**

- Natural language prompts for all file operations

## Configuration

The server is configured through environment variables:

### Required Configuration

```env
# WebDAV server configuration
WEBDAV_ROOT_URL=http://localhost:4080
WEBDAV_ROOT_PATH=/webdav
```

### Optional WebDAV Authentication

```env
WEBDAV_AUTH_ENABLED=true
WEBDAV_USERNAME=admin
WEBDAV_PASSWORD=password  # Must be plain text (protocol requirement)
```

### Optional HTTP Server Configuration

```env
SERVER_PORT=3000
AUTH_ENABLED=true
AUTH_USERNAME=user
AUTH_PASSWORD=pass  # Can be bcrypt hash: {bcrypt}$2y$10$...
AUTH_REALM=MCP WebDAV Server
```

### Password Encryption

For MCP server authentication (not WebDAV), use bcrypt hashes:

```env
AUTH_PASSWORD={bcrypt}$2y$10$CyLKnUwn9fqqKQFEbxpZFuE9mzWR/x8t6TE7.CgAN0oT8I/5jKJBy
```

## Development Notes

### TypeScript Configuration

- Target: ES2022
- Module: NodeNext with ES modules
- Strict mode enabled
- Declaration files generated for library usage

### Dependencies

- **@modelcontextprotocol/sdk**: MCP server framework
- **webdav**: WebDAV client library (v5.x)
- **zod**: Runtime validation
- **express**: HTTP server for SSE transport
- **bcryptjs**: Password hashing
- **dotenv**: Environment variable loading
- **minimatch**: Glob pattern matching for file search and exclusion patterns

### Important Constraints

1. **WebDAV Passwords**: Must remain plain text due to WebDAV protocol
   requirements
2. **Connection Pooling**: All WebDAV operations go through the connection pool
3. **Error Handling**: All operations include proper error handling with
   descriptive messages
4. **Path Handling**: Automatic path resolution combining rootPath with
   operation paths
5. **Response Types**: Handle both direct responses and detailed response
   objects from webdav v5.x
6. **Pattern Matching**: Uses minimatch for glob pattern matching in search and
   tree operations
7. **Diff Generation**: Smart file editing includes git-style diff generation
   for change previews

### Enhanced Features

#### File Reading with Options

- **Head/Tail Support**: Read first N lines (head) or last N lines (tail) of
  files
- **Memory Efficient**: Efficient reading of large files without loading entire
  content

#### Smart File Editing

- **Precise Text Replacement**: Find and replace exact text sequences
- **Multiple Edits**: Apply multiple edits in a single operation
- **Diff Preview**: Generate git-style diffs to preview changes before applying
- **Dry Run Mode**: Preview changes without modifying files

#### Advanced Search

- **Glob Patterns**: Support for glob-style patterns (`*.txt`, `**/*.js`,
  `config.*`)
- **Exclusion Patterns**: Exclude files/directories from search results
- **Recursive Search**: Search through directory trees recursively
- **Path Validation**: All paths validated against allowed directories

#### Directory Operations

- **Enhanced Listing**: Directory listings with file sizes, sorting, and
  statistics
- **Tree View**: JSON-based recursive directory tree structure
- **Size Formatting**: Human-readable file size formatting (B, KB, MB, GB)

#### Multi-file Operations

- **Batch Reading**: Read multiple files simultaneously for efficiency
- **Parallel Processing**: Concurrent file operations with proper error handling
- **Detailed Metadata**: Comprehensive file information including timestamps and
  MIME types

### Testing

The project is designed to work with external WebDAV servers. For local testing:

- Use Docker Compose setup with `hacdias/webdav` server
- Or configure environment variables to point to your WebDAV server

### Publishing

Use the provided npm scripts for version management and publishing:

- `npm run publish:patch` - Patch releases
- `npm run publish:minor` - Minor releases
- `npm run publish:major` - Major releases

The `prepublishOnly` script ensures builds and tests pass before publishing.
