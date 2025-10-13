# WebDAV MCP Server

A Model Context Protocol (MCP) server that enables CRUD operations on a WebDAV
endpoint with basic authentication. This server enables Claude Desktop and other
MCP clients to interact with WebDAV file systems through natural language
commands.

## Features

- Connect to any WebDAV server with optional authentication
- Perform CRUD operations on files and directories
- Expose file operations as MCP resources and tools
- Run via stdio transport (for Claude Desktop integration) or HTTP/SSE transport
- Secure access with optional basic authentication
- Support for bcrypt-encrypted passwords for MCP server authentication (WebDAV
  passwords must be plain text due to protocol limitations)
- Connection pooling for better performance with WebDAV servers
- Configuration validation using Zod
- Structured logging for better troubleshooting

## Prerequisites

- Node.js 18 or later
- npm or yarn
- WebDAV server (for actual file operations)

## Installation

### Option 1: Install from npm package

```bash
# Global installation
npm install -g webdav-mcp-server

# Or with npx
npx webdav-mcp-server
```

### Option 2: Clone and build from source

```bash
# Clone repository
git clone https://github.com/masx200/webdav-mcp-server.git
cd webdav-mcp-server

# Install dependencies
npm install

# Build the application
npm run build
```

### Option 3: Docker

```bash
# Build the Docker image
docker build -t webdav-mcp-server .

# Run the container without authentication
docker run -p 3000:3000 \
  -e WEBDAV_ROOT_URL=http://your-webdav-server \
  -e WEBDAV_ROOT_PATH=/webdav \
  webdav-mcp-server

# Run the container with authentication for both WebDAV and MCP server
docker run -p 3000:3000 \
  -e WEBDAV_ROOT_URL=http://your-webdav-server \
  -e WEBDAV_ROOT_PATH=/webdav \
  -e WEBDAV_AUTH_ENABLED=true \
  -e WEBDAV_USERNAME=admin \
  -e WEBDAV_PASSWORD=password \
  -e AUTH_ENABLED=true \
  -e AUTH_USERNAME=user \
  -e AUTH_PASSWORD=pass \
  webdav-mcp-server
```

## Configuration

Create a `.env` file in the root directory with the following variables:

```env
# WebDAV configuration
WEBDAV_ROOT_URL=http://localhost:4080
WEBDAV_ROOT_PATH=/webdav

# WebDAV authentication (optional)
WEBDAV_AUTH_ENABLED=true
WEBDAV_USERNAME=admin

# WebDAV password must be plain text (required when auth enabled)
# The WebDAV protocol requires sending the actual password to the server
WEBDAV_PASSWORD=password

# Server configuration (for HTTP mode)
SERVER_PORT=3000

# Authentication configuration for MCP server (optional)
AUTH_ENABLED=true
AUTH_USERNAME=user
AUTH_PASSWORD=pass
AUTH_REALM=MCP WebDAV Server

# Auth password for MCP server can be a bcrypt hash (unlike WebDAV passwords)
# AUTH_PASSWORD={bcrypt}$2y$10$CyLKnUwn9fqqKQFEbxpZFuE9mzWR/x8t6TE7.CgAN0oT8I/5jKJBy
```

### Encrypted Passwords for MCP Server Authentication

For enhanced security of the MCP server (not WebDAV connections), you can use
bcrypt-encrypted passwords instead of storing them in plain text:

1. Generate a bcrypt hash:

   ```bash
   # Using the built-in utility
   npm run generate-hash -- yourpassword

   # Or with npx
   npx webdav-mcp-generate-hash yourpassword
   ```

2. Add the hash to your .env file with the {bcrypt} prefix:
   ```
   AUTH_PASSWORD={bcrypt}$2y$10$CyLKnUwn9fqqKQFEbxpZFuE9mzWR/x8t6TE7.CgAN0oT8I/5jKJBy
   ```

This way, your MCP server password is stored securely. Note that WebDAV
passwords must always be in plain text due to protocol requirements.

## Usage

### Running with stdio transport

This mode is ideal for direct integration with Claude Desktop.

```bash
# If installed globally
webdav-mcp-server

# If using npx
npx webdav-mcp-server

# If built from source
node dist/index.js
```

### Running with HTTP/SSE transport

This mode enables the server to be accessed over HTTP with Server-Sent Events
for real-time communication.

```bash
# If installed globally
webdav-mcp-server --http

# If using npx
npx webdav-mcp-server --http

# If built from source
node dist/index.js --http
```

