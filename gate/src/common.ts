/**
 * Common utilities for gate scripts.
 */

import { resolve } from '@std/path';

export interface ParsedArgs {
  params: Record<string, string>;
  flags: Set<string>;
}

/**
 * Check that the script is being run from the gate folder.
 * @throws Error if not running from gate folder
 */
export async function checkCwd(): Promise<void> {
  try {
    const denoJson = JSON.parse(await Deno.readTextFile('./deno.json'));
    if (denoJson.name !== 'event-ts-gates') {
      throw new Error(
        'This script must be run from the gate folder. Current deno.json name: ' +
          (denoJson.name || 'undefined'),
      );
    }
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      throw new Error(
        'deno.json not found. This script must be run from the gate folder.',
      );
    }
    throw error;
  }
}

/**
 * Find the root directory by searching for deno.json with name "events-ts".
 * Traverses up from current directory until found.
 */
export async function findRootDir(): Promise<string> {
  let currentPath = Deno.cwd();
  const maxDepth = 10;
  let depth = 0;

  while (depth < maxDepth) {
    try {
      const denoJsonPath = `${currentPath}/deno.json`;
      const denoJson = JSON.parse(await Deno.readTextFile(denoJsonPath));

      if (denoJson.name === 'events-ts') {
        return currentPath;
      }
    } catch {
      // File doesn't exist or isn't valid JSON, keep searching
    }

    // Move up one directory
    const parentPath = `${currentPath}/..`;
    const resolvedParent = await Deno.realPath(parentPath);

    // Check if we've reached the root
    if (resolvedParent === currentPath) {
      break;
    }

    currentPath = resolvedParent;
    depth++;
  }

  throw new Error(
    'Could not find root deno.json with name "events-ts". Make sure you are running this from within the project.',
  );
}

/**
 * Parse command line arguments into params and flags.
 */
export function parseArguments(args: string[]): ParsedArgs {
  const params: Record<string, string> = {};
  const flags = new Set<string>();

  for (const arg of args) {
    if (arg.startsWith('--')) {
      const equalsIndex = arg.indexOf('=');
      if (equalsIndex === -1) {
        flags.add(arg.slice(2));
      } else {
        const key = arg.slice(2, equalsIndex);
        const value = arg.slice(equalsIndex + 1);
        if (key && value) {
          params[key] = value;
        }
      }
    }
  }

  return { params, flags };
}

/**
 * Resolve a path relative to the current working directory.
 * Uses @std/path resolve for cross-platform path resolution.
 */
export function resolvePath(path: string): string {
  return resolve(path);
}
