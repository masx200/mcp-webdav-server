# WebDAV MCP 服务器

一个支持基本认证的 WebDAV 端点 CRUD 操作的模型上下文协议 (MCP)
服务器。该服务器使 Claude Desktop 和其他 MCP 客户端能够通过自然语言命令与 WebDAV
文件系统交互。

## 功能特性

- 连接到任何支持可选认证的 WebDAV 服务器
- 执行文件和目录的 CRUD 操作
- 将文件操作暴露为 MCP 资源和工具
- 通过 stdio 传输（用于 Claude Desktop 集成）或 HTTP/SSE 传输运行
- 支持可选基本认证的安全访问
- 支持 bcrypt 加密密码用于 MCP 服务器认证（WebDAV 密码由于协议限制必须是明文）
- 连接池以获得更好的 WebDAV 服务器性能
- 使用 Zod 进行配置验证
- 结构化日志以便更好的故障排除

## 前置要求

- Node.js 18 或更高版本
- npm 或 yarn
- WebDAV 服务器（用于实际文件操作）

## 安装

### 选项 1：从 npm 包安装

```bash
# 全局安装
npm install -g webdav-mcp-server

# 或使用 npx
npx webdav-mcp-server
```

### 选项 2：克隆并从源码构建

```bash
# 克隆仓库
git clone https://github.com/masx200/webdav-mcp-server.git
cd webdav-mcp-server

# 安装依赖
pnpm install

# 构建应用
pnpm run build
```

### 选项 3：Docker

```bash
# 构建 Docker 镜像
docker build -t webdav-mcp-server .

# 无认证运行容器
docker run -p 3000:3000 \
  -e WEBDAV_ROOT_URL=http://your-webdav-server \
  -e WEBDAV_ROOT_PATH=/webdav \
  webdav-mcp-server

# 为 WebDAV 和 MCP 服务器都启用认证的容器运行
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

## 配置

在根目录创建一个 `.env` 文件，包含以下变量：

```env
# WebDAV 配置
WEBDAV_ROOT_URL=http://localhost:4080
WEBDAV_ROOT_PATH=/webdav

# WebDAV 认证（可选）
WEBDAV_AUTH_ENABLED=true
WEBDAV_USERNAME=admin

# WebDAV 密码必须是明文（启用认证时必需）
# WebDAV 协议要求将实际密码发送到服务器
WEBDAV_PASSWORD=password

# 服务器配置（用于 HTTP 模式）
SERVER_PORT=3000

# MCP 服务器认证配置（可选）
AUTH_ENABLED=true
AUTH_USERNAME=user
AUTH_PASSWORD=pass
AUTH_REALM=MCP WebDAV Server

# MCP 服务器的认证密码可以是 bcrypt 哈希（与 WebDAV 密码不同）
# AUTH_PASSWORD={bcrypt}$2y$10$CyLKnUwn9fqqKQFEbxpZFuE9mzWR/x8t6TE7.CgAN0oT8I/5jKJBy
```

### MCP 服务器认证的加密密码

为了增强 MCP 服务器（不是 WebDAV 连接）的安全性，您可以使用 bcrypt
加密密码而不是以明文存储它们：

1. 生成 bcrypt 哈希：

   ```bash
   # 使用内置工具
   pnpm run generate-hash -- yourpassword

   # 或使用 npx
   npx webdav-mcp-generate-hash yourpassword
   ```

2. 将哈希添加到您的 .env 文件中，带有 {bcrypt} 前缀：
   ```
   AUTH_PASSWORD={bcrypt}$2y$10$CyLKnUwn9fqqKQFEbxpZFuE9mzWR/x8t6TE7.CgAN0oT8I/5jKJBy
   ```

这样，您的 MCP 服务器密码被安全存储。请注意，由于协议要求，WebDAV
密码必须始终是明文。

## 使用方法

### 使用 stdio 传输运行

此模式非常适合与 Claude Desktop 直接集成。

```bash
# 如果全局安装
webdav-mcp-server

# 如果使用 npx
npx webdav-mcp-server

# 如果从源码构建
node dist/index.js
```

### 使用 HTTP/SSE 传输运行

此模式使服务器能够通过 HTTP 访问，并使用服务器发送事件进行实时通信。

```bash
# 如果全局安装
webdav-mcp-server --http

