/**
 * Common utilities for gate scripts.
 */

import { relative, resolve } from '@std/path';

export interface ParsedArgs {
  params: Record<string, string>;
  flags: Set<string>;
  positional: string[];
}

/**
 * Resolve a path relative to the current working directory.
 * Uses @std/path resolve for cross-platform path resolution.
 */
export function resolvePath(path: string): string {
  return resolve(path);
}

/**
 * Compute relative path from one location to another.
 * Uses @std/path relative for cross-platform path resolution.
 */
export function relativePath(from: string, to: string): string {
  return relative(from, to);
}

/**
 * Assert that a path exists and is a file.
 *
 * @throws Error if path doesn't exist, isn't readable, or isn't a file
 */
export function assertFile(path: string, errorMessage?: string): void {
  try {
    const stat = Deno.statSync(path);
    if (!stat.isFile) {
      throw new Error(errorMessage ?? `Path is not a file: ${path}`);
    }
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      throw new Error(errorMessage ?? `File does not exist: ${path}`);
    }
    if (error instanceof Deno.errors.PermissionDenied) {
      throw new Error(errorMessage ?? `Permission denied reading file: ${path}`);
    }
    throw error;
  }
}

/**
 * Assert that a path exists and is a directory.
 *
 * @throws Error if path doesn't exist, isn't readable, or isn't a directory
 */
export function assertDir(path: string, errorMessage?: string): void {
  try {
    const stat = Deno.statSync(path);
    if (!stat.isDirectory) {
      throw new Error(errorMessage ?? `Path is not a directory: ${path}`);
    }
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      throw new Error(errorMessage ?? `Directory does not exist: ${path}`);
    }
    if (error instanceof Deno.errors.PermissionDenied) {
      throw new Error(errorMessage ?? `Permission denied reading directory: ${path}`);
    }
    throw error;
  }
}
