# Agent Instructions for `./gate`

This file addends to the [Root CLAUDE.md](../CLAUDE.md).

Consult the [README.md](./README.md) folder specification.

## CLI Parameter Conventions

When implementing CLI tools in this project, ALWAYS use `@std/cli/parse-args` for argument parsing:

```typescript
import { parseArgs } from '@std/cli/parse-args';

const args = parseArgs(Deno.args, {
  boolean: ['help', 'verbose', 'dryrun'],
  string: ['output', 'file'],
  alias: { h: 'help', v: 'verbose', o: 'output' },
});
```

Follow these Linux/POSIX conventions for command-line parameters:

### Positional Parameters

- Positional parameters are arguments provided without flags.
- They are interpreted based on their ORDER in the command line.
- Most specific/required arguments come first, optional ones last.
- Example: `git commit -m "message" file1.txt file2.txt` (files are positional)

### Short Flags (Single Dash `-`)

- Use a SINGLE dash followed by a SINGLE character: `-h`, `-v`, `-f`
- Short flags can be combined: `-abc` is equivalent to `-a -b -c`
- Short flags with arguments: `-f filename` or `-ffilename` (no space between flag and value)
- Value after `=` in combined flags: `-f=filename`
- Commonly used short flags:
  - `-h`: help
  - `-v`: verbose or version
  - `-q`: quiet
  - `-f`: file or force
  - `-n`: number or dry-run

### Long Flags (Double Dash `--`)

- Use a DOUBLE dash followed by a descriptive word: `--help`, `--verbose`, `--output`
- Long flags use kebab-case for multi-word options: `--dry-run`, `--output-file`
- Long flags with arguments support both `=` and space: `--file=name.txt` or `--file name.txt`
- Long flags should have corresponding short flags when commonly used (use `alias` option)
- Example: `alias: { v: 'verbose' }` makes `-v` and `--verbose` equivalent

### Flag Arguments

- **String flags**: Use `string` option to require a value
  - Example: `--output file.txt` or `--output=file.txt`
- **Boolean flags**: Use `boolean` option, presence = `true`, absence = `false`
  - Example: `--verbose` → `{ verbose: true }`
  - Negatable booleans: Use `negatable` option to support `--no-` prefix
  - Example: `--no-color` → `{ color: false }`
- **Array flags**: Use `collect` option to accumulate multiple values
  - Example: `--include a --include b` → `{ include: ['a', 'b'] }`
- **Numeric conversion**: Arguments are auto-converted to numbers unless in `string` option
  - Example: `--port 8080` → `{ port: 8080 }` (number, not string)

### Special Conventions

- `--` (double dash alone): Indicates end of flags, everything after is positional
  - Example: `rm -- -filename.txt` (removes file named "-filename.txt")
- `-` (single dash alone): Often means stdin/stdout
  - Example: `cat file.txt - file2.txt` (reads file1, then stdin, then file2)

### Using parseArgs

The `parseArgs` function from `@std/cli/parse-args` handles argument parsing with these options:

- **boolean**: `boolean | string | string[]` - Flags to treat as booleans
  - When `true`, treats ALL double-hyphenated arguments without `=` as boolean
  - Boolean flags default to `false` if not provided
  - Example: `boolean: ['help', 'verbose']` allows `--help`, `--verbose`

- **string**: `string | string[]` - Flags to always treat as strings
  - Prevents automatic number conversion for these flags
  - Example: `string: ['output', 'file']` allows `--output=file.txt` or `--output file.txt`

- **collect**: `string | string[]` - Flags that can be used multiple times (arrays)
  - All values collected into an array
  - Non-collectable flags only keep the last value if used multiple times
  - Example: `collect: ['include']` allows `--include a --include b` → `{ include: ['a', 'b'] }`

- **negatable**: `string | string[]` - Flags that can be negated with `--no-` prefix
  - Must also be in `boolean` array
  - Example: `negatable: ['color']` allows `--no-color` → `{ color: false }`

