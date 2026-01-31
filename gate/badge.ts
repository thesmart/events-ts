#!/usr/bin/env -S deno run --allow-all

import { parseArgs } from '@std/cli/parse-args';
import { assertFile } from './src/common.ts';

/**
 * Simplified badge generator - generates one badge at a time.
 *
 * Usage:
 *   ./badge.ts <command> [OPTIONS]
 *
 * Commands:
 *   tests      Generate test status badge
 *   coverage   Generate coverage badge
 *   license    Generate license badge
 */

/**
 * Display help message and exit.
 */
function showHelp(): never {
  console.log(`
Badge Generator - Generate individual badges

USAGE:
  ./badge.ts <command> [OPTIONS]

COMMANDS:
  tests                 Generate test status badge
  coverage              Generate coverage badge
  license               Generate license badge
  markdown              Insert or update badges in markdown file

TESTS COMMAND:
  ./badge.ts tests --status=<value>

  OPTIONS:
    --status=<value>    Test status (passing, failing)
    --download          Download badge to stdout (URL goes to stderr)
    --help              Show this help message

COVERAGE COMMAND:
  ./badge.ts coverage --percent=<value>

  OPTIONS:
    --percent=<value>   Coverage percentage (0-100)
    --thresholds=<tuple> Coverage thresholds as "red,green" (default: 70,90)
    --download          Download badge to stdout (URL goes to stderr)
    --help              Show this help message

LICENSE COMMAND:
  ./badge.ts license --type=<value>

  OPTIONS:
    --type=<value>      License type (e.g. MIT, Apache-2.0)
    --download          Download badge to stdout (URL goes to stderr)
    --help              Show this help message

MARKDOWN COMMAND:
  ./badge.ts markdown [--append|--replace] --img-src=<path> [OPTIONS] <file>

  REQUIRED OPTIONS:
    --img-src=<path>    Relative path to badge image (from markdown file location)

  MODE OPTIONS:
    --append            Append badge to badges section
    --replace           Replace badges section with this badge

  OPTIONAL OPTIONS:
    --alt=<text>        Alternative text for badge image
    --link=<url>        URL that the badge should link to
    --help              Show this help message

  NOTES:
    - Formats badge as markdown image: ![alt](img-src)
    - If --link is provided, wraps as clickable link: [![alt](img-src)](link)
    - Manages content between <!-- BADGES:START --> and <!-- BADGES:END -->
    - If tags don't exist, inserts them 2 lines below first heading (^# )
    - If no heading exists, inserts at top of file
    - Exactly one of --append or --replace must be specified

EXAMPLES:
  # Output test badge URL
  ./badge.ts tests --status=passing

  # Download test badge
  ./badge.ts tests --status=passing --download > badge-tests.svg

  # Output coverage badge URL with custom thresholds
  ./badge.ts coverage --percent=85 --thresholds=60,80

  # Download license badge
  ./badge.ts license --type=MIT --download > badge-license.svg

  # Append a badge to README
  ./badge.ts markdown --append --img-src=static/badge-tests.svg --alt="Tests" --link="https://github.com/user/repo" README.md

  # Replace all badges in README
  ./badge.ts markdown --replace --img-src=static/badge-coverage.svg --alt="Coverage" README.md
`);
  Deno.exit(0);
}

/**
 * Template tag for building URLs with automatic encoding of interpolated values.
 *
 * @example
 * const name = "foo bar";
 * const link = url`https://example.com/${name}`; // https://example.com/foo%20bar
 */
function url(strings: TemplateStringsArray, ...values: unknown[]): string {
  let result = strings[0];
  for (let i = 0; i < values.length; i++) {
    result += encodeURIComponent(String(values[i]));
    result += strings[i + 1];
  }
  return result;
}

/**
 * Determine coverage color based on percentage and thresholds.
 */
function getCoverageColor(
  coverage: number,
  redThreshold: number,
  greenThreshold: number,
): 'red' | 'yellow' | 'green' {
  if (coverage < redThreshold) {
    return 'red';
  }
  if (coverage < greenThreshold) {
    return 'yellow';
  }
  return 'green';
}

