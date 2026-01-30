#!/usr/bin/env -S deno run --allow-all

import { checkCwd, findRootDir, parseArguments, resolvePath } from './src/common.ts';

/**
 * Gate script for checking external dependencies.
 *
 * Validates that src/event-target.ts does not import any non-native,
 * non-built-in dependencies (jsr, node, npm, etc).
 *
 * Usage (must be run from ./gate folder):
 *   ./deps.ts
 *   ./deps.ts --file=../src/custom.ts
 *   ./deps.ts --verbose
 *
 * @throws Error if external dependencies are found
 */

interface DepCheckResult {
  hasExternalDeps: boolean;
  violations: string[];
  filePath: string;
}

/**
 * Display help message and exit.
 */
function showHelp(): never {
  console.log(`
Dependency Checker - Validates no external dependencies in source files

USAGE:
  ./deps.ts [OPTIONS]

OPTIONAL PARAMETERS:
  --file=<path>    Path to file to check (default: ../src/event-target.ts)

FLAGS:
  --help           Show this help message
  --verbose        Show detailed output including all imports found

EXAMPLES:
  # Using deno task
  deno task deps

  # Direct execution (checks ../src/event-target.ts by default)
  ./deps.ts

  # Check with verbose output
  ./deps.ts --verbose

  # Check a different file
  ./deps.ts --file=../src/custom.ts

OUTPUT:
  Exits with code 0 if no external dependencies found
  Exits with code 1 if external dependencies are found

EXTERNAL DEPENDENCY PATTERNS:
  - jsr:      JSR imports (e.g., jsr:@std/assert)
  - npm:      NPM imports (e.g., npm:zx)
  - node:     Node imports (e.g., node:fs)
  - http(s):  URL imports (e.g., https://deno.land/...)
  - @         Scoped packages (e.g., @std/assert)

NOTES:
  - This script must be run from the ./gate folder.
  - Useful for ensuring core library files remain dependency-free.
  - Can be integrated into CI/CD pipelines to prevent accidental dependencies.
`);
  Deno.exit(0);
}

/**
 * Check if an import statement is an external dependency.
 * Returns true if the import is from jsr, npm, node, http(s), or uses @ scope.
 */
function isExternalDependency(importStatement: string): boolean {
  // Match: from 'xxx' or from "xxx"
  const fromMatch = importStatement.match(/from\s+['"](.*?)['"]/);
  if (!fromMatch) {
    return false;
  }

  const importPath = fromMatch[1];

  // Check for external dependency patterns
  const externalPatterns = [
    /^jsr:/, // JSR imports
    /^npm:/, // NPM imports
    /^node:/, // Node imports
    /^https?:\/\//, // URL imports
    /^@/, // Scoped packages (e.g., @std/assert)
  ];

  return externalPatterns.some((pattern) => pattern.test(importPath));
}

/**
 * Extract all import statements from source code.
 */
function extractImports(content: string): string[] {
  const imports: string[] = [];

  // Match single-line imports: import ... from '...'
  const singleLineRegex = /import\s+(?:{[^}]*}|[^;]+)\s+from\s+['"][^'"]+['"]/g;
  const singleLineMatches = content.match(singleLineRegex);
  if (singleLineMatches) {
    imports.push(...singleLineMatches);
  }

  // Match multi-line imports
  const multiLineRegex = /import\s+{[^}]*}\s+from\s+['"][^'"]+['"]/gs;
  const multiLineMatches = content.match(multiLineRegex);
  if (multiLineMatches) {
    imports.push(...multiLineMatches);
  }

  return imports;
}

/**
 * Check a file for external dependencies.
 */
async function checkFile(
  filePath: string,
  verbose: boolean,
): Promise<DepCheckResult> {
  const content = await Deno.readTextFile(filePath);
  const imports = extractImports(content);
  const violations: string[] = [];

  if (verbose) {
    console.log(`\nChecking: ${filePath}`);
    console.log(`Found ${imports.length} import(s)\n`);
  }

  for (const importStatement of imports) {
    if (isExternalDependency(importStatement)) {
      violations.push(importStatement);
      if (verbose) {
        console.log(`❌ External: ${importStatement.trim()}`);
      }
    } else if (verbose) {
      console.log(`✅ Native:   ${importStatement.trim()}`);
    }
  }

  return {
    hasExternalDeps: violations.length > 0,
    violations,
    filePath,
  };
}

/**
 * Main execution function.
 */
async function main(): Promise<void> {
  // Parse arguments
  const { params, flags } = parseArguments(Deno.args);

  // Handle help flag
  if (flags.has('help')) {
    showHelp();
  }

  // Check CWD
  await checkCwd();

  // Determine file path
  const rootDir = await findRootDir();
  const filePath = params.file ? resolvePath(params.file) : `${rootDir}/src/event-target.ts`;
  const verbose = flags.has('verbose');

  // Check if file exists
  try {
    await Deno.stat(filePath);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      throw new Error(`File not found: ${filePath}`);
    }
    throw error;
  }

  // Check the file
  const result = await checkFile(filePath, verbose);

  // Report results
  if (result.hasExternalDeps) {
    console.error(`\n❌ External dependencies found in ${result.filePath}:`);
    for (const violation of result.violations) {
      console.error(`   ${violation.trim()}`);
    }
    console.error(
      '\nError: event-target.ts must not import external dependencies',
    );
    Deno.exit(1);
  } else {
    console.log(`✅ No external dependencies found in ${result.filePath}`);
  }
}

// Run main function
await main();
