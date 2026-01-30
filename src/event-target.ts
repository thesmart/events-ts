/**
 * Base interface for all events.
 * All custom events must extend this interface and define a specific type.
 *
 * @example
 * ```ts
 * interface MyCustomEvent extends Event {
 *   type: 'custom';
 *   data: string;
 * }
 * ```
 */
export interface Event {
  // Event type. 'error' is a reserved for thrown errors and cannot be redefined.
  type: string;
  // number of ticks (ms) since the process started.
  timeStamp: number;
}

/**
 * Event dispatched when an error occurs or is thrown during event listener execution.
 * ErrorEvent is automatically supported on all EventTarget instances without needing
 * to include it in the type parameter.
 *
 * @example
 * ```ts
 * target.addEventListener('error', (event) => {
 *   console.error('Error occurred:', event.error);
 *   if (event.error instanceof Error) {
 *     console.error(event.error.stack);
 *   }
 * });
 * ```
 */
export interface ErrorEvent extends Event {
  type: 'error';
  error: Error | unknown;
}

/**
 * The `EventListener` interface represents a callback function to be called
 * whenever an event of a specific type occurs on a target object.
 *
 * @example
 * ```ts
 * // Attach the event listener to a target
 * const target = new EventTarget();
 * target.addEventListener('custom', handleEvent);
 *
 * // Or create a listener inline
 * target.addEventListener('message', (event) => {
 *   console.log('Message received:', event);
 * });
 * ```
 */
type EventListener<E extends Event> = (
  evt: E,
) => void;

/**
 * Internal record tracking metadata about a registered listener.
 */
interface EventListenerRecord<E extends Event, T extends string = string> {
  /** The event type this listener is registered for */
  type: T;
  /** Whether this listener should be removed after firing once */
  once?: boolean;
  /** The listener function to invoke */
  listener: EventListener<E>;
}

/**
 * A simple, type-safe event target implementation for dispatching and listening to events.
 *
 * This class allows you to add event listeners, remove them, and emit events—similar to the DOM's EventTarget,
 * but type-parameterized for your own event types and payloads.
 *
 * @typeParam E - The base event interface to use for all events.
 * @typeParam ET - Union of string event names, defaults to all possible values of E['type'].
 *
 * Example usage:
 * ```ts
 * interface FooEvent extends Event {
 *   type: 'foo';
 *   payload?: number;
 * }
 *
 * interface BarEvent extends Event {
 *   type: 'bar';
 *   data?: number;
 * }
 *
 * const et = new EventTarget<FooEvent | BarEvent>();
 * et.addEventListener('foo', event => { ... });
 * et.dispatchEvent({ type: 'foo', timeStamp: Date.now(), payload: 42 });
 * ```
 */
export class EventTarget<
  // All the event types allowed
  E extends Event,
  // The values of a Event#type parameters passed in as E
  ET extends E['type'] | 'error' = E['type'] | 'error',
