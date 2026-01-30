# Repository Agent Instructions

This file provides guidance to Claude Code (claude.ai/code) when working with
code in this repository. Consult the [README.md](./README.md) file for project
specification.

## Languages

Typescript version: ^5.8.0

## Compatibility

Sources SHALL BE COMPATIBLE with Deno, Node.js, and web browser Typescript
projects.

Deno version: ^2.4.0

Node version: >= 20

Browser version: ES2020

## Runtime

The runtime for this project is Deno.

```sh
# Execute Deno test:
deno task test ./src/example.test.ts
# Build the project for web browsers:
deno task build
```

### Packages

Examples for adding modules to a `deno.json`:

```sh
# Add a standard library module
deno add jsr:@std/cli
# Add a third party module from 
deno add jsr:@[SCOPE]/[PACKAGE]
# Add an NPM module
deno add npm:react
```

Example of importing packages:

```ts
// example: import an added JSR module
// i.e. deno add jsr:<package-name>
import { parseArgs } from "@std/cli/parse-args";
// example: import an added NPM module
// i.e. import { <symbol> } from "node:<module>";
import { Buffer } from "node:buffer";
```

NEVER import from a URL, always use the import keys defined in `deno.json`, (eg.
`import { crypto } from '@std/crypto/crypto';`).

#### Rules for selecting a package

- ALWAYS PREFER built-in classes and functions first.
- IF AND ONLY IF a built-in is not available, ALWAYS PREFER a standard library
  (first-party) package. The source for these packages is `jsr:@std/*`.
  - Standard library package are listed here: [@std/lib](https://jsr.io/@std)
- IF AND ONLY IF there is no standard library package suitable for a task,
  ALWAYS PREFER [Node's standard library](https://docs.deno.com/api/node/).
- IF AND ONLY IF there is no standard library packages suitable for a task,
  ALWAYS PREFER third-party packages from [JSR](https://jsr.io/packages).
  - Search for JSR packages here:
    https://jsr.io/packages?search=runtime%3ADeno+{PACKAGE_NAME}
- IF AND ONLY IF there is no standard library packages, or JSR third-party
  packages suitable for a task, ALWAYS PREFER third-party packages from `npm`.
  - Search for npm packages here:
    `https://www.npmjs.com/search?q=<package-name>`

## Code style

- Use ES modules (import/export) syntax, not CommonJS (require)
- When importing local files, ALWAYS use relative paths and the file's actual
  extension.
- Destructure imports when possible (eg. `import { foo } from './bar.ts'`)
- ALMOST ALWAYS add a comment block briefly explaining a class or function's
  purpose.
  - This is not necessary if the function name exactly describes what it does.
  - DO NOT include `@params` or `@returns`, they are superfluous in Typescript.
  - ALWAYS include `@throws [ERROR_TYPE]` for every condition that throws an
    exception w/ a brief explanation of the condition and what is thrown.
- ALWAYS prefer early `return` when possible. e.g.
  `if (<CONDITION>) { return; }`
- ALWAYS prefer early `throw` when possible. e.g.
  `if (<CONDITION>) { throw new Error(<MESSAGE>); }`
- ALWAYS prefer using assertions (e.g.
  `import { assert, assertEquals } from '@std/assert';` etc.) for testing
  parameter pre-conditions.
  `if (<edge-case>) { throw new Error('<helpful debugging details>'); }`
- ALWAYS use block brackets w/ new-lines for one-line conditionals. e.g.
  `if (<condition>) {\n\t<one-line>;\n}`
- When writing tests:
  - ALWAYS use the file extension `.test.ts`.
  - ALWAYS use bdd style nested test grouping via `describe` and `it`:
    `import { describe, it } from '@std/testing/bdd';`.

## Workflow

- Be sure to typecheck when you’re done making a series of code changes.
- Prefer running single tests, and not the whole test suite, for performance.

## Docs

- [Deno Docs](https://docs.deno.com/)
- [Deno BDD Style Testing](https://jsr.io/@std/testing/doc/bdd)
- [Node and npm Compatibility](https://docs.deno.com/runtime/fundamentals/node/)
