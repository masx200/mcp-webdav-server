import { WebDAVClient } from "webdav";
import { webdavConnectionPool } from "./webdav-connection-pool.js";
import { createLogger } from "../utils/logger.js";
import { minimatch } from "minimatch";

const logger = createLogger("WebDAVService");

// Define our own FileStat interface to match what we use in the application
export interface FileStat {
  filename: string;
  basename: string;
  lastmod?: string;
  size?: number;
  type: "file" | "directory";
  mime?: string;
  [key: string]: any;
}

// Define interfaces for response types
interface ResponseData {
  status?: number;
  data?: any;
  [key: string]: any;
}

export interface WebDAVConfig {
  rootUrl: string;
  rootPath: string;
  username?: string;
  password?: string;
  authEnabled?: boolean;
}

export class WebDAVService {
  private client: WebDAVClient;
  private rootPath: string;

  constructor(config: WebDAVConfig) {
    logger.debug("Initializing WebDAV service", {
      rootUrl: config.rootUrl,
      rootPath: config.rootPath,
    });

    // Determine if auth is enabled
    const authEnabled = Boolean(config.authEnabled) ||
      Boolean(config.username && config.password);

    // Get connection options
    const connectionOptions: any = {
      rootUrl: config.rootUrl,
      authEnabled,
      username: config.username,
      password: config.password,
    };

    // Get connection from pool
    this.client = webdavConnectionPool.getConnection(connectionOptions);
    this.rootPath = config.rootPath;

    logger.info("WebDAV service initialized", {
      rootUrl: config.rootUrl,
      rootPath: config.rootPath,
      authEnabled: authEnabled,
    });
  }

  /**
   * List files and directories at the specified path
   */
  async list(path: string = "/"): Promise<FileStat[]> {
    const fullPath = this.getFullPath(path);
    logger.debug(`Listing directory: ${fullPath}`);

    try {
      // In v5.x we need to handle the response differently
      const result = await this.client.getDirectoryContents(fullPath);

      // Convert the result to our FileStat interface
      const fileStats = Array.isArray(result)
        ? result.map((item) => this.convertToFileStat(item))
        : this.isResponseData(result) && Array.isArray(result.data)
        ? result.data.map((item) => this.convertToFileStat(item))
        : [];

      logger.debug(
        `Listed ${fileStats.length} items in directory: ${fullPath}`,
      );
      return fileStats;
    } catch (error) {
      logger.error(`Error listing directory ${fullPath}:`, error);
      throw new Error(`Failed to list directory: ${(error as Error).message}`);
    }
  }

  /**
   * Get file stats for a specific path
   */
  async stat(path: string): Promise<FileStat> {
    const fullPath = this.getFullPath(path);
    logger.debug(`Getting stats for: ${fullPath}`);

    try {
      const result = await this.client.stat(fullPath);

      // Convert the result to our FileStat interface
      const stats = this.convertToFileStat(
        this.isResponseData(result) ? result.data : result,
      );

      logger.debug(`Got stats for: ${fullPath}`, { type: stats.type });
      return stats;
    } catch (error) {
      logger.error(`Error getting stats for ${fullPath}:`, error);
      throw new Error(`Failed to get file stats: ${(error as Error).message}`);
    }
  }

  /**
   * Read file content as text
   */
  async readFile(path: string): Promise<string> {
    const fullPath = this.getFullPath(path);
    logger.debug(`Reading file: ${fullPath}`);

    try {
      // v5.x returns buffer by default, need to use format: 'text'
      const content = await this.client.getFileContents(fullPath, {
        format: "text",
      });

      // Handle both direct string response and detailed response
      let result: string;
      if (typeof content === "string") {
        result = content;
      } else if (this.isResponseData(content)) {
        result = String(content.data);
      } else {
        throw new Error("Unexpected response format from server");
      }

      const contentLength = result.length;
      logger.debug(`Read file: ${fullPath}`, { contentLength });
      return result;
    } catch (error) {
      logger.error(`Error reading file ${fullPath}:`, error);
      throw new Error(`Failed to read file: ${(error as Error).message}`);
    }
  }

