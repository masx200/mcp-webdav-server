/**
 * Utility functions for generating git-style diffs
 */

/**
 * Interface for edit operations
 */
export interface EditOperation {
  oldText: string;
  newText: string;
}

/**
 * Generate a git-style diff between original and modified content
 */
export function generateDiff(
  originalContent: string,
  modifiedContent: string,
  filePath: string = "file",
): string {
  const originalLines = originalContent.split("\n");
  const modifiedLines = modifiedContent.split("\n");

  const diff: string[] = [];
  diff.push(`--- ${filePath}`);
  diff.push(`+++ ${filePath}`);

  const chunks = generateDiffChunks(originalLines, modifiedLines);

  for (const chunk of chunks) {
    const contextLines = chunk.context || 3;
    const startLine = chunk.originalStart || 0;

    // Add chunk header
    const originalLength = chunk.originalLines?.length || 0;
    const modifiedLength = chunk.modifiedLines?.length || 0;
    diff.push(
      `@@ -${startLine + 1},${originalLength} +${
        startLine + 1
      },${modifiedLength} @@`,
    );

    // Add context and changes
    if (chunk.contextLines) {
      for (const line of chunk.contextLines) {
        diff.push(` ${line}`);
      }
    }

    if (chunk.originalLines) {
      for (const line of chunk.originalLines) {
        diff.push(`-${line}`);
      }
    }

    if (chunk.modifiedLines) {
      for (const line of chunk.modifiedLines) {
        diff.push(`+${line}`);
      }
    }
  }

  return diff.join("\n");
}

/**
 * Apply a series of edit operations to content and optionally generate diff
 */
export function applyEdits(
  originalContent: string,
  edits: EditOperation[],
  dryRun: boolean = false,
): { content: string; diff?: string } {
  let modifiedContent = originalContent;
  const diffs: string[] = [];

  for (const edit of edits) {
    const { oldText, newText } = edit;

    // Find all occurrences of oldText
    const occurrences: number[] = [];
    let index = modifiedContent.indexOf(oldText);
    while (index !== -1) {
      occurrences.push(index);
      index = modifiedContent.indexOf(oldText, index + 1);
    }

    if (occurrences.length === 0) {
      throw new Error(
        `Text not found: "${oldText.substring(0, 50)}${
          oldText.length > 50 ? "..." : ""
        }"`,
      );
    }

    if (occurrences.length > 1) {
      throw new Error(
        `Multiple matches found for text: "${oldText.substring(0, 50)}${
          oldText.length > 50 ? "..." : ""
        }"`,
      );
    }

    const occurrenceIndex = occurrences[0];
    const beforeText = modifiedContent.substring(0, occurrenceIndex);
    const afterText = modifiedContent.substring(
      occurrenceIndex + oldText.length,
    );

    modifiedContent = beforeText + newText + afterText;

    // Generate diff for this edit
    if (dryRun) {
      const editDiff = generateDiff(originalContent, modifiedContent, "file");
      diffs.push(editDiff);
    }
  }

  if (dryRun) {
    return {
      content: originalContent,
      diff: diffs.join("\n\n"),
    };
  }

  return { content: modifiedContent };
}

/**
 * Simple diff chunk generation
 */
interface DiffChunk {
  originalStart?: number;
  originalLines?: string[];
  modifiedLines?: string[];
  contextLines?: string[];
  context?: number;
}

function generateDiffChunks(
  originalLines: string[],
  modifiedLines: string[],
): DiffChunk[] {
  // Simple implementation - find first different line and create a chunk
  const chunks: DiffChunk[] = [];

  let i = 0;
  let j = 0;

  while (i < originalLines.length || j < modifiedLines.length) {
    if (
      i < originalLines.length && j < modifiedLines.length &&
      originalLines[i] === modifiedLines[j]
    ) {
      i++;
      j++;
    } else {
      // Found a difference, create a chunk
      const chunk: DiffChunk = {
        originalStart: i,
        originalLines: [],
        modifiedLines: [],
        contextLines: [],
        context: 3,
      };

      // Add context before
      const contextStart = Math.max(0, i - 3);
      for (let k = contextStart; k < i; k++) {
        chunk.contextLines!.push(originalLines[k]);
      }

      // Add different lines
      while (
        i < originalLines.length &&
        (j >= modifiedLines.length || originalLines[i] !== modifiedLines[j])
      ) {
        chunk.originalLines!.push(originalLines[i]);
        i++;
      }

      while (
        j < modifiedLines.length &&
        (i >= originalLines.length || originalLines[i] !== modifiedLines[j])
      ) {
        chunk.modifiedLines!.push(modifiedLines[j]);
        j++;
      }

      chunks.push(chunk);
    }
  }

  return chunks;
}