> {
  // Maps an event type to metadata about the listeners that should trigger
  protected _listeners: Map<ET, Map<EventListener<E>, EventListenerRecord<E, ET>>> = new Map();

  /**
   * Attach an event listener for a specific event type.
   * Node.js-style alias for addEventListener.
   *
   * @param type The event type to listen for (e.g., 'foo', 'bar', or 'error')
   * @param listener Callback function invoked when the event is dispatched
   * @returns This EventTarget instance for method chaining
   *
   * @example
   * ```ts
   * target.on('foo', (event) => {
   *   console.log(event.payload);
   * });
   * ```
   */
  on<
    T extends ET,
    L extends T extends 'error' ? (evt: ErrorEvent) => void
      : (evt: E & { type: T }) => void,
  >(
    type: T,
    listener: L,
  ): EventTarget<E, ET> {
    return this.addEventListener(type, listener);
  }

  /**
   * Attach an event listener that automatically removes itself after firing once.
   * Node.js-style alias for addEventListener with { once: true }.
   *
   * @param type The event type to listen for
   * @param listener Callback function invoked once when the event is dispatched
   * @returns This EventTarget instance for method chaining
   *
   * @example
   * ```ts
   * target.once('foo', (event) => {
   *   console.log('This will only run once');
   * });
   * target.dispatchEvent({ type: 'foo', timeStamp: Date.now(), payload: 42 });
   * target.dispatchEvent({ type: 'foo', timeStamp: Date.now(), payload: 99 });
   * // Listener only called for the first dispatch
   * ```
   */
  once<
    T extends ET,
    L extends T extends 'error' ? (evt: ErrorEvent) => void
      : (evt: E & { type: T }) => void,
  >(
    type: T,
    listener: L,
  ): EventTarget<E, ET> {
    return this.addEventListener(type, listener, true);
  }

  /**
   * Remove a specific event listener.
   * Node.js-style alias for removeEventListener.
   *
   * @param type The event type the listener was registered for
   * @param listener The listener function to remove
   * @returns This EventTarget instance for method chaining
   *
   * @example
   * ```ts
   * const handler = (event) => console.log(event);
   * target.on('foo', handler);
   * target.off('foo', handler);  // Removes the listener
   * ```
   */
  off<
    T extends ET,
    L extends T extends 'error' ? (evt: ErrorEvent) => void
      : (evt: E & { type: T }) => void,
  >(
    type: T,
    listener: L,
  ): EventTarget<E, ET> {
    return this.removeEventListener(type, listener);
  }

  /**
   * Attach an event listener for a specific event type.
   * DOM-style API compatible with standard EventTarget.
   *
   * @param type The event type to listen for
   * @param listener Callback function invoked when the event is dispatched
   * @param opts Optional configuration (e.g., { once: true })
   * @returns This EventTarget instance for method chaining
   *
   * @example
   * ```ts
   * // Standard listener
   * target.addEventListener('foo', (event) => {
   *   console.log(event.payload);
   * });
   *
   * // One-time listener
   * target.addEventListener('bar', (event) => {
   *   console.log('Runs once');
   * }, { once: true });
   *
   * // Error listener
   * target.addEventListener('error', (event) => {
   *   console.error(event.error);
   * });
   * ```
   */
  addEventListener<
    T extends ET,
    L extends T extends 'error' ? (evt: ErrorEvent) => void
      : (evt: E & { type: T }) => void,
  >(
    type: T,
    listener: L,
    once?: boolean,
  ): EventTarget<E, ET> {
    if (typeof type !== 'string') {
      throw new TypeError('Event type must be a string');
    }
    if (typeof listener !== 'function') {
      throw new TypeError('Event listener must be a function');
    }

    const listeners = this._listeners.get(type) ??
      this._listeners.set(type, new Map()).get(type)!;
    listeners.set(listener as EventListener<E>, {
      type,
      listener: listener as EventListener<E>,
      once: !!once,
    });
    return this;
  }

  /**
   * Remove a specific event listener.
   * DOM-style API compatible with standard EventTarget.
   *
   * @param type The event type the listener was registered for
   * @param listener The listener function to remove
   * @returns This EventTarget instance for method chaining
   *
   * @example
   * ```ts
   * const handler = (event) => console.log(event);
   * target.addEventListener('foo', handler);
   * target.removeEventListener('foo', handler);  // Removes the listener
   * ```
   */
  removeEventListener<
    T extends ET,
    L extends T extends 'error' ? (evt: ErrorEvent) => void
      : (evt: E & { type: T }) => void,
  >(
    type: T,
    listener: L,
  ): EventTarget<E, ET> {
    if (typeof type !== 'string') {
      throw new TypeError('Event type must be a string');
    }
    if (typeof listener !== 'function') {
      throw new TypeError('Event listener must be a function');
    }

    const listeners = this._listeners.get(type);
    if (listeners) {
      listeners.delete(listener as EventListener<E>);
      if (!listeners.size) {
        this._listeners.delete(type);
      }
    }
    return this;
  }

  /**
   * Remove all listeners for a specific event type, or all listeners for all event types.
   * Node.js-style API for bulk listener removal.
   *
   * @param type Optional event type. If provided, removes only listeners for that type.
   *             If omitted, removes all listeners for all event types.
   * @returns This EventTarget instance for method chaining
   *
   * @example
   * ```ts
   * // Remove all listeners for 'foo' event
   * target.removeAllListeners('foo');
   *
   * // Remove all listeners for all events
   * target.removeAllListeners();
   * ```
   */
  removeAllListeners<T extends ET>(type?: T): EventTarget<E, ET> {
    if (type !== undefined && typeof type !== 'string') {
      throw new TypeError('Event type must be a string');
    }

    if (type) {
      // clear only listeners of a type
      this._listeners.delete(type);
    } else {
      // clear all listeners of every type
      this._listeners.clear();
    }

    return this;
  }

  /**
   * Dispatch an event to all registered listeners for that event type.
   * If a listener throws an error, it will be caught and dispatched as an 'error' event.
   * Listeners registered with { once: true } are automatically removed after being called.
   *
   * @param event The event object to dispatch (must have type and timeStamp properties)
   * @returns This EventTarget instance for method chaining
   *
   * @example
   * ```ts
   * target.addEventListener('foo', (event) => {
   *   console.log(event.payload);
   * });
   *
   * target.dispatchEvent({
   *   type: 'foo',
   *   timeStamp: performance.now(),
   *   payload: 42
   * });
   * ```
   */
  dispatchEvent<
    T extends ET,
    L extends T extends 'error' ? (evt: ErrorEvent) => void
      : (evt: E & { type: T }) => void,
  >(event: E): EventTarget<E, ET> {
    if (
      typeof event !== 'object' ||
      event === null ||
      typeof event.type !== 'string'
    ) {
      throw new TypeError('Event must be an object with a string `type` property');
    }

    const listeners = this._listeners.get(event.type as T);
    if (!listeners) {
      return this;
    }

    for (const listener of listeners.values()) {
      try {
        listener.listener(event as E);
      } catch (thrown) {
        this.dispatchError(thrown);
      } finally {
        if (listener.once) {
          this.removeEventListener(event.type as T, listener.listener as L);
        }
      }
    }

    return this;
  }

  /**
   * Dispatch an error to all registered 'error' event listeners.
   * If no error listeners are registered, the error is thrown asynchronously on the next tick.
   * If an error listener itself throws, that error is also thrown asynchronously.
   *
   * This method is automatically called when a listener throws during dispatchEvent.
   *
   * @param error The error to dispatch (typically an Error instance, but can be any value)
   * @returns This EventTarget instance for method chaining
   *
   * @example
   * ```ts
   * target.addEventListener('error', (event) => {
   *   console.error('Error occurred:', event.error);
   * });
   *
   * target.dispatchError(new Error('Something went wrong'));
   * ```
   */
  dispatchError<
    T extends ET,
    L extends T extends 'error' ? (evt: ErrorEvent) => void
      : (evt: E & { type: T }) => void,
  >(error: Error | unknown): EventTarget<E, ET> {
    if (error === null || error === undefined) {
      throw new TypeError('Error must not be null or undefined');
    }

    const listeners = this._listeners.get('error' as ET);
    if (!listeners) {
      queueMicrotask(() => {
        throw error;
      });
      return this;
    }

    const event: ErrorEvent = {
      type: 'error',
      error,
      timeStamp: performance.now(),
    };

    for (const listener of listeners.values()) {
      try {
        listener.listener(event as unknown as E);
      } catch (thrown) {
        queueMicrotask(() => {
          throw thrown;
        });
      } finally {
        if (listener.once) {
          this.removeEventListener(event.type as T, listener.listener as L);
        }
      }
    }

    return this;
  }

  /**
   * Get an iterable of all event type names that currently have listeners registered.
   *
   * @returns An iterable of event type names (e.g., 'foo', 'bar', 'error')
   *
   * @example
   * ```ts
   * target.addEventListener('foo', () => {});
   * target.addEventListener('bar', () => {});
   *
   * for (const name of target.eventNames()) {
   *   console.log(name);  // Outputs: 'foo', 'bar'
   * }
   *
   * // Convert to array if needed
   * const names = Array.from(target.eventNames());
   * ```
   */
  eventNames(): Iterable<ET> {
    return this._listeners.keys();
  }

  /**
   * Get the total number of listeners registered across all event types.
   *
   * @returns The total count of all registered listeners
   *
   * @example
   * ```ts
   * target.addEventListener('foo', () => {});
   * target.addEventListener('foo', () => {});
   * target.addEventListener('bar', () => {});
   *
   * console.log(target.listenerCount());  // Outputs: 3
   * ```
   */
  listenerCount(): number {
    let count = 0;
    for (const listeners of this._listeners.values()) {
      count += listeners.size;
    }
    return count;
  }
}