  /**
   * Read file content as text with head/tail options
   */
  async readFileWithOptions(
    path: string,
    options: { head?: number; tail?: number } = {},
  ): Promise<string> {
    const fullPath = this.getFullPath(path);
    logger.debug(`Reading file with options: ${fullPath}`, options);

    try {
      // Get the full file content first
      const content = await this.readFile(path);

      // If no head or tail specified, return full content
      if (!options.head && !options.tail) {
        return content;
      }

      // Cannot specify both head and tail
      if (options.head && options.tail) {
        throw new Error(
          "Cannot specify both head and tail parameters simultaneously",
        );
      }

      // Split content into lines
      const lines = content.split("\n");

      if (options.head) {
        // Return first N lines
        const headLines = lines.slice(0, options.head);
        const result = headLines.join("\n");
        logger.debug(`Read head of file: ${fullPath}`, {
          lines: headLines.length,
          requestedLines: options.head,
        });
        return result;
      }

      if (options.tail) {
        // Return last N lines
        const tailLines = lines.slice(-options.tail);
        const result = tailLines.join("\n");
        logger.debug(`Read tail of file: ${fullPath}`, {
          lines: tailLines.length,
          requestedLines: options.tail,
        });
        return result;
      }

      // This should never be reached due to earlier checks
      return content;
    } catch (error) {
      logger.error(`Error reading file with options ${fullPath}:`, error);
      throw new Error(
        `Failed to read file with options: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Write content to a file
   */
  async writeFile(path: string, content: string | Buffer): Promise<void> {
    const fullPath = this.getFullPath(path);
    const contentLength = typeof content === "string"
      ? content.length
      : content.length;
    logger.debug(`Writing file: ${fullPath}`, { contentLength });

    try {
      // putFileContents in v5.x returns a boolean indicating success
      const result = await this.client.putFileContents(fullPath, content);

      // Check result based on type
      if (typeof result === "boolean" && !result) {
        throw new Error("Failed to write file: server returned failure status");
      } else if (
        this.isResponseData(result) &&
        result.status !== undefined &&
        result.status !== 201 &&
        result.status !== 204
      ) {
        throw new Error(
          `Failed to write file: server returned status ${result.status}`,
        );
      }

      logger.debug(`Successfully wrote file: ${fullPath}`);
    } catch (error) {
      logger.error(`Error writing to file ${fullPath}:`, error);
      throw new Error(`Failed to write file: ${(error as Error).message}`);
    }
  }

  /**
   * Apply intelligent edits to a file
   */
  async editFile(
    path: string,
    edits: Array<{ oldText: string; newText: string }>,
    dryRun: boolean = false,
  ): Promise<string> {
    const fullPath = this.getFullPath(path);
    logger.debug(`Editing file: ${fullPath}`, {
      numEdits: edits.length,
      dryRun,
    });

    try {
      // Read original content
      const originalContent = await this.readFile(path);
      let modifiedContent = originalContent;

      // Apply each edit
      for (const edit of edits) {
        const { oldText, newText } = edit;

        // Find the exact occurrence of oldText
        const index = modifiedContent.indexOf(oldText);
        if (index === -1) {
          throw new Error(
            `Text not found: "${oldText.substring(0, 50)}${
              oldText.length > 50 ? "..." : ""
            }"`,
          );
        }

        // Check for multiple matches
        const additionalMatches = modifiedContent.indexOf(oldText, index + 1);
        if (additionalMatches !== -1) {
          throw new Error(
            `Multiple matches found for text: "${oldText.substring(0, 50)}${
              oldText.length > 50 ? "..." : ""
            }"`,
          );
        }