/**
 * Generate test status badge URL.
 */
function generateTestsBadge(status: 'passing' | 'failing'): string {
  const color = status === 'passing' ? 'green' : 'red';
  return url`https://img.shields.io/badge/tests-${status}-${color}`;
}

/**
 * Generate coverage badge URL.
 */
function generateCoverageBadge(
  percent: number,
  redThreshold: number,
  greenThreshold: number,
): string {
  const color = getCoverageColor(percent, redThreshold, greenThreshold);
  return url`https://img.shields.io/badge/coverage-${percent}%25-${color}`;
}

/**
 * Generate license badge URL.
 */
function generateLicenseBadge(type: string): string {
  return url`https://img.shields.io/badge/license-${type}-blue`;
}

/**
 * Download badge content from URL.
 */
async function downloadBadge(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download badge: ${response.statusText}`);
  }
  return await response.text();
}

/**
 * Handle tests command.
 */
async function handleTestsCommand(args: ReturnType<typeof parseArgs>): Promise<void> {
  if (args.help) {
    showHelp();
  }

  if (!args.status) {
    throw new Error(
      'Missing required parameter: --status=<value>\nRun with --help for more information.',
    );
  }

  const status = args.status;
  if (status !== 'passing' && status !== 'failing') {
    throw new Error(`Invalid --status value: ${status} (must be 'passing' or 'failing')`);
  }

  const url = generateTestsBadge(status);

  if (args.download) {
    const content = await downloadBadge(url);
    console.error(url);
    console.log(content);
  } else {
    console.log(url);
  }
}

/**
 * Handle coverage command.
 */
async function handleCoverageCommand(args: ReturnType<typeof parseArgs>): Promise<void> {
  if (args.help) {
    showHelp();
  }

  if (!args.percent) {
    throw new Error(
      'Missing required parameter: --percent=<value>\nRun with --help for more information.',
    );
  }

  const percent = parseInt(args.percent, 10);
  if (isNaN(percent) || percent < 0 || percent > 100) {
    throw new Error(`Invalid --percent value: ${args.percent} (must be 0-100)`);
  }

  // Parse thresholds with defaults
  let redThreshold = 70;
  let greenThreshold = 90;

  if (args.thresholds) {
    const parts = args.thresholds.split(',');
    if (parts.length !== 2) {
      throw new Error(
        `Invalid --thresholds value: ${args.thresholds} (must be in format "red,green", e.g. "70,90")`,
      );
    }

    redThreshold = parseInt(parts[0].trim(), 10);
    greenThreshold = parseInt(parts[1].trim(), 10);

    if (isNaN(redThreshold) || redThreshold < 0 || redThreshold > 100) {
      throw new Error(`Invalid red threshold: ${parts[0]} (must be 0-100)`);
    }
    if (isNaN(greenThreshold) || greenThreshold < 0 || greenThreshold > 100) {
      throw new Error(`Invalid green threshold: ${parts[1]} (must be 0-100)`);
    }
    if (redThreshold >= greenThreshold) {
      throw new Error(
        `Red threshold (${redThreshold}) must be less than green threshold (${greenThreshold})`,
      );
    }
  }

  const url = generateCoverageBadge(percent, redThreshold, greenThreshold);

  if (args.download) {
    const content = await downloadBadge(url);
    console.error(url);
    console.log(content);
  } else {
    console.log(url);
  }
}

/**
 * Handle license command.
 */
async function handleLicenseCommand(args: ReturnType<typeof parseArgs>): Promise<void> {
  if (args.help) {
    showHelp();
  }

  if (!args.type) {
    throw new Error(
      'Missing required parameter: --type=<value>\nRun with --help for more information.',
    );
  }

  const url = generateLicenseBadge(args.type);

  if (args.download) {
    const content = await downloadBadge(url);
    console.error(url);
    console.log(content);
  } else {
    console.log(url);
  }
}

/**
 * Handle markdown command.
 */
function handleMarkdownCommand(args: ReturnType<typeof parseArgs>): void {
  if (args.help) {
    showHelp();
  }

  // Validate file path argument
  if (args._.length < 2) {
    throw new Error('Missing required argument: <file>\nRun with --help for more information.');
  }

  const filePath = String(args._[1]);
  assertFile(filePath);

  // Validate mode flags
  const hasAppend = args.append === true;
  const hasReplace = args.replace === true;

  if (!hasAppend && !hasReplace) {
    throw new Error(
      'Must specify either --append or --replace\nRun with --help for more information.',
    );
  }

  if (hasAppend && hasReplace) {
    throw new Error(
      'Cannot specify both --append and --replace\nRun with --help for more information.',
    );
  }

  // Validate required parameters
  if (!args['img-src']) {
    throw new Error('Missing required parameter: --img-src=<path>\nRun with --help for more information.');
  }

  const imgSrc = String(args['img-src']);
  const alt = args.alt ? String(args.alt) : '';
  const link = args.link ? String(args.link) : undefined;

  // Format badge markdown
  let badgeMarkdown: string;
  if (link) {
    // Format as linked image: [![alt](img-src)](link)
    badgeMarkdown = `[![${alt}](${imgSrc})](${link})`;
  } else {
    // Format as image: ![alt](img-src)
    badgeMarkdown = `![${alt}](${imgSrc})`;
  }

  // Read markdown file
  const fileContent = Deno.readTextFileSync(filePath);
  const lines = fileContent.split('\n');

  const badgesStart = '<!-- BADGES:START -->';
  const badgesEnd = '<!-- BADGES:END -->';

  // Find existing badges section
  let startIndex = -1;
  let endIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(badgesStart)) {
      startIndex = i;
    }
    if (lines[i].includes(badgesEnd)) {
      endIndex = i;
      break;
    }
  }

  let newLines: string[];

  if (startIndex !== -1 && endIndex !== -1) {
    // Badges section exists
    if (hasReplace) {
      // Replace content between tags
      newLines = [
        ...lines.slice(0, startIndex + 1),
        badgeMarkdown,
        ...lines.slice(endIndex),
      ];
    } else {
      // Append to end of badges section
      const existingBadges = lines.slice(startIndex + 1, endIndex).join('\n');
      const newBadges = existingBadges.trim()
        ? `${existingBadges.trim()}\n${badgeMarkdown}`
        : badgeMarkdown;
      newLines = [
        ...lines.slice(0, startIndex + 1),
        newBadges,
        ...lines.slice(endIndex),
      ];
    }
  } else {
    // Badges section doesn't exist, insert it
    let insertIndex = 0;

    // Find first heading
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].match(/^# /)) {
        insertIndex = i + 2; // 2 lines below heading
        break;
      }
    }

    // Insert badges section
    const badgesSection = [
      badgesStart,
      badgeMarkdown,
      badgesEnd,
    ];

    newLines = [
      ...lines.slice(0, insertIndex),
      ...badgesSection,
      ...lines.slice(insertIndex),
    ];
  }

  // Write back to file
  Deno.writeTextFileSync(filePath, newLines.join('\n'));
}

/**
 * Main execution function.
 */
async function main(): Promise<void> {
  const args = parseArgs(Deno.args, {
    boolean: ['help', 'download', 'append', 'replace'],
    string: ['status', 'percent', 'thresholds', 'type', 'img-src', 'alt', 'link'],
    alias: { h: 'help' },
  });

  // Handle help flag
  if (args.help && args._.length === 0) {
    showHelp();
  }

  // Get command
  if (args._.length === 0) {
    throw new Error('Missing command.\nRun with --help for more information.');
  }

  const command = String(args._[0]);

  // Route to command handler
  switch (command) {
    case 'tests':
      await handleTestsCommand(args);
      break;
    case 'coverage':
      await handleCoverageCommand(args);
      break;
    case 'license':
      await handleLicenseCommand(args);
      break;
    case 'markdown':
      handleMarkdownCommand(args);
      break;
    default:
      throw new Error(`Unknown command: ${command}\nRun with --help for more information.`);
  }
}

// Run main function
await main();
