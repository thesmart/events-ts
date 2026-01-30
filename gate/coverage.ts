#!/usr/bin/env -S deno run --allow-all

import { checkCwd, findRootDir, parseArguments, resolvePath } from './src/common.ts';

/**
 * Gate script for extracting coverage percentage from HTML report.
 *
 * Reads the coverage HTML report and extracts the Lines coverage percentage
 * from the "All files" section.
 *
 * Usage (must be run from ./gate folder):
 *   ./coverage.ts
 *   ./coverage.ts --report=../custom/.coverage/html/index.html
 *   ./coverage.ts --min=80
 *
 * Output:
 *   coverage=97
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
  ./coverage.ts [OPTIONS]

OPTIONAL PARAMETERS:
  --report=<path>    Path to coverage HTML report (default: ../.coverage/html/index.html)
  --min=<percent>    Minimum required coverage percentage (exits non-zero if below)

FLAGS:
  --help             Show this help message
  --require-yellow   Exit non-zero if below yellow threshold from deno.json
  --require-green    Exit non-zero if below green threshold from deno.json

EXAMPLES:
  # Using deno task
  deno task coverage

  # Direct execution
  ./coverage.ts

  # Require minimum coverage
  ./coverage.ts --min=80

  # Use yellow threshold from deno.json (80%)
  ./coverage.ts --require-yellow

  # Use green threshold from deno.json (95%)
  ./coverage.ts --require-green

  # Custom report path
  ./coverage.ts --report=../custom/.coverage/html/index.html

  # In CI/CD pipelines
  ./coverage.ts --require-yellow && echo "Coverage passed!"

OUTPUT:
  Prints "coverage=\${percentage}" where percentage is a rounded integer.
  Exits with code 0 if coverage meets threshold (or no threshold set).
  Exits with code 1 if coverage is below threshold.

NOTES:
  - This script must be run from the ./gate folder.
  - Reads thresholds from root deno.json (coverage.thresholds).
  - Useful for CI/CD pipelines to enforce minimum coverage requirements.
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
  const { params, flags } = parseArguments(Deno.args);

  // Handle help flag
  if (flags.has('help')) {
    showHelp();
  }

  // Check CWD
  await checkCwd();

  // Determine report path and load thresholds
  let reportPath: string;
  let thresholds = { green: 95, yellow: 80 }; // defaults

  const rootDir = await findRootDir();

  if (params.report) {
    reportPath = resolvePath(params.report);
  } else {
    reportPath = `${rootDir}/.coverage/html/index.html`;
  }

  // Load coverage thresholds from deno.json
  try {
    const denoJsonPath = `${rootDir}/deno.json`;
    const denoJson = JSON.parse(await Deno.readTextFile(denoJsonPath));
    if (denoJson.coverage?.thresholds) {
      thresholds = {
        green: denoJson.coverage.thresholds.green ?? 95,
        yellow: denoJson.coverage.thresholds.yellow ?? 80,
      };
    }
  } catch {
    // Use defaults if can't read thresholds
  }

  // Read the HTML report
  let html: string;
  try {
    html = await Deno.readTextFile(reportPath);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      throw new Error(
        `Coverage report not found: ${reportPath}\nRun tests with coverage first: deno task workflow-test && deno task workflow-coverage-report`,
      );
    }
    throw new Error(`Failed to read coverage report: ${error}`);
  }

  // Extract coverage percentage
  const coverage = extractCoveragePercentage(html);

  // Round to integer and output
  const roundedCoverage = Math.round(coverage);
  console.log(`coverage=${roundedCoverage}`);

  // Check threshold requirements
  let minRequired: number | null = null;

  if (params.min) {
    minRequired = parseInt(params.min, 10);
    if (isNaN(minRequired) || minRequired < 0 || minRequired > 100) {
      throw new Error(`Invalid --min value: ${params.min} (must be 0-100)`);
    }
  } else if (flags.has('require-green')) {
    minRequired = thresholds.green;
  } else if (flags.has('require-yellow')) {
    minRequired = thresholds.yellow;
  }

  if (minRequired !== null && roundedCoverage < minRequired) {
    console.error(
      `Coverage ${roundedCoverage}% is below required threshold ${minRequired}%`,
    );
    Deno.exit(1);
  }
}

// Run main function
await main();