# 如果使用 npx
npx webdav-mcp-server --http

# 如果从源码构建
node dist/index.js --http
```

## 使用 Docker Compose 快速开始

同时启动 WebDAV 服务器和 MCP 服务器的最简单方法是使用 Docker Compose：

```bash
# 启动 WebDAV 和 MCP 服务器
cd docker
docker-compose up -d

# 这将启动：
# - 端口 4080 上的 hacdias/webdav 服务器（用户名：admin，密码：admin）
# - 端口 3000 上的 MCP 服务器（用户名：user，密码：pass）
```

此设置使用 [hacdias/webdav](https://github.com/hacdias/webdav)，一个用 Go
编写的简单独立的 WebDAV 服务器。WebDAV 服务器的配置存储在 `webdav_config.yml`
中，您可以修改它来调整权限、添加用户或更改其他设置。

WebDAV 服务器将所有文件存储在名为 `webdav_data` 的 Docker
卷中，该卷在容器重启时保持持久化。

## WebDAV 服务器配置

`webdav_config.yml` 文件配置了 Docker Compose 设置中使用的 hacdias/webdav
服务器。以下是您可以自定义的内容：

```yaml
# 服务器地址和端口
address: 0.0.0.0
port: 6060

# 根数据目录
directory: /data

# 启用/禁用 CORS
cors:
  enabled: true
  # 附加 CORS 设置...

# 默认权限（C=创建，R=读取，U=更新，D=删除）
permissions: CRUD

# 用户定义
users:
  - username: admin
    password: admin # 明文密码
    permissions: CRUD # 完整权限

  - username: reader
    password: reader
    permissions: R # 只读权限

  # 您也可以使用 bcrypt 加密密码
  - username: secure
    password: "{bcrypt}$2y$10$zEP6oofmXFeHaeMfBNLnP.DO8m.H.Mwhd24/TOX2MWLxAExXi4qgi"