## Quick Start with Docker Compose

The easiest way to get started with both the WebDAV server and the MCP server is
to use Docker Compose:

```bash
# Start both WebDAV and MCP servers
cd docker
docker-compose up -d

# This will start:
# - hacdias/webdav server on port 4080 (username: admin, password: admin)
# - MCP server on port 3000 (username: user, password: pass)
```

This setup uses [hacdias/webdav](https://github.com/hacdias/webdav), a simple
and standalone WebDAV server written in Go. The configuration for the WebDAV
server is stored in `webdav_config.yml`, which you can modify to adjust
permissions, add users, or change other settings.

The WebDAV server stores all files in a Docker volume called `webdav_data`,
which persists across container restarts.

## WebDAV Server Configuration

The `webdav_config.yml` file configures the hacdias/webdav server used in the
Docker Compose setup. Here's what you can customize:

```yaml
# Server address and port
address: 0.0.0.0
port: 6060

# Root data directory
directory: /data

# Enable/disable CORS
cors:
  enabled: true
  # Additional CORS settings...

# Default permissions (C=Create, R=Read, U=Update, D=Delete)
permissions: CRUD

# User definitions
users:
  - username: admin
    password: admin # Plain text password
    permissions: CRUD # Full permissions

  - username: reader
    password: reader
    permissions: R # Read-only permissions

  # You can also use bcrypt-encrypted passwords
  - username: secure
    password: "{bcrypt}$2y$10$zEP6oofmXFeHaeMfBNLnP.DO8m.H.Mwhd24/TOX2MWLxAExXi4qgi"
```

For more advanced configuration options, refer to the
[hacdias/webdav documentation](https://github.com/hacdias/webdav).

## Testing

To run the tests:

```bash
npm test
```

## Integrating with Claude Desktop

1. Ensure the MCP feature is enabled in Claude Desktop

<details>
<summary>Using npx</summary>
2. Open Claude Desktop settings and click edit config (`claude_desktop_config.json`)
3. Add
```json
{
    "mcpServers": {
        "webdav": {
            "command": "npx",
            "args": [
                "-y",
                "webdav-mcp-server"
            ],
            "env": {
                "WEBDAV_ROOT_URL": "<WEBDAV_ROOT_URL>",
                "WEBDAV_ROOT_PATH": "<WEBDAV_ROOT_PATH>",
                "WEBDAV_USERNAME": "<WEBDAV_USERNAME>",
                "WEBDAV_PASSWORD": "<WEBDAV_PASSWORD>",
                "WEBDAV_AUTH_ENABLED": "true|false"
            }
        }
    }
}
```
</details>
<details>
<summary>Using node and local build</summary>
2. Clone this repository and run `setup.sh` on mac/linux or `setup.bat` on windows
3. Open Claude Desktop settings and click edit config (`claude_desktop_config.json`)
4. Add
```json
{
    "mcpServers": {
        "webdav": {
            "command": "node",
            "args": [
                "<path to repository>/dist/index.js"
            ],
            "env": {
                "WEBDAV_ROOT_URL": "<WEBDAV_ROOT_URL>",
                "WEBDAV_ROOT_PATH": "<WEBDAV_ROOT_PATH>",
                "WEBDAV_USERNAME": "<WEBDAV_USERNAME>",
                "WEBDAV_PASSWORD": "<WEBDAV_PASSWORD>",
                "WEBDAV_AUTH_ENABLED": "true|false"
            }
        }
    }
}
```
</details>

## Available MCP Resources

- `webdav://{path}/list` - List files in a directory
- `webdav://{path}/content` - Get file content
- `webdav://{path}/info` - Get file or directory information

## Available MCP Tools

- `webdav_create_remote_file` - Create a new file on a remote WebDAV server
- `webdav_get_remote_file` - Retrieve content from a file stored on a remote
  WebDAV server
- `webdav_update_remote_file` - Update an existing file on a remote WebDAV
  server
- `webdav_delete_remote_item` - Delete a file or directory from a remote WebDAV
  server
- `webdav_create_remote_directory` - Create a new directory on a remote WebDAV
  server
- `webdav_move_remote_item` - Move or rename a file/directory on a remote WebDAV
  server
- `webdav_copy_remote_item` - Copy a file/directory to a new location on a
  remote WebDAV server
- `webdav_list_remote_directory` - List files and directories on a remote WebDAV
  server

### Enhanced Features

- `webdav_read_remote_file` - Enhanced file reading with head/tail options
- `webdav_edit_remote_file` - Smart file editing with diff preview
- `webdav_list_directory_with_sizes` - Enhanced directory listing with sizes and
  sorting
- `webdav_search_files` - Search files using glob patterns with exclusion
  support
- `webdav_get_directory_tree` - Get recursive directory tree as JSON
- `webdav_read_multiple_files` - Read multiple files simultaneously
- `webdav_get_file_info` - Get detailed file/directory metadata
- `webdav_range_request` - Read specific byte range from a file (HTTP 206
  Partial Content)

## Available MCP Prompts

- `webdav_create_remote_file` - Prompt to create a new file on a remote WebDAV
  server
- `webdav_get_remote_file` - Prompt to retrieve content from a remote WebDAV
  file
- `webdav_update_remote_file` - Prompt to update a file on a remote WebDAV
  server
- `webdav_delete_remote_item` - Prompt to delete a file/directory from a remote
  WebDAV server
- `webdav_list_remote_directory` - Prompt to list directory contents on a remote
  WebDAV server
- `webdav_create_remote_directory` - Prompt to create a directory on a remote
  WebDAV server
- `webdav_move_remote_item` - Prompt to move/rename a file/directory on a remote
  WebDAV server
- `webdav_copy_remote_item` - Prompt to copy a file/directory on a remote WebDAV
  server

## Example Queries in Claude

Here are some example queries you can use in Claude Desktop once the WebDAV MCP
server is connected:

- "List files on my remote WebDAV server"
- "Create a new text file called notes.txt on my remote WebDAV server with the
  following content: Hello World"
- "Get the content of document.txt from my remote WebDAV server"
- "Update config.json on my remote WebDAV server with this new configuration"
- "Create a directory called projects on my remote WebDAV server"
- "Copy report.docx to a backup location on my remote WebDAV server"
- "Move the file old_name.txt to new_name.txt on my remote WebDAV server"
- "Delete temp.txt from my remote WebDAV server"

### Enhanced Feature Operations

- "Read the first 20 lines of a log file: /logs/app.log"
- "Search for all JavaScript files: **/*.js, excluding node_modules directory"
- "Get the tree structure of the project directory"
- "List the contents of the uploads directory by file size"
- "Read multiple configuration files simultaneously"
- "Edit a configuration file with preview of changes"
- "Get detailed metadata information for a file"
- "Read the first 500 bytes of a file: bytes=0-499"
- "Read the last 100 bytes of a file: bytes=400-"

## Programmatic Usage

You can also use this package programmatically in your own projects:

```javascript
import { startWebDAVServer } from "webdav-mcp-server";

// For stdio transport without authentication
await startWebDAVServer({
  webdavConfig: {
    rootUrl: "http://your-webdav-server",
    rootPath: "/webdav",
    authEnabled: false,
  },
  useHttp: false,
});

// For stdio transport with WebDAV authentication (password must be plain text)
await startWebDAVServer({
  webdavConfig: {
    rootUrl: "http://your-webdav-server",
    rootPath: "/webdav",
    authEnabled: true,
    username: "admin",
    password: "password",
  },
  useHttp: false,
});

// With bcrypt hash for MCP server password (HTTP auth only)
await startWebDAVServer({
  webdavConfig: {
    rootUrl: "http://your-webdav-server",
    rootPath: "/webdav",
    authEnabled: true,
    username: "admin",
    password: "password", // WebDAV password must be plain text
  },
  useHttp: true,
  httpConfig: {
    port: 3000,
    auth: {
      enabled: true,
      username: "user",
      password:
        "{bcrypt}$2y$10$CyLKnUwn9fqqKQFEbxpZFuE9mzWR/x8t6TE7.CgAN0oT8I/5jKJBy",
    },
  },
});

// For HTTP transport with MCP authentication
await startWebDAVServer({
  webdavConfig: {
    rootUrl: "http://your-webdav-server",
    rootPath: "/webdav",
    authEnabled: true,
    username: "admin",
    password: "password",
  },
  useHttp: true,
  httpConfig: {
    port: 3000,
    auth: {
      enabled: true,
      username: "user",
      password: "pass",
      realm: "MCP WebDAV Server",
    },
  },
});

// For HTTP transport without authentication
await startWebDAVServer({
  webdavConfig: {
    rootUrl: "http://your-webdav-server",
    rootPath: "/webdav",
    authEnabled: false,
  },
  useHttp: true,
  httpConfig: {
    port: 3000,
    auth: {
      enabled: false,
    },
  },
});
```

## License

MIT

# WebDAV MCP Server 增强功能文档

## 概述

本文档记录了对 WebDAV MCP Server 的全面增强功能，基于 filesystem MCP
服务器实现，大幅提升了文件操作能力和用户体验。

## 新增功能

### 1. 增强文件读取功能

#### `webdav_read_remote_file`

- **功能**: 读取文件内容，支持 head/tail 参数
- **参数**:
  - `path` (string): 文件路径
  - `head` (number, 可选): 返回文件的前 N 行
  - `tail` (number, 可选): 返回文件的后 N 行
- **特性**:
  - 内存高效：大文件读取时不加载全部内容
  - 参数验证：head 和 tail 不能同时使用
  - 灵活读取：支持读取文件开头或结尾部分

### 2. 智能文件编辑功能

#### `webdav_edit_remote_file`

- **功能**: 智能文件编辑，支持部分替换和 diff 预览
- **参数**:
  - `path` (string): 文件路径
  - `edits` (array): 编辑操作数组，包含 oldText 和 newText
  - `dryRun` (boolean, 可选): 预览模式，生成 diff 但不实际修改文件
- **特性**:
  - 精确匹配：查找并替换精确的文本序列
  - 多重编辑：支持单次操作中应用多个编辑
  - Diff 预览：生成 git 风格的差异预览
  - 安全模式：干运行模式确保编辑安全

### 3. 高级文件搜索功能

#### `webdav_search_files`

- **功能**: 使用 glob 模式递归搜索文件和目录
- **参数**:
  - `path` (string, 可选): 搜索起始目录，默认为根目录
  - `pattern` (string): Glob 模式匹配规则（如 `*.txt`, `**/*.js`, `config.*`）
  - `excludePatterns` (array, 可选): 排除模式数组
- **特性**:
  - Glob 模式：支持标准的 glob 模式匹配
  - 排除模式：支持排除特定文件或目录
  - 递归搜索：深度搜索整个目录树
  - 路径验证：所有路径都经过安全验证

### 4. 目录树结构功能

#### `webdav_get_directory_tree`

- **功能**: 获取递归目录树结构的 JSON 表示
- **参数**:
  - `path` (string, 可选): 根目录路径，默认为根目录
  - `excludePatterns` (array, 可选): 排除模式数组
- **特性**:
  - JSON 结构：返回结构化的 JSON 树数据
  - 递归遍历：完整遍历目录层次结构
  - 模式排除：支持排除特定项目
  - 清晰格式：2 空格缩进的可读格式

### 5. 增强目录列表功能

#### `webdav_list_directory_with_sizes`

- **功能**: 增强目录列表，包含文件大小、排序和统计信息
- **参数**:
  - `path` (string, 可选): 目录路径，默认为根目录
  - `sortBy` (enum, 可选): 排序方式（'name' 或 'size'），默认按名称排序
- **特性**:
  - 文件大小：显示每个文件的格式化大小
  - 排序选项：支持按名称或大小排序
  - 统计信息：显示文件总数、目录总数和总大小
  - 格式化输出：清晰的表格格式显示

### 6. 详细文件信息功能

#### `webdav_get_file_info`

- **功能**: 获取文件或目录的详细元数据
- **参数**:
  - `path` (string): 文件或目录路径
- **特性**:
  - 完整元数据：名称、路径、类型、大小、修改时间、MIME 类型
  - 格式化大小：人类可读的文件大小格式
  - 时间戳：详细的最后修改时间
  - 类型识别：区分文件和目录类型

### 7. 多文件同时读取功能

#### `webdav_read_multiple_files`

- **功能**: 同时读取多个文件内容
- **参数**:
  - `paths` (array): 文件路径数组
- **特性**:
  - 并行处理：并发读取多个文件提高效率
  - 错误隔离：单个文件读取失败不影响其他文件
  - 格式化输出：清晰的分隔显示多个文件内容
  - 错误报告：详细的错误信息显示

### 8. 范围请求功能

#### `webdav_range_request`

- **功能**: 按字节范围读取文件内容，支持 HTTP 206 Partial Content 响应
- **参数**:
  - `path` (string): 文件路径
  - `range` (string): 字节范围，格式如 `bytes=0-499`, `bytes=400-`, `0-499`
- **特性**:
  - HTTP 标准兼容：完全兼容 HTTP 1.1 Range Requests 规范
  - 多种格式支持：支持 `bytes=0-499`, `bytes=400-`, `0-499` 等格式
  - 大文件优化：适用于大文件的部分内容读取，减少网络传输
  - 元数据返回：返回 Content-Range, Content-Length, Total-Size 等信息
  - Unicode 支持：正确处理多字节字符的范围计算

## 技术实现

### 依赖项增强

- **minimatch**: 用于 glob 模式匹配的强大库
- **TypeScript**: 增强类型安全和代码质量

### 核心服务扩展

- **WebDAVService**: 新增多个方法支持高级功能
- **智能编辑**: 内置 diff 生成和文本替换逻辑
- **搜索算法**: 高效的递归搜索和模式匹配

### 错误处理

- **详细错误信息**: 所有操作包含完整的错误描述
- **安全验证**: 路径验证防止未授权访问
- **优雅降级**: 部分失败不影响整体操作

## 使用示例

### 1. 读取文件前 10 行

```typescript
const result = await toolHandler("webdav_read_remote_file", {
  path: "/logs/app.log",
  head: 10,
});
```

### 2. 智能编辑文件

```typescript
const result = await toolHandler("webdav_edit_remote_file", {
  path: "/config/settings.json",
  edits: [
    {
      oldText: '"debug": false',
      newText: '"debug": true',
    },
  ],
  dryRun: true, // 预览模式
});
```

### 3. 搜索所有 JavaScript 文件

```typescript
const result = await toolHandler("webdav_search_files", {
  path: "/src",
  pattern: "**/*.js",
  excludePatterns: ["node_modules/**", "dist/**"],
});
```

### 4. 获取目录树结构

```typescript
const result = await toolHandler("webdav_get_directory_tree", {
  path: "/project",
  excludePatterns: [".git/**", "node_modules/**"],
});
```

### 5. 列出目录详情并按大小排序

```typescript
const result = await toolHandler("webdav_list_directory_with_sizes", {
  path: "/uploads",
  sortBy: "size",
});
```

### 6. 范围请求示例

```typescript
// 读取文件前 500 字节
const result = await toolHandler("webdav_range_request", {
  path: "/large-file.txt",
  range: "bytes=0-499",
});

// 读取文件最后 100 字节
const result = await toolHandler("webdav_range_request", {
  path: "/large-file.txt",
  range: "bytes=400-",
});

// 读取文件中间部分
const result = await toolHandler("webdav_range_request", {
  path: "/large-file.txt",
  range: "bytes=100-199",
});
```

## 性能优化

### 内存效率

- **流式读取**: 大文件使用内存高效的流式处理
- **并发操作**: 多文件操作使用并发处理
- **延迟加载**: 按需加载文件内容和元数据

### 网络优化

- **连接池**: 复用 WebDAV 连接减少开销
- **批量操作**: 减少网络请求次数
- **错误重试**: 自动处理临时网络问题

## 安全特性

### 路径验证

- **根目录限制**: 所有操作限制在允许的目录内
- **符号链接处理**: 安全处理符号链接防止路径遍历攻击
- **路径规范化**: 统一路径格式防止绕过

### 操作安全

- **原子操作**: 文件写入使用原子操作防止数据损坏
- **预览模式**: 编辑操作支持预览避免误操作
- **详细日志**: 所有操作记录详细日志

## 兼容性

### 向后兼容

- **现有 API**: 保持所有现有工具和 API 不变
- **渐进增强**: 新功能作为可选参数添加
- **默认行为**: 保持原有默认行为不变

### WebDAV 标准

- **协议兼容**: 完全兼容 WebDAV 协议标准
- **多平台支持**: 支持各种 WebDAV 服务器实现
- **认证支持**: 保持现有认证机制

## 总结

这些增强功能大幅提升了 WebDAV MCP Server
的功能性和易用性，使其成为一个功能完整、性能优异、安全可靠的文件管理解决方案。新功能在保持向后兼容的同时，为用户提供了强大的文件操作能力，特别适合复杂的项目管理和开发工作流程。

### 🎯 范围请求功能

新增的范围请求功能是 WebDAV MCP Server 的一个重要里程碑，它提供了：

- **HTTP 标准兼容**: 完全兼容 HTTP 1.1 Range Requests 规范
- **性能优化**: 大文件的部分内容读取，显著减少网络传输
- **应用场景丰富**: 日志分析、音视频元数据提取、大文件预览等
- **技术先进**: 精确的字节范围计算和 Unicode 字符支持

这一功能的加入，使 WebDAV MCP Server
在文件处理能力上达到了新的高度，为用户提供了更强大和灵活的文件操作体验。
