import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebDAVService } from "../services/webdav-service.js";
import { z } from "zod";

export function setupToolHandlers(
  server: McpServer,
  webdavService: WebDAVService,
) {
  // Create file tool
  server.tool(
    "webdav_create_remote_file",
    "Create a new file on a remote WebDAV server at the specified path",
    {
      path: z.string().min(1, "Path must not be empty"),
      content: z.string(),
      overwrite: z.boolean().optional().default(false),
    },
    async ({ path, content, overwrite }) => {
      try {
        // Check if file exists and respect overwrite flag
        const exists = await webdavService.exists(path);
        if (exists && !overwrite) {
          return {
            content: [{
              type: "text",
              text:
                `Error: File already exists at ${path}. Use overwrite=true to replace it.`,
            }],
            isError: true,
          };
        }

        await webdavService.writeFile(path, content);

        return {
          content: [{
            type: "text",
            text: `File created successfully at ${path}`,
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error creating file: ${(error as Error).message}`,
          }],
          isError: true,
        };
      }
    },
  );

  // Read file tool
  server.tool(
    "webdav_get_remote_file",
    "Retrieve content from a file stored on a remote WebDAV server",
    {
      path: z.string().min(1, "Path must not be empty"),
    },
    async ({ path }) => {
      try {
        const content = await webdavService.readFile(path);

        return {
          content: [{
            type: "text",
            text: content,
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error reading file: ${(error as Error).message}`,
          }],
          isError: true,
        };
      }
    },
  );

  // Enhanced read file tool with head/tail support
  server.tool(
    "webdav_read_remote_file",
    "Read content from a file on a remote WebDAV server with enhanced options (head/tail)",
    {
      path: z.string().min(1, "Path must not be empty"),
      head: z.number().optional().describe(
        "If provided, returns only the first N lines of the file",
      ),
      tail: z.number().optional().describe(
        "If provided, returns only the last N lines of the file",
      ),
    },
    async ({ path, head, tail }) => {
      try {
        const content = await webdavService.readFileWithOptions(path, {
          head,
          tail,
        });

        // Build description for logging/debugging purposes
        const description = `Read file: ${path}${
          head ? ` (first ${head} lines)` : tail ? ` (last ${tail} lines)` : ""
        }`;

        return {
          content: [{
            type: "text",
            text: content,
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error reading file: ${(error as Error).message}`,
          }],
          isError: true,
        };
      }
    },
  );

  // Update file tool
  server.tool(
    "webdav_update_remote_file",
    "Update an existing file on a remote WebDAV server with new content",
    {
      path: z.string().min(1, "Path must not be empty"),
      content: z.string(),
    },
    async ({ path, content }) => {
      try {
        // Check if file exists
        const exists = await webdavService.exists(path);
        if (!exists) {
          return {
            content: [{
              type: "text",
              text: `Error: File does not exist at ${path}`,
            }],
            isError: true,
          };
        }

        await webdavService.writeFile(path, content);

        return {
          content: [{
            type: "text",
            text: `File updated successfully at ${path}`,
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error updating file: ${(error as Error).message}`,
          }],
          isError: true,
        };
      }
    },
  );

  // Smart edit file tool
  server.tool(
    "webdav_edit_remote_file",
    "Apply intelligent edits to a file on a remote WebDAV server with git-style diff preview",
    {
      path: z.string().min(1, "Path must not be empty"),
      edits: z.array(z.object({
        oldText: z.string().describe("Text to search for - must match exactly"),
        newText: z.string().describe("Text to replace with"),
      })).min(1, "At least one edit must be provided"),
      dryRun: z.boolean().optional().default(false).describe(
        "Preview changes using git-style diff format without applying them",
      ),
    },
    async ({ path, edits, dryRun }) => {
      try {
        // Check if file exists
        const exists = await webdavService.exists(path);
        if (!exists) {
          return {
            content: [{
              type: "text",
              text: `Error: File does not exist at ${path}`,
            }],
            isError: true,
          };
        }

        const diff = await webdavService.editFile(path, edits, dryRun);

        const message = dryRun
          ? `Preview of changes for ${path}:\n\n${diff}`
          : `File edited successfully at ${path}\n\n${diff}`;

        return {
          content: [{
            type: "text",
            text: message,
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error editing file: ${(error as Error).message}`,
          }],
          isError: true,
        };
      }
    },
  );

  // Delete file or directory tool
  server.tool(
    "webdav_delete_remote_item",
    "Delete a file or directory from a remote WebDAV server",
    {
      path: z.string().min(1, "Path must not be empty"),
    },
    async ({ path }) => {
      try {
        // Check if path exists
        const exists = await webdavService.exists(path);
        if (!exists) {
          return {
            content: [{
              type: "text",
              text: `Error: Path does not exist at ${path}`,
            }],
            isError: true,
          };
        }

        await webdavService.delete(path);

        return {
          content: [{
            type: "text",
            text: `Successfully deleted ${path}`,
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error deleting: ${(error as Error).message}`,
          }],
          isError: true,
        };
      }
    },
  );

  // Create directory tool
  server.tool(
    "webdav_create_remote_directory",
    "Create a new directory on a remote WebDAV server",
    {
      path: z.string().min(1, "Path must not be empty"),
    },
    async ({ path }) => {
      try {
        await webdavService.createDirectory(path);

        return {
          content: [{
            type: "text",
            text: `Directory created successfully at ${path}`,
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error creating directory: ${(error as Error).message}`,
          }],
          isError: true,
        };
      }
    },
  );

  // Move/rename file or directory tool
  server.tool(
    "webdav_move_remote_item",
    "Move or rename a file or directory on a remote WebDAV server",
    {
      fromPath: z.string().min(1, "Source path must not be empty"),
      toPath: z.string().min(1, "Destination path must not be empty"),
      overwrite: z.boolean().optional().default(false),
    },
    async ({ fromPath, toPath, overwrite }) => {
      try {
        // Check if source exists
        const sourceExists = await webdavService.exists(fromPath);
        if (!sourceExists) {
          return {
            content: [{
              type: "text",
              text: `Error: Source path does not exist at ${fromPath}`,
            }],
            isError: true,
          };
        }

        // Check if destination exists and respect overwrite flag
        const destExists = await webdavService.exists(toPath);
        if (destExists && !overwrite) {
          return {
            content: [{
              type: "text",
              text:
                `Error: Destination already exists at ${toPath}. Use overwrite=true to replace it.`,
            }],
            isError: true,
          };
        }

        await webdavService.move(fromPath, toPath);

        return {
          content: [{
            type: "text",
            text: `Successfully moved ${fromPath} to ${toPath}`,
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error moving: ${(error as Error).message}`,
          }],
          isError: true,
        };
      }
    },
  );

  // Copy file or directory tool
  server.tool(
    "webdav_copy_remote_item",
    "Copy a file or directory to a new location on a remote WebDAV server",
    {
      fromPath: z.string().min(1, "Source path must not be empty"),
      toPath: z.string().min(1, "Destination path must not be empty"),
      overwrite: z.boolean().optional().default(false),
    },
    async ({ fromPath, toPath, overwrite }) => {
      try {
        // Check if source exists
        const sourceExists = await webdavService.exists(fromPath);
        if (!sourceExists) {
          return {
            content: [{
              type: "text",
              text: `Error: Source path does not exist at ${fromPath}`,
            }],
            isError: true,
          };
        }

        // Check if destination exists and respect overwrite flag
        const destExists = await webdavService.exists(toPath);
        if (destExists && !overwrite) {
          return {
            content: [{
              type: "text",
              text:
                `Error: Destination already exists at ${toPath}. Use overwrite=true to replace it.`,
            }],
            isError: true,
          };
        }

        await webdavService.copy(fromPath, toPath);

        return {
          content: [{
            type: "text",
            text: `Successfully copied ${fromPath} to ${toPath}`,
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error copying: ${(error as Error).message}`,
          }],
          isError: true,
        };
      }
    },
  );

  // List directory tool
  server.tool(
    "webdav_list_remote_directory",
    "List files and directories at the specified path on a remote WebDAV server",
    {
      path: z.string().optional().default("/"),
    },
    async ({ path }) => {
      try {
        const files = await webdavService.list(path);

        // Format response
        const formattedFiles = files.map((file) => ({
          name: file.basename,
          path: file.filename,
          type: file.type,
          size: file.size,
          lastModified: file.lastmod,
        }));

        return {
          content: [{
            type: "text",
            text: JSON.stringify(formattedFiles, null, 2),
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error listing directory: ${(error as Error).message}`,
          }],
          isError: true,
        };
      }
    },
  );

  // Enhanced list directory with sizes and sorting
  server.tool(
    "webdav_list_directory_with_sizes",
    "List files and directories with sizes, sorting options, and statistics",
    {
      path: z.string().optional().default("/"),
      sortBy: z.enum(["name", "size"]).optional().default("name").describe(
        "Sort entries by name or size",
      ),
    },
    async ({ path, sortBy }) => {
      try {
        const files = await webdavService.list(path);

        // Get detailed information for each entry
        const detailedFiles = await Promise.all(
          files.map(async (file) => {
            try {
              const stats = await webdavService.stat(file.filename);
              return {
                name: file.basename,
                path: file.filename,
                type: file.type,
                size: stats.size || 0,
                lastModified: stats.lastmod,
              };
            } catch (error) {
              return {
                name: file.basename,
                path: file.filename,
                type: file.type,
                size: 0,
                lastModified: file.lastmod,
              };
            }
          }),
        );

        // Sort entries based on sortBy parameter
        const sortedFiles = [...detailedFiles].sort((a, b) => {
          if (sortBy === "size") {
            return b.size - a.size; // Descending by size
          }
          // Default sort by name
          return a.name.localeCompare(b.name);
        });

        // Format the output
        const formattedFiles = sortedFiles.map((file) =>
          `${file.type === "directory" ? "[DIR]" : "[FILE]"} ${
            file.name.padEnd(30)
          } ${file.type === "file" ? formatSize(file.size).padStart(10) : ""}`
        );

        // Add summary
        const totalFiles = detailedFiles.filter((f) =>
          f.type === "file"
        ).length;
        const totalDirs = detailedFiles.filter((f) =>
          f.type === "directory"
        ).length;
        const totalSize = detailedFiles.reduce(
          (sum, file) => sum + (file.type === "file" ? file.size : 0),
          0,
        );

        const summary = [
          "",
          `Total: ${totalFiles} files, ${totalDirs} directories`,
          `Combined size: ${formatSize(totalSize)}`,
        ];

        return {
          content: [{
            type: "text",
            text: [...formattedFiles, ...summary].join("\n"),
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error listing directory: ${(error as Error).message}`,
          }],
          isError: true,
        };
      }
    },
  );

  // Search files tool
  server.tool(
    "webdav_search_files",
    "Search for files and directories using glob patterns with exclusion support",
    {
      path: z.string().optional().default("/").describe(
        "Starting directory for the search",
      ),
      pattern: z.string().describe(
        'Glob pattern to match files (e.g., "*.txt", "**/*.js", "config.*")',
      ),
      excludePatterns: z.array(z.string()).optional().default([]).describe(
        "Array of glob patterns to exclude from search results",
      ),
    },
    async ({ path, pattern, excludePatterns }) => {
      try {
        const results = await webdavService.searchFiles(
          path,
          pattern,
          excludePatterns,
        );

        const message = results.length > 0
          ? `Found ${results.length} items matching "${pattern}":\n\n${
            results.join("\n")
          }`
          : `No items found matching "${pattern}"`;

        return {
          content: [{
            type: "text",
            text: message,
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error searching files: ${(error as Error).message}`,
          }],
          isError: true,
        };
      }
    },
  );

  // Directory tree tool
  server.tool(
    "webdav_get_directory_tree",
    "Get a recursive tree view of files and directories as a JSON structure",
    {
      path: z.string().optional().default("/").describe(
        "Root directory for the tree",
      ),
      excludePatterns: z.array(z.string()).optional().default([]).describe(
        "Array of glob patterns to exclude from the tree",
      ),
    },
    async ({ path, excludePatterns }) => {
      try {
        const tree = await webdavService.getDirectoryTree(
          path,
          excludePatterns,
        );

        return {
          content: [{
            type: "text",
            text: JSON.stringify(tree, null, 2),
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error getting directory tree: ${(error as Error).message}`,
          }],
          isError: true,
        };
      }
    },
  );

  // Read multiple files tool
  server.tool(
    "webdav_read_multiple_files",
    "Read the contents of multiple files simultaneously",
    {
      paths: z.array(z.string()).min(
        1,
        "At least one file path must be provided",
      ).describe("Array of file paths to read"),
    },
    async ({ paths }) => {
      try {
        const results = await webdavService.readMultipleFiles(paths);

        const formattedResults = results.map((result) => {
          if (result.error) {
            return `${result.path}: Error - ${result.error}`;
          } else {
            return `${result.path}:\n${result.content}\n`;
          }
        });

        return {
          content: [{
            type: "text",
            text: formattedResults.join("\n---\n"),
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error reading multiple files: ${(error as Error).message}`,
          }],
          isError: true,
        };
      }
    },
  );

  // Enhanced file info tool
  server.tool(
    "webdav_get_file_info",
    "Get detailed metadata about a file or directory",
    {
      path: z.string().min(1, "Path must not be empty"),
    },
    async ({ path }) => {
      try {
        const stats = await webdavService.stat(path);

        const info = {
          name: stats.basename,
          path: stats.filename,
          type: stats.type,
          size: stats.size || 0,
          sizeFormatted: formatSize(stats.size || 0),
          lastModified: stats.lastmod,
          mimeType: stats.mime,
        };

        return {
          content: [{
            type: "text",
            text: Object.entries(info)
              .map(([key, value]) => `${key}: ${value}`)
              .join("\n"),
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error getting file info: ${(error as Error).message}`,
          }],
          isError: true,
        };
      }
    },
  );

  // Range request tool
  server.tool(
    "webdav_range_request",
    "Read a specific byte range from a file on a remote WebDAV server (similar to HTTP 206 Partial Content)",
    {
      path: z.string().min(1, "Path must not be empty"),
      range: z.string().describe(
        'Byte range in format "bytes=0-499" (first 500 bytes), "bytes=500-" (from byte 500 to end), or "0-499" (range from start to end)',
      ),
    },
    async ({ path, range }) => {
      try {
        // Check if file exists first
        const exists = await webdavService.exists(path);
        if (!exists) {
          return {
            content: [{
              type: "text",
              text: `Error: File does not exist at ${path}`,
            }],
            isError: true,
          };
        }

        // Check if range requests are supported
        const supportsRanges = await webdavService.supportsRangeRequests(path);
        if (!supportsRanges) {
          return {
            content: [{
              type: "text",
              text:
                `Error: Range requests are not supported for this file or server`,
            }],
            isError: true,
          };
        }

        // Perform the range request
        const result = await webdavService.readFileWithRange(path, range);

        // Format the response similar to HTTP 206 response
        const response = [
          `=== HTTP 206 Partial Content Simulation ===`,
          `File: ${path}`,
          `Content-Range: ${result.contentRange}`,
          `Accept-Ranges: ${result.acceptRanges ? "bytes" : "none"}`,
          `Content-Length: ${result.content.length}`,
          `Total-Size: ${result.totalSize}`,
          `Range-Request: ${range}`,
          ``,
          `=== Content ===`,
          result.content,
        ].join("\n");

        return {
          content: [{
            type: "text",
            text: response,
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error performing range request: ${(error as Error).message}`,
          }],
          isError: true,
        };
      }
    },
  );
}

// Helper function to format file size
function formatSize(bytes: number): string {
  const units = ["B", "KB", "MB", "GB", "TB"];
  if (bytes === 0) return "0 B";

  const i = Math.floor(Math.log(bytes) / Math.log(1024));

  if (i < 0 || i === 0) return `${bytes} ${units[0]}`;

  const unitIndex = Math.min(i, units.length - 1);
  return `${(bytes / Math.pow(1024, unitIndex)).toFixed(2)} ${
    units[unitIndex]
  }`;
}
