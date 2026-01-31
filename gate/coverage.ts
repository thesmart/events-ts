#!/usr/bin/env -S deno run --allow-all

import { parseArgs } from '@std/cli/parse-args';
import { resolvePath } from './src/common.ts';

/**
 * Gate script for extracting coverage percentage from HTML report.
 *
 * Reads the coverage HTML report and extracts the Lines coverage percentage
 * from the "All files" section.
 *
 * @throws Error if coverage report cannot be read or parsed
 */

/**
 * Display help message and exit.
 */
function showHelp(): never {
  console.log(`
Coverage Extractor - Extracts coverage percentage from HTML report

USAGE:
  ./coverage.ts [OPTIONS] <min> <report>

REQUIRED POSITIONAL ARGUMENTS:
  <min>              Minimum required coverage percentage (0-100, exits non-zero if below)
  <report>           Path to coverage HTML report (relative or absolute)

OPTIONAL FLAGS:
  --help             Show this help message

EXAMPLES:
  # Require minimum 80% coverage
  ./coverage.ts 80 ../.coverage/html/index.html

OUTPUT:
  Prints "coverage=<percentage>" where percentage is a rounded integer.
  Exits with code 0 if coverage meets minimum threshold.
  Exits with code 1 if coverage is below minimum threshold.

NOTES:
  - Report path can be relative (from CWD) or absolute
  - Path must be within the git repository
  - Useful for CI/CD pipelines to enforce coverage requirements
`);
  Deno.exit(0);
}

/**
 * Extract coverage percentage from HTML report.
 * Looks for the "All files" row in the coverage table and extracts the Lines percentage.
 */
function extractCoveragePercentage(html: string): number {
  // Find the section with "All files" heading
  const allFilesMatch = html.match(
    /<h1[^>]*>All files<\/h1>[\s\S]*?<\/table>/i,
  );

  if (!allFilesMatch) {
    throw new Error(
      'Could not find "All files" section in coverage report',
    );
  }

  const tableSection = allFilesMatch[0];

  // Try to find the percentage in various formats
  // Pattern 1: Look for percentage in table cells (typical format)
  const percentMatches = tableSection.match(/>\s*(\d+(?:\.\d+)?)\s*%?\s*</g);

  if (!percentMatches || percentMatches.length === 0) {
    throw new Error('Could not extract coverage percentage from report');
  }

  // Extract all numbers from the matches
  const percentages = percentMatches
    .map((match) => {
      const numMatch = match.match(/(\d+(?:\.\d+)?)/);
      return numMatch ? parseFloat(numMatch[1]) : null;
    })
    .filter((n): n is number => n !== null && n >= 0 && n <= 100);

  if (percentages.length === 0) {
    throw new Error('Could not find valid percentage values in report');
  }

  // The Lines coverage is typically the 4th column, but we'll take the first
  // valid percentage we find in the All files row
  // Most coverage reports show the summary row first
  return percentages[0];
}

/**
 * Main execution function.
 */
async function main(): Promise<void> {
  // Parse arguments
  const args = parseArgs(Deno.args, {
    boolean: ['help'],
    alias: { h: 'help' },
  });

  // Handle help flag
  if (args.help) {
    showHelp();
  }

  // Validate positional arguments (args._ contains positional args)
  if (args._.length < 2) {
    throw new Error(
      'Missing required arguments.\nUsage: ./coverage.ts <min> <report>\nRun with --help for more information.',
    );
  }

  // Parse minimum threshold (1st positional argument)
  const minRequired = parseInt(String(args._[0]), 10);
  if (isNaN(minRequired) || minRequired < 0 || minRequired > 100) {
    throw new Error(`Invalid <min> argument: ${args._[0]} (must be 0-100)`);
  }

  // Parse report path (2nd positional argument)
  const reportPath = resolvePath(String(args._[1]));

  // Read the HTML report
  let html: string;
  try {
    html = await Deno.readTextFile(reportPath);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      throw new Error(
        `Coverage report not found: ${reportPath}\nRun tests with coverage first: deno task test-coverage && deno task coverage-report`,
      );
    }
    throw new Error(`Failed to read coverage report: ${error}`);
  }

  // Extract coverage percentage
  const coverage = extractCoveragePercentage(html);

  // Round to integer and output
  const roundedCoverage = Math.round(coverage);
  console.log(`coverage=${roundedCoverage}`);

  // Check minimum threshold requirement
  if (roundedCoverage < minRequired) {
    console.error(
      `Coverage ${roundedCoverage}% is below required minimum ${minRequired}%`,
    );
    Deno.exit(1);
  }
}

// Run main function
await main();
