#!/usr/bin/env -S deno run --allow-all

import { $ } from 'zx';
import { checkCwd, findRootDir, parseArguments, resolvePath } from './src/common.ts';

/**
 * Gate script for updating README badges.
 *
 * Downloads shield.io badge images and updates the README.md file
 * to reflect the current state of the project.
 *
 * Usage (must be run from ./gate folder):
 *   deno task badges -- --tests=passing --coverage=97
 *   ./badges.ts --tests=passing --coverage=97 --output=../static --dryrun
 *
 * @throws Error if required parameters are missing or invalid
 */

interface Badge {
  url: string;
  filename: string;
  alt: string;
  link: string;
}

interface BadgeConfig {
  testsStatus: string;
  coverage: number;
  license: string;
  outputDir: string;
  readmePath: string;
  thresholds: {
    green: number;
    yellow: number;
  };
}

/**
 * Display help message and exit.
 */
function showHelp(): never {
  console.log(`
Badge Generator - Updates README badges

USAGE:
  deno task badges -- --tests=<status> --coverage=<percent> [OPTIONS]
  ./badges.ts --tests=<status> --coverage=<percent> [OPTIONS]

REQUIRED PARAMETERS:
  --tests=<status>      Test status (passing, failing)
  --coverage=<percent>  Coverage percentage (0-100)

OPTIONAL PARAMETERS:
  --output=<path>       Output directory (default: ../static)
  --readme=<path>       Path to README.md (default: auto-detected from root)
  --license=<type>      License type (default: MIT)

FLAGS:
  --dryrun             Print URLs without downloading
  --help               Show this help message

EXAMPLES:
  # Using deno task
  deno task badges -- --tests=passing --coverage=97

  # Direct execution
  ./badges.ts --tests=passing --coverage=97

  # Dry run (shows what would happen without making changes)
  ./badges.ts --tests=passing --coverage=97 --dryrun

  # Custom output directory
  ./badges.ts --tests=passing --coverage=97 --output=../custom-badges

  # Custom README path
  ./badges.ts --tests=passing --coverage=97 --readme=../README.md

  # Failing tests with different coverage
  ./badges.ts --tests=failing --coverage=85

NOTES:
  - This script must be run from the ./gate folder.
  - Badge colors are based on thresholds from root deno.json
    (coverage.thresholds.green and coverage.thresholds.yellow).
  - README is automatically formatted with deno fmt after updates.
  - Badge URLs include cache-busting timestamps to prevent stale images.
`);
  Deno.exit(0);
}

/**
 * Validate and extract required parameters.
 */
async function validateParameters(
  params: Record<string, string>,
): Promise<BadgeConfig> {
  if (!params.tests) {
    throw new Error(
      'Missing required parameter: --tests (e.g., passing, failing)',
    );
  }
  if (!params.coverage) {
    throw new Error('Missing required parameter: --coverage (e.g., 97)');
  }

  // Find README path and load deno.json
  let readmePath: string;
  let thresholds = { green: 95, yellow: 80 }; // defaults

  if (params.readme) {
    readmePath = resolvePath(params.readme);
  } else {
    // Auto-detect by finding root deno.json
    const rootDir = await findRootDir();
    readmePath = `${rootDir}/README.md`;

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
  }

  const outputDir = params.output ? resolvePath(params.output) : resolvePath('../static');

  return {
    testsStatus: params.tests,
    coverage: parseInt(params.coverage, 10),
    license: params.license || 'MIT',
    outputDir,
    readmePath,
    thresholds,
  };
}

/**
 * Check if output directory is writable.
 */