```

有关更高级的配置选项，请参阅
[hacdias/webdav 文档](https://github.com/hacdias/webdav)。

## 测试

运行测试：

```bash
pnpm test
```

## 与 Claude Desktop 集成

1. 确保在 Claude Desktop 中启用了 MCP 功能

<details>
<summary>使用 npx</summary>
2. 打开 Claude Desktop 设置并点击编辑配置 (`claude_desktop_config.json`)
3. 添加
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
<summary>使用 node 和本地构建</summary>
2. 克隆此仓库并在 mac/linux 上运行 `setup.sh` 或在 windows 上运行 `setup.bat`
3. 打开 Claude Desktop 设置并点击编辑配置 (`claude_desktop_config.json`)
4. 添加
```json
{
    "mcpServers": {
        "webdav": {
            "command": "node",
            "args": [
                "<仓库路径>/dist/index.js"
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

## 可用的 MCP 资源

- `webdav://{path}/list` - 列出目录中的文件
- `webdav://{path}/content` - 获取文件内容
- `webdav://{path}/info` - 获取文件或目录信息

## 可用的 MCP 工具

### 基础文件操作

- `webdav_create_remote_file` - 在远程 WebDAV 服务器上创建新文件
- `webdav_get_remote_file` - 从远程 WebDAV 服务器检索文件内容
- `webdav_update_remote_file` - 更新远程 WebDAV 服务器上的现有文件
- `webdav_delete_remote_item` - 从远程 WebDAV 服务器删除文件或目录
- `webdav_create_remote_directory` - 在远程 WebDAV 服务器上创建新目录
- `webdav_move_remote_item` - 在远程 WebDAV 服务器上移动/重命名文件/目录
- `webdav_copy_remote_item` - 将文件/目录复制到远程 WebDAV 服务器上的新位置
- `webdav_list_remote_directory` - 列出远程 WebDAV 服务器上的文件和目录

### 增强功能

- `webdav_read_remote_file` - 增强文件读取，支持 head/tail 选项
- `webdav_edit_remote_file` - 智能文件编辑，支持 diff 预览
- `webdav_list_directory_with_sizes` - 增强目录列表，包含大小和排序
- `webdav_search_files` - 使用 glob 模式搜索文件，支持排除模式
- `webdav_get_directory_tree` - 获取递归目录树 JSON 结构
- `webdav_read_multiple_files` - 同时读取多个文件
- `webdav_get_file_info` - 获取详细文件/目录元数据

## 可用的 MCP 提示

- `webdav_create_remote_file` - 在远程 WebDAV 服务器上创建新文件的提示
- `webdav_get_remote_file` - 从远程 WebDAV 文件检索内容的提示
- `webdav_update_remote_file` - 在远程 WebDAV 服务器上更新文件的提示
- `webdav_delete_remote_item` - 从远程 WebDAV 服务器删除文件/目录的提示
- `webdav_list_remote_directory` - 在远程 WebDAV 服务器上列出目录内容的提示
- `webdav_create_remote_directory` - 在远程 WebDAV 服务器上创建目录的提示
- `webdav_move_remote_item` - 在远程 WebDAV 服务器上移动/重命名文件/目录的提示
- `webdav_copy_remote_item` - 在远程 WebDAV 服务器上复制文件/目录的提示

## Claude 中的示例查询

连接 WebDAV MCP 服务器后，您可以在 Claude Desktop 中使用以下示例查询：

### 基础操作

- "列出我远程 WebDAV 服务器上的文件"
- "在我的远程 WebDAV 服务器上创建一个名为 notes.txt 的新文本文件，内容为：Hello
  World"
- "从我的远程 WebDAV 服务器获取 document.txt 的内容"
- "使用这个新配置更新我的远程 WebDAV 服务器上的 config.json"
- "在我的远程 WebDAV 服务器上创建一个名为 projects 的目录"
- "将 report.docx 复制到我的远程 WebDAV 服务器上的备份位置"
- "将我的远程 WebDAV 服务器上的文件 old_name.txt 移动到 new_name.txt"
- "从我的远程 WebDAV 服务器删除 temp.txt"

### 增强功能操作

- "读取日志文件的前 20 行：/logs/app.log"
- "搜索所有 JavaScript 文件：\*_/_.js，排除 node_modules 目录"
- "获取项目目录的树形结构"
- "按文件大小列出上传目录的内容"
- "同时读取多个配置文件"
- "编辑配置文件，预览更改而不实际应用"
- "获取文件的详细元数据信息"

## 程序化使用

您也可以在自己的项目中程序化使用此包：

```javascript
import { startWebDAVServer } from "webdav-mcp-server";

// 对于不使用认证的 stdio 传输
await startWebDAVServer({
  webdavConfig: {
    rootUrl: "http://your-webdav-server",
    rootPath: "/webdav",
    authEnabled: false,
  },
  useHttp: false,
});

// 对于使用 WebDAV 认证的 stdio 传输（密码必须是明文）
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

// 使用 bcrypt 哈希作为 MCP 服务器密码（仅 HTTP 认证）
await startWebDAVServer({
  webdavConfig: {
    rootUrl: "http://your-webdav-server",
    rootPath: "/webdav",
    authEnabled: true,
    username: "admin",
    password: "password", // WebDAV 密码必须是明文
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

// 对于带 MCP 认证的 HTTP 传输
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

// 对于不使用认证的 HTTP 传输
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

## 许可证

MIT

---

## 增强功能详情

### 🚀 新增功能概述

本版本包含以下主要增强功能：

1. **增强文件读取** - 支持 head/tail 参数，可读取文件的开头或结尾部分
2. **智能文件编辑** - 支持精确文本替换和 git 风格 diff 预览
3. **高级文件搜索** - 支持 glob 模式匹配和排除模式
4. **目录树结构** - 提供递归目录树的 JSON 表示
5. **增强目录列表** - 包含文件大小、排序和统计信息
6. **详细文件信息** - 提供完整的文件元数据
7. **多文件读取** - 支持同时读取多个文件

### 📋 技术特性

- **内存高效**: 大文件使用内存高效的流式处理
- **并发处理**: 多文件操作使用并发处理提高效率
- **安全验证**: 所有路径都经过安全验证
- **错误隔离**: 单个操作失败不影响其他操作
- **向后兼容**: 保持所有现有 API 不变

### 🔧 依赖更新

- **minimatch**: 用于强大的 glob 模式匹配
- **TypeScript**: 增强类型安全
- **完整文档**: 详细的使用说明和示例

这些增强功能使 WebDAV MCP Server
成为一个功能完整、性能优异、安全可靠的文件管理解决方案，特别适合复杂的项目管理和开发工作流程。
