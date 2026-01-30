# Gate Scripts

This folder contains CLI scripts that control the gating process for production releases.

## What is "The Gate"?

The gate is a comprehensive validation pipeline that must pass before publishing new versions to
package managers. "Running the gate" refers to executing a series of checks and preparations that
ensure the package is ready for production release.

Gate checks are invoked from the root via `deno task` defined in the root's `deno.json`.

## Running the Full Gate

From repo root, a single `deno task gate` command will execute all gate checks.

## Usage

All gate scripts must be run from the `./gate` folder:

```bash
cd gate
./script-name.ts --help  # Dependencies are auto-installed on first run
```

---

## Development Guidelines

Each gate script should:

- Be idempotent (safe to run multiple times)
- Exit with code 0 on success, non-zero on failure
- Provide clear error messages
- Not modify files unless explicitly intended
- Use the `zx` library for shell operations
- Use shared utilities from `src/*.ts`
- Validate that it's running from the gate folder via `checkCwd()`
- Resolve all file path parameters using `resolvePath()`
- Include comprehensive help text via `--help` flag

The `src/common.ts` file provides shared utilities for all gate scripts:

- `checkCwd()` - Ensures the script is running from the gate folder
- `findRootDir()` - Finds the root directory by locating `deno.json` with `name: "events-ts"`
- `parseArguments()` - Parses command-line arguments into params and flags
- `resolvePath()` - Resolves relative paths to absolute paths using `@std/path`