async function checkOutputDir(dir: string): Promise<void> {
  try {
    await Deno.mkdir(dir, { recursive: true });

    const testFile = `${dir}/.write-test-${Date.now()}`;
    try {
      await Deno.writeTextFile(testFile, 'test');
      await Deno.remove(testFile);
    } catch {
      throw new Error(`Output directory is not writable: ${dir}`);
    }
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to access output directory: ${dir}`);
  }
}

/**
 * Determine badge color based on status and value.
 */
function getBadgeColor(
  type: 'tests' | 'coverage',
  value: string | number,
  thresholds?: { green: number; yellow: number },
): string {
  if (type === 'tests') {
    return value === 'passing' ? 'green' : 'red';
  }

  const coverageValue = typeof value === 'number' ? value : parseInt(String(value), 10);
  const greenThreshold = thresholds?.green ?? 95;
  const yellowThreshold = thresholds?.yellow ?? 80;
  return coverageValue >= greenThreshold
    ? 'green'
    : coverageValue >= yellowThreshold
    ? 'yellow'
    : 'red';
}

/**
 * URL-encode a string for use in shield.io URLs.
 */
function urlEncode(str: string): string {
  return encodeURIComponent(str);
}

/**
 * Generate badge definitions with URLs and metadata.
 */
function generateBadges(config: BadgeConfig): Record<string, Badge> {
  const testsColor = getBadgeColor('tests', config.testsStatus);
  const coverageColor = getBadgeColor('coverage', config.coverage);

  return {
    tests: {
      url: `https://img.shields.io/badge/tests-${urlEncode(config.testsStatus)}-${testsColor}`,
      filename: 'badge-tests.svg',
      alt: 'Tests',
      link: 'https://github.com/thesmart/events-ts',
    },
    coverage: {
      url: `https://img.shields.io/badge/coverage-${
        urlEncode(`${config.coverage}%`)
      }-${coverageColor}`,
      filename: 'badge-coverage.svg',
      alt: 'Test Coverage',
      link: 'https://github.com/thesmart/events-ts/.coverage/html/index.html',
    },
    license: {
      url: 'https://img.shields.io/github/license/thesmart/events-ts',
      filename: 'badge-license.svg',
      alt: 'License',
      link: 'https://github.com/thesmart/events-ts/blob/main/LICENSE',
    },
  };
}

/**
 * Print dry run information and exit.
 */
function printDryRun(
  badges: Record<string, Badge>,
  config: BadgeConfig,
): never {
  console.log('🔍 Dry run mode - Badge URLs:');
  console.log('');

  for (const [name, badge] of Object.entries(badges)) {
    console.log(`${name}:`);
    console.log(`  URL: ${badge.url}`);
    console.log(`  Would save to: ${config.outputDir}/${badge.filename}`);
    console.log('');
  }

  console.log('Parameters:');
  console.log(`  Tests: ${config.testsStatus}`);
  console.log(`  Coverage: ${config.coverage}%`);
  console.log(`  License: ${config.license}`);
  console.log(`  Output: ${config.outputDir}`);
  console.log(`  README: ${config.readmePath}`);

  Deno.exit(0);
}

/**
 * Download badge images to the output directory.
 */
async function downloadBadges(
  badges: Record<string, Badge>,
  outputDir: string,
): Promise<void> {
  console.log('Downloading badge images...');

  for (const [name, badge] of Object.entries(badges)) {
    const outputPath = `${outputDir}/${badge.filename}`;
    console.log(`  ${name}: ${badge.url} -> ${outputPath}`);
    await $`curl -s -o ${outputPath} ${badge.url}`;
  }
}

/**
 * Generate markdown for badge images with cache busting.
 */
function generateBadgeMarkdown(badges: Record<string, Badge>): string {
  const timestamp = Date.now();
  return Object.values(badges)
    .map((badge) => {
      const imgPath = `./static/${badge.filename}?t=${timestamp}`;
      return `[![${badge.alt}](${imgPath})](${badge.link})`;
    })
    .join('\n');
}

/**
 * Update README.md with new badge markdown.
 */
async function updateReadme(
  badgeMarkdown: string,
  readmePath: string,
): Promise<void> {
  const readmeContent = await Deno.readTextFile(readmePath);

  const badgesStart = '<!-- BADGES:START -->';
  const badgesEnd = '<!-- BADGES:END -->';

  const badgesRegex = new RegExp(`${badgesStart}[\\s\\S]*?${badgesEnd}`, 'g');

  const newReadmeContent = readmeContent.replace(
    badgesRegex,
    `${badgesStart}\n${badgeMarkdown}\n${badgesEnd}`,
  );

  await Deno.writeTextFile(readmePath, newReadmeContent);

  // Format the README with deno fmt
  await $`deno fmt ${readmePath}`;
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

  // Validate and extract parameters
  const config = await validateParameters(params);

  // Check output directory (skip in dryrun)
  if (!flags.has('dryrun')) {
    await checkOutputDir(config.outputDir);
  }

  // Generate badge definitions
  const badges = generateBadges(config);

  // Handle dry run mode
  if (flags.has('dryrun')) {
    printDryRun(badges, config);
  }

  // Download badges
  await downloadBadges(badges, config.outputDir);

  // Generate and update README
  const badgeMarkdown = generateBadgeMarkdown(badges);
  await updateReadme(badgeMarkdown, config.readmePath);

  // Success message
  console.log('\n✓ Badges updated successfully!');
  console.log(`  Tests: ${config.testsStatus}`);
  console.log(`  Coverage: ${config.coverage}%`);
  console.log(`  License: ${config.license}`);
  console.log(`  Output: ${config.outputDir}`);
  console.log(`  README: ${config.readmePath}`);
}

// Run main function
await main();