        // Apply the edit
        modifiedContent = modifiedContent.substring(0, index) + newText +
          modifiedContent.substring(index + oldText.length);
      }

      // Generate diff
      const diff = this.generateDiff(originalContent, modifiedContent, path);

      if (!dryRun) {
        await this.writeFile(path, modifiedContent);
        logger.debug(`Successfully applied edits to file: ${fullPath}`);
      }

      return diff;
    } catch (error) {
      logger.error(`Error editing file ${fullPath}:`, error);
      throw new Error(`Failed to edit file: ${(error as Error).message}`);
    }
  }

  /**
   * Generate a git-style diff between original and modified content
   */
  private generateDiff(
    originalContent: string,
    modifiedContent: string,
    filePath: string,
  ): string {
    const originalLines = originalContent.split("\n");
    const modifiedLines = modifiedContent.split("\n");

    const diff: string[] = [];
    diff.push(`--- ${filePath}`);
    diff.push(`+++ ${filePath}`);

    // Simple diff implementation - find the first and last different lines
    let startLine = 0;
    let endLine = Math.max(originalLines.length, modifiedLines.length);

    // Find first different line
    while (
      startLine < Math.min(originalLines.length, modifiedLines.length) &&
      originalLines[startLine] === modifiedLines[startLine]
    ) {
      startLine++;
    }

    // Find last different line
    while (
      endLine > startLine &&
      endLine <= Math.min(originalLines.length, modifiedLines.length) &&
      originalLines[endLine - 1] === modifiedLines[endLine - 1]
    ) {
      endLine--;
    }

    const originalLength = Math.max(
      0,
      originalLines.length - startLine -
        Math.max(0, originalLines.length - endLine),
    );
    const modifiedLength = Math.max(
      0,
      modifiedLines.length - startLine -
        Math.max(0, modifiedLines.length - endLine),
    );

    if (originalLength > 0 || modifiedLength > 0) {
      diff.push(
        `@@ -${startLine + 1},${originalLength} +${
          startLine + 1
        },${modifiedLength} @@`,
      );

      // Add context and changes
      for (let i = startLine; i < endLine; i++) {
        if (i < originalLines.length && i < modifiedLines.length) {
          if (originalLines[i] === modifiedLines[i]) {
            diff.push(` ${originalLines[i]}`);
          } else {
            if (i < originalLines.length) {
              diff.push(`-${originalLines[i]}`);
            }
            if (i < modifiedLines.length) {
              diff.push(`+${modifiedLines[i]}`);
            }
          }
        } else if (i < originalLines.length) {
          diff.push(`-${originalLines[i]}`);
        } else if (i < modifiedLines.length) {
          diff.push(`+${modifiedLines[i]}`);
        }
      }
    } else {
      diff.push(
        `@@ -${originalLines.length + 1},0 +${modifiedLines.length + 1},0 @@`,
      );
    }

    return diff.join("\n");
  }

  /**
   * Create a directory
   */
  async createDirectory(path: string): Promise<void> {
    const fullPath = this.getFullPath(path);
    logger.debug(`Creating directory: ${fullPath}`);

    try {
      // createDirectory in v5.x returns a boolean indicating success
      const result = await this.client.createDirectory(fullPath);

      // Check result based on type
      if (typeof result === "boolean" && !result) {
        throw new Error(
          "Failed to create directory: server returned failure status",
        );
      } else if (
        this.isResponseData(result) &&
        result.status !== undefined &&
        result.status !== 201 &&
        result.status !== 204
      ) {
        throw new Error(
          `Failed to create directory: server returned status ${result.status}`,
        );
      }

      logger.debug(`Successfully created directory: ${fullPath}`);
    } catch (error) {
      logger.error(`Error creating directory ${fullPath}:`, error);
      throw new Error(
        `Failed to create directory: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Delete a file or directory
   */
  async delete(path: string): Promise<void> {
    const fullPath = this.getFullPath(path);
    logger.debug(`Deleting: ${fullPath}`);

    try {
      // Get type before deleting for better logging
      const stat = await this.stat(fullPath).catch(() => null);
      const itemType = stat?.type || "item";

      // deleteFile in v5.x returns a boolean indicating success
      const result = await this.client.deleteFile(fullPath);

      // Check result based on type
      if (typeof result === "boolean" && !result) {
        throw new Error("Failed to delete: server returned failure status");
      } else if (
        this.isResponseData(result) &&
        result.status !== undefined &&
        result.status !== 204
      ) {
        throw new Error(
          `Failed to delete: server returned status ${result.status}`,
        );
      }

      logger.debug(`Successfully deleted ${itemType}: ${fullPath}`);
    } catch (error) {
      logger.error(`Error deleting ${fullPath}:`, error);
      throw new Error(`Failed to delete: ${(error as Error).message}`);
    }
  }

  /**
   * Move/rename a file or directory
   */
  async move(fromPath: string, toPath: string): Promise<void> {
    const fullFromPath = this.getFullPath(fromPath);
    const fullToPath = this.getFullPath(toPath);
    logger.debug(`Moving from ${fullFromPath} to ${fullToPath}`);

    try {
      // Get type before moving for better logging
      const stat = await this.stat(fromPath).catch(() => null);
      const itemType = stat?.type || "item";

      // moveFile in v5.x returns a boolean indicating success
      const result = await this.client.moveFile(fullFromPath, fullToPath);

      // Check result based on type
      if (typeof result === "boolean" && !result) {
        throw new Error("Failed to move: server returned failure status");
      } else if (
        this.isResponseData(result) &&
        result.status !== undefined &&
        result.status !== 201 &&
        result.status !== 204
      ) {
        throw new Error(
          `Failed to move: server returned status ${result.status}`,
        );
      }

      logger.debug(
        `Successfully moved ${itemType} from ${fullFromPath} to ${fullToPath}`,
      );
    } catch (error) {
      logger.error(
        `Error moving from ${fullFromPath} to ${fullToPath}:`,
        error,
      );
      throw new Error(`Failed to move: ${(error as Error).message}`);
    }
  }

  /**
   * Copy a file or directory
   */
  async copy(fromPath: string, toPath: string): Promise<void> {
    const fullFromPath = this.getFullPath(fromPath);
    const fullToPath = this.getFullPath(toPath);
    logger.debug(`Copying from ${fullFromPath} to ${fullToPath}`);

    try {
      // Get type before copying for better logging
      const stat = await this.stat(fromPath).catch(() => null);
      const itemType = stat?.type || "item";

      // copyFile in v5.x returns a boolean indicating success
      const result = await this.client.copyFile(fullFromPath, fullToPath);

      // Check result based on type
      if (typeof result === "boolean" && !result) {
        throw new Error("Failed to copy: server returned failure status");
      } else if (
        this.isResponseData(result) &&
        result.status !== undefined &&
        result.status !== 201 &&
        result.status !== 204
      ) {
        throw new Error(
          `Failed to copy: server returned status ${result.status}`,
        );
      }

      logger.debug(
        `Successfully copied ${itemType} from ${fullFromPath} to ${fullToPath}`,
      );
    } catch (error) {
      logger.error(
        `Error copying from ${fullFromPath} to ${fullToPath}:`,
        error,
      );
      throw new Error(`Failed to copy: ${(error as Error).message}`);
    }
  }

  /**
   * Check if a file or directory exists
   */
  async exists(path: string): Promise<boolean> {
    const fullPath = this.getFullPath(path);
    logger.debug(`Checking if exists: ${fullPath}`);

    try {
      const result = await this.client.exists(fullPath);

      // Handle both boolean and object responses
      let exists = false;

      if (typeof result === "boolean") {
        exists = result;
      } else if (result && typeof result === "object") {
        // Use type guard for better type safety
        const responseData = result as ResponseData;
        if (responseData.status !== undefined) {
          exists = responseData.status < 400; // If status is less than 400, the resource exists
        }
      }

      logger.debug(`Exists check for ${fullPath}: ${exists}`);
      return exists;
    } catch (error) {
      logger.error(`Error checking existence of ${fullPath}:`, error);
      return false;
    }
  }

  /**
   * Type guard to check if an object is a ResponseData
   */
  private isResponseData(value: any): value is ResponseData {
    return value !== null &&
      typeof value === "object" &&
      "status" in value;
  }

  /**
   * Get the full path by combining root path with the provided path
   */
  private getFullPath(path: string): string {
    // Make sure path starts with / but not with //
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;

    // Combine root path with the provided path
    if (this.rootPath === "/") {
      return normalizedPath;
    }

    const rootWithoutTrailingSlash = this.rootPath.endsWith("/")
      ? this.rootPath.slice(0, -1)
      : this.rootPath;

    return `${rootWithoutTrailingSlash}${normalizedPath}`;
  }

  /**
   * Convert a WebDAV response to our FileStat interface
   */
  private convertToFileStat(item: any): FileStat {
    if (!item) {
      return {
        filename: "",
        basename: "",
        type: "file",
      };
    }

    return {
      filename: item.filename || item.href || "",
      basename: item.basename ||
        this.getBasenameFromPath(item.filename || item.href || ""),
      type: item.type ||
        (item.mime?.includes("directory") ? "directory" : "file"),
      size: item.size,
      lastmod: item.lastmod,
      mime: item.mime,
      ...item,
    };
  }

  /**
   * Extract basename from a path
   */
  private getBasenameFromPath(path: string): string {
    if (!path) return "";
    const parts = path.split("/").filter(Boolean);
    return parts[parts.length - 1] || "";
  }

  /**
   * Search for files and directories matching a pattern
   */
  async searchFiles(
    path: string = "/",
    pattern: string,
    excludePatterns: string[] = [],
  ): Promise<string[]> {
    const fullPath = this.getFullPath(path);
    logger.debug(`Searching for files: ${fullPath}`, {
      pattern,
      excludePatterns,
    });

    try {
      const results: string[] = [];
      await this._searchRecursive(
        fullPath,
        pattern,
        path,
        excludePatterns,
        results,
      );
      logger.debug(`Search completed: ${fullPath}`, {
        results: results.length,
      });
      return results;
    } catch (error) {
      logger.error(`Error searching files in ${fullPath}:`, error);
      throw new Error(`Failed to search files: ${(error as Error).message}`);
    }
  }

  /**
   * Recursive helper for searchFiles
   */
  private async _searchRecursive(
    currentPath: string,
    pattern: string,
    basePath: string,
    excludePatterns: string[],
    results: string[],
  ): Promise<void> {
    try {
      const items = await this.list(currentPath);

      for (const item of items) {
        const relativePath = item.filename.replace(
          this.rootPath === "/" ? "" : this.rootPath,
          "",
        );

        // Check if this item should be excluded
        const shouldExclude = excludePatterns.some((excludePattern) =>
          minimatch(relativePath, excludePattern, { dot: true })
        );

        if (shouldExclude) {
          continue;
        }

        // Check if this item matches the search pattern
        if (minimatch(relativePath, pattern, { dot: true })) {
          results.push(relativePath);
        }

        // If it's a directory, search recursively
        if (item.type === "directory") {
          await this._searchRecursive(
            item.filename,
            pattern,
            basePath,
            excludePatterns,
            results,
          );
        }
      }
    } catch (error) {
      logger.warn(`Warning: Could not access directory ${currentPath}:`, error);
    }
  }

  /**
   * Get directory tree structure
   */
  async getDirectoryTree(
    path: string = "/",
    excludePatterns: string[] = [],
  ): Promise<any> {
    const fullPath = this.getFullPath(path);
    logger.debug(`Getting directory tree: ${fullPath}`, { excludePatterns });

    try {
      const tree = await this._buildDirectoryTree(
        fullPath,
        path,
        excludePatterns,
      );
      logger.debug(`Directory tree built: ${fullPath}`);
      return tree;
    } catch (error) {
      logger.error(`Error getting directory tree ${fullPath}:`, error);
      throw new Error(
        `Failed to get directory tree: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Recursive helper for building directory tree
   */
  private async _buildDirectoryTree(
    currentPath: string,
    basePath: string,
    excludePatterns: string[],
  ): Promise<any[]> {
    try {
      const items = await this.list(currentPath);
      const tree: any[] = [];

      for (const item of items) {
        const relativePath = item.filename.replace(
          this.rootPath === "/" ? "" : this.rootPath,
          "",
        );

        // Check if this item should be excluded
        const shouldExclude = excludePatterns.some((excludePattern) =>
          minimatch(relativePath, excludePattern, { dot: true })
        );

        if (shouldExclude) {
          continue;
        }

        const node: any = {
          name: item.basename,
          type: item.type,
        };

        if (item.type === "directory") {
          node.children = await this._buildDirectoryTree(
            item.filename,
            basePath,
            excludePatterns,
          );
        }

        tree.push(node);
      }

      return tree;
    } catch (error) {
      logger.warn(`Warning: Could not access directory ${currentPath}:`, error);
      return [];
    }
  }

  /**
   * Read multiple files at once
   */
  async readMultipleFiles(
    paths: string[],
  ): Promise<{ path: string; content?: string; error?: string }[]> {
    logger.debug(`Reading multiple files`, { count: paths.length });

    const results = await Promise.allSettled(
      paths.map(async (path) => {
        try {
          const content = await this.readFile(path);
          return { path, content };
        } catch (error) {
          return {
            path,
            error: (error as Error).message,
          };
        }
      }),
    );

    const formattedResults = results.map((result) =>
      result.status === "fulfilled"
        ? result.value
        : { path: "", error: "Unknown error" }
    );

    logger.debug(`Multiple files read completed`, {
      success: formattedResults.filter((r) => !r.error).length,
      failed: formattedResults.filter((r) => r.error).length,
    });

    return formattedResults;
  }

  /**
   * Read file content with range request support using createReadStream
   */
  async readFileWithRange(
    path: string,
    range: string,
  ): Promise<{
    content: string;
    contentRange: string;
    acceptRanges: boolean;
    totalSize: number;
  }> {
    const fullPath = this.getFullPath(path);
    logger.debug(`Reading file with range: ${fullPath}`, { range });

    try {
      // Parse the range header
      const parsedRange = this.parseRangeHeader(range);
      if (!parsedRange) {
        throw new Error("Invalid range format");
      }

      // Get file stats first to check total size
      const stats = await this.stat(fullPath);
      const totalSize = stats.size || 0;

      // Validate range against file size
      if (parsedRange.start >= totalSize) {
        throw new Error(
          `Range start (${parsedRange.start}) is beyond file size (${totalSize})`,
        );
      }

      // Calculate actual end position
      const end = parsedRange.end === undefined
        ? totalSize - 1
        : Math.min(parsedRange.end, totalSize - 1);

      // Use createReadStream with range options
      const stream = this.client.createReadStream(fullPath, {
        range: {
          start: parsedRange.start,
          end: parsedRange.end,
        },
      });

      // Convert stream to string
      const chunks: Buffer[] = [];

      return new Promise((resolve, reject) => {
        stream.on("data", (chunk: Buffer) => {
          chunks.push(chunk);
        });

        stream.on("end", () => {
          try {
            const content = Buffer.concat(chunks).toString("utf8");
            const contentRange =
              `bytes ${parsedRange.start}-${end}/${totalSize}`;

            logger.debug(`Range request completed: ${fullPath}`, {
              range,
              contentLength: content.length,
              totalSize,
            });

            resolve({
              content,
              contentRange,
              acceptRanges: true,
              totalSize,
            });
          } catch (error) {
            reject(
              new Error(
                `Failed to process stream content: ${(error as Error).message}`,
              ),
            );
          }
        });

        stream.on("error", (error) => {
          logger.error(`Stream error for ${fullPath}:`, error);
          reject(new Error(`Stream error: ${error.message}`));
        });
      });
    } catch (error) {
      logger.error(`Error reading file with range ${fullPath}:`, error);
      throw new Error(
        `Failed to read file with range: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Parse HTTP Range header
   */
  private parseRangeHeader(range: string): {
    start: number;
    end?: number;
  } | null {
    // Remove "bytes=" prefix if present
    const rangeValue = range.replace(/^bytes=/i, "").trim();

    // Parse different range formats:
    // - "0-499": first 500 bytes
    // - "500-": bytes 500 to end
    // - "-500": last 500 bytes

    if (rangeValue.includes("-")) {
      const parts = rangeValue.split("-");
      const startPart = parts[0]?.trim();
      const endPart = parts[1]?.trim();

      // Case: "500-" (from byte 500 to end)
      if (startPart && !endPart) {
        const start = parseInt(startPart, 10);
        if (isNaN(start) || start < 0) return null;
        return { start };
      }

      // Case: "-500" (last 500 bytes)
      if (!startPart && endPart) {
        const suffixLength = parseInt(endPart, 10);
        if (isNaN(suffixLength) || suffixLength < 0) return null;
        // We can't handle suffix ranges without knowing file size
        // This will be handled at the caller level
        return null;
      }

      // Case: "0-499" (range from start to end)
      if (startPart && endPart) {
        const start = parseInt(startPart, 10);
        const end = parseInt(endPart, 10);
        if (isNaN(start) || isNaN(end) || start < 0 || end < 0 || start > end) {
          return null;
        }
        return { start, end };
      }
    }

    return null;
  }

  /**
   * Check if the server supports range requests
   */
  async supportsRangeRequests(path: string = "/"): Promise<boolean> {
    const fullPath = this.getFullPath(path);
    logger.debug(`Checking range request support for: ${fullPath}`);

    try {
      // For WebDAV servers, we'll assume range requests are supported
      // if we can successfully read file metadata
      const stats = await this.stat(fullPath);
      return true;
    } catch (error) {
      logger.debug(`Range request support check failed for ${fullPath}`, error);
      return false;
    }
  }
}
