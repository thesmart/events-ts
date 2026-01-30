#!/usr/bin/env -S deno run --allow-all

import { $ } from '@david/dax';
import {
  checkCwd,
  findRootDir,
  parseArguments,
  relativePath,
  resolvePath,
  validateRepoDir,
} from './src/common.ts';

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
  --check              Verify badges are up to date (exits non-zero if not)
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

  # Check if badges are up to date (for CI)
  ./badges.ts --tests=passing --coverage=97 --check

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

  // Validate and resolve output directory
  const outputDir = await validateRepoDir(
    params.output || '../static',
    { checkWritable: true },
  );

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
async function generateBadgeMarkdown(
  badges: Record<string, Badge>,
  outputDir: string,
  readmePath: string,
): Promise<string> {
  // Validate output directory is readable
  await validateRepoDir(outputDir, { checkReadable: true });

  const timestamp = Date.now();

  // Compute relative path from README directory to output directory
  const readmeDir = readmePath.substring(0, readmePath.lastIndexOf('/'));
  const relPath = relativePath(readmeDir, outputDir);

  // Validate badge files are readable
  const entries = Object.entries(badges);
  for (const [name, badge] of entries) {
    const badgePath = `${outputDir}/${badge.filename}`;
    try {
      await Deno.stat(badgePath);
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        throw new Error(
          `Badge file not found: ${badgePath}\n` +
            `Badge: ${name}`,
        );
      }
      throw new Error(
        `Cannot read badge file: ${badgePath}\n` +
          `Badge: ${name}`,
      );
    }
  }

  return entries
    .map(([_, badge]) => {
      const imgPath = `${relPath}/${badge.filename}?t=${timestamp}`;
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
 * Verify that existing badges match what would be generated.
 * Returns true if all badges are up to date, false otherwise.
 */
async function verifyBadges(
  badges: Record<string, Badge>,
  outputDir: string,
): Promise<boolean> {
  console.log('Verifying badges are up to date...');
  let allMatch = true;

  for (const [name, badge] of Object.entries(badges)) {
    const outputPath = `${outputDir}/${badge.filename}`;

    // Check if badge file exists
    try {
      await Deno.stat(outputPath);
    } catch {
      console.error(`  ❌ ${name}: Badge file not found: ${outputPath}`);
      allMatch = false;
      continue;
    }

    // Download expected badge content to compare
    const expectedContent = await (await fetch(badge.url)).text();

    // Read existing badge content
    const existingContent = await Deno.readTextFile(outputPath);

    // Compare content
    if (expectedContent !== existingContent) {
      console.error(`  ❌ ${name}: Badge is out of date`);
      console.error(`     Expected URL: ${badge.url}`);
      allMatch = false;
    } else {
      console.log(`  ✅ ${name}: Up to date`);
    }
  }

  return allMatch;
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

  // Generate badge definitions
  const badges = generateBadges(config);

  // Handle dry run mode
  if (flags.has('dryrun')) {
    printDryRun(badges, config);
  }

  // Handle check mode
  if (flags.has('check')) {
    const allMatch = await verifyBadges(badges, config.outputDir);
    if (allMatch) {
      console.log('\n✅ All badges are up to date!');
      Deno.exit(0);
    } else {
      console.error('\n❌ Some badges are out of date!');
      console.error('Run without --check to update them.');
      Deno.exit(1);
    }
  }

  // Download badges
  await downloadBadges(badges, config.outputDir);

  // Generate and update README
  const badgeMarkdown = await generateBadgeMarkdown(
    badges,
    config.outputDir,
    config.readmePath,
  );
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