- **alias**: `Record<string, string | string[]>` - Maps aliases to primary flag names
  - Both short and long flags map to the same value
  - Example: `alias: { h: 'help', v: 'verbose' }` makes `-h` equivalent to `--help`

- **default**: `Record<string, unknown>` - Default values for flags
  - Applied only if flag not provided
  - Example: `default: { port: 8080 }`

- **stopEarly**: `boolean` - Stop parsing at first non-flag argument
  - Everything after first non-flag goes into `args._`
  - Useful for subcommands

- **"--"**: `boolean` - Control handling of arguments after `--`
  - When `false` (default): args after `--` go into `args._`
  - When `true`: args after `--` go into `args["--"]` array
  - Example: `"--": true` with `cmd --flag -- arg1 arg2` → `{ _: [], "--": ['arg1', 'arg2'] }`

- **unknown**: `(arg: string, key?: string, value?: unknown) => unknown` - Handle unknown flags
  - Called for flags not in `boolean`, `string`, or `collect`
  - Return `false` to exclude from result
  - Default: includes all unknown arguments

**Return value**:

- `args._`: Array of positional arguments (strings and numbers)
- `args["--"]`: Optional array (if `"--": true`)
- Named properties for each flag parsed

### Parsing Order and Behavior

1. **Flag parsing**: `parseArgs` processes all flags (short and long) regardless of position
   - Flags can appear before or after positional arguments
   - Example: `cmd file1 --verbose file2` works the same as `cmd --verbose file1 file2`

2. **Double dash `--`**: Stops flag parsing
   - If `"--": false` (default): args after `--` go into `args._`
   - If `"--": true`: args after `--` go into `args["--"]` array
   - Example: `cmd --flag -- --not-a-flag` → `args._ = ['--not-a-flag']`

3. **Positional arguments**: Collected in `args._` array
   - Non-flag arguments and arguments after `--`
   - Auto-converted to numbers if they look numeric (unless `string: ['_']`)
   - Example: `cmd file1 42 file2` → `args._ = ['file1', 42, 'file2']`

4. **stopEarly option**: When `true`, stops parsing at first non-flag
   - Everything after first non-flag goes into `args._`
   - Useful for subcommand patterns: `git commit -m "msg"` where `commit` is a subcommand

### Best Practices

- **ALWAYS declare expected flags** in the `parseArgs` options (`boolean`, `string`, or `collect`)
  - This enables proper type checking and ensures correct parsing

- **Accept flags anywhere**: `parseArgs` accepts flags BEFORE or AFTER positional parameters
  - No need to enforce flag position

- **Use aliases for common flags**: Provide both short and long versions with `alias` option
  - Example: `alias: { h: 'help', v: 'verbose', o: 'output' }`

- **Use kebab-case for multi-word flags**: `--dry-run`, `--output-file`, `--no-color`

- **Follow conventions**: Use standard flag names (`--help`, `--version`, `--verbose`, etc.)

- **Enable negation for boolean flags**: Use `negatable` option for flags that benefit from `--no-`
  prefix
  - Example: `negatable: ['color', 'cache']` allows `--no-color`, `--no-cache`

- **Validate after parsing**: Check for required arguments and invalid combinations
  ```typescript
  if (!args.output) {
    console.error('Error: --output is required');
    Deno.exit(1);
  }
  ```

- **Handle help and version early**: Check for `--help` and `--version` before validation
  ```typescript
  if (args.help) {
    console.log(HELP_TEXT);
    Deno.exit(0);
  }
  ```

- **Access positional args via `args._`**: All non-flag arguments are in this array
  - Remember: numeric-looking values are converted to numbers by default

- **Use `collect` for repeatable flags**: When a flag should accumulate values
  - Example: `--include src --include tests` → `{ include: ['src', 'tests'] }`

- **Use `default` for optional flags**: Provide sensible defaults
  - Example: `default: { port: 8080, host: 'localhost' }`
