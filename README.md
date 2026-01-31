# events-ts

<!-- BADGES:START -->

[![Tests: passing](static/badge-tests.svg)](https://github.com/thesmart/events-ts/actions/workflows/gate.yml)
![Coverage: 80](static/badge-coverage.svg) [![License: MIT](static/badge-license.svg)](LICENSE)

<!-- BADGES:END -->

A delightfully simple, type-safe event system for TypeScript that works everywhere.

## Why Another Event Library?

- **Type Safety**: Events are fully typed, no more `any` or manual casting.
- **Compatibility**: Works in Node.js, Deno, Bun, and browsers without modification.
- **ESM-First**: Modern ES modules with zero dependencies.
- **Lightweight**: Simple, focused implementation without the legacy overhead.

## Installation

```bash
# Deno
deno add jsr:@thesmart/events-ts

# Node.js
npx jsr add @thesmart/events-ts
```

## Quick Start

```ts
import { Event, EventTarget } from '@thesmart/events-ts';

// Define your event types
interface MessageEvent extends Event {
  type: 'message';
  text: string;
  from: string;
}

interface StatusEvent extends Event {
  type: 'status';
  online: boolean;
}

// Add typed event handling and dispatch to any class
class MyClass extends EventTarget<MessageEvent | StatusEvent>;
// OR, construct an EventTarget for that
const chat = new EventTarget<MessageEvent | StatusEvent>();

// Listen for events (with full type safety!)
chat.on('message', (event) => {
  console.log(`${event.from}: ${event.text}`);
  // TypeScript knows event.text and event.from exist!
});

// Dispatch events
chat.dispatchEvent({
  type: 'message',
  text: 'Hello, world!',
  from: 'alice',
  timeStamp: performance.now(),
});
```

## Error Handling

You can prevent errors thrown in event handler from crashing your application. Add an event listener
to automatically catch and dispatch thrown errors as `error` events:

```ts
const target = new EventTarget<MyEvent>();

// Handle errors from other listeners
target.on('error', (event) => {
  console.error('An error occurred:', event.error);
  if (event.error instanceof Error) {
    console.error(event.error.stack);
  }
});

// Errors thrown in handlers will be caught and dispatched if "error" has listeners
target.on('data', () => {
  throw new Error('Oops!');
});

target.dispatchEvent({
  type: 'data',
  payload: 'test',
  timeStamp: performance.now(),
});
// Logs: "An error occurred: Error: Oops!"
```

If no error listener is registered, the error is thrown asynchronously on the next tick, ensuring no
silent failures.

## Methods

**DOM-style API:**

- `addEventListener(type, listener, once?)` - Add an event listener
- `removeEventListener(type, listener)` - Remove a specific listener
- `dispatchEvent(event)` - Dispatch an event to all listeners

**Node.js-style API:**

- `on(type, listener)` - Add an event listener (alias for `addEventListener`)
- `once(type, listener)` - Add a one-time listener (automatically removed after first call)
- `off(type, listener)` - Remove a listener (alias for `removeEventListener`)
- `removeAllListeners(type?)` - Remove all listeners for a type (or all types)

**Utility Methods:**

- `dispatchError(error)` - Dispatch an error event
- `eventNames()` - Get an iterable of event types with registered listeners
- `listenerCount()` - Get the total number of registered listeners

## Comparison

| Feature            | events-ts                  | Browser EventTarget | Node EventEmitter         |
| ------------------ | -------------------------- | ------------------- | ------------------------- |
| Type Safety        | ✅ Full type inference     | ❌ Uses `any`       | ⚠️ Manual typing required |
| ESM Support        | ✅ Native ESM              | ⚠️ Depends          | ✅ Supports ESM           |
| Event Bubbling     | ❌ Not needed              | ✅ DOM-specific     | ❌ Not needed             |
| Event Phases       | ❌ Not needed              | ✅ DOM-specific     | ❌ Not needed             |
| `preventDefault()` | ❌ Not needed              | ✅ DOM-specific     | ❌ Not needed             |
| Browser Support    | ✅ Works everywhere        | ✅ Native           | ❌ Requires polyfill      |
| Size               | ~470 lines, 0 dependencies | Browser built-in    | Node built-in             |

## Contributing

Contributions are welcome via PR! This project follows standard TypeScript and Deno conventions.

```bash
# Run tests
deno task test
```
