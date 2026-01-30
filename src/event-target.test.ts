import { assert, assertEquals, assertMatch, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { ErrorEvent, Event, EventTarget } from "./event-target.ts";

// Test event types
interface FooEvent extends Event {
  type: "foo";
  payload: number;
}

interface BarEvent extends Event {
  type: "bar";
  data: string;
}

interface BazEvent extends Event {
  type: "baz";
}

type TestEvent = FooEvent | BarEvent | BazEvent;

describe("EventTarget", () => {
  describe("addEventListener", () => {
    it("should add a listener for an event type", () => {
      const target = new EventTarget<TestEvent>();
      const listener = () => {};

      target.addEventListener("foo", listener);

      assertEquals(target.listenerCount(), 1);
      console.info(target.eventNames());
      assertEquals(Array.from(target.eventNames()), ["foo"]);
    });

    it("should add multiple listeners for the same event type", () => {
      const target = new EventTarget<TestEvent>();
      const listener1 = () => {};
      const listener2 = () => {};

      target.addEventListener("foo", listener1);
      target.addEventListener("foo", listener2);
      target.addEventListener("foo", listener2);

      assertEquals(target.listenerCount(), 2);
    });

    it("should add listeners for different event types", () => {
      const target = new EventTarget<TestEvent>();
      const fooListener = () => {};
      const barListener = () => {};

      target.addEventListener("foo", fooListener);
      target.addEventListener("bar", barListener);

      assertEquals(target.listenerCount(), 2);
      assertEquals(Array.from(target.eventNames()), ["foo", "bar"]);
    });

    it("should not add duplicate listeners", () => {
      const target = new EventTarget<TestEvent>();
      const listener = () => {};

      target.addEventListener("foo", listener);
      target.addEventListener("foo", listener);

      assertEquals(target.listenerCount(), 1);
    });

    it("should add once listener that removes itself after firing", () => {
      const target = new EventTarget<TestEvent>();
      let callCount = 0;
      let seenPayload = 0;
      const listener = (event: FooEvent) => {
        callCount++;
        seenPayload = event.payload;
      };

      target.addEventListener("foo", listener, true);
      assertEquals(target.listenerCount(), 1);

      target.dispatchEvent({ type: "foo", payload: 42, timeStamp: Date.now() });

      assertEquals(callCount, 1);
      assertEquals(seenPayload, 42);
      assertEquals(target.listenerCount(), 0);
    });

    it("should throw when called with fewer than 2 arguments", () => {
      const target = new EventTarget<TestEvent>();

      assertThrows(() => {
        // @ts-expect-error Testing invalid call
        target.addEventListener("foo");
      });
    });
  });

  describe("removeEventListener", () => {
    it("should remove a specific listener", () => {
      const target = new EventTarget<TestEvent>();
      const listener = () => {};

      target.addEventListener("foo", listener);
      assertEquals(target.listenerCount(), 1);

      target.removeEventListener("foo", listener);
      assertEquals(target.listenerCount(), 0);
    });

    it("should not affect other event types", () => {
      const target = new EventTarget<TestEvent>();
      const fooListener = () => {};
      const barListener = () => {};

      target.addEventListener("foo", fooListener);
      target.addEventListener("bar", barListener);

      target.removeEventListener("foo", fooListener);

      assertEquals(target.listenerCount(), 1);
      assertEquals(Array.from(target.eventNames()), ["bar"]);
    });

    it("should handle removing non-existent listener gracefully", () => {
      const target = new EventTarget<TestEvent>();
      const listener = () => {};

      target.removeEventListener("foo", listener);

      assertEquals(target.listenerCount(), 0);
    });
  });

  describe("removeAllListeners", () => {
    it("should remove all listeners for a specific type", () => {
      const target = new EventTarget<TestEvent>();

      target.addEventListener("foo", () => {});
      target.addEventListener("bar", () => {});
      target.addEventListener("foo", () => {});
      target.addEventListener("baz", () => {});
      target.addEventListener("foo", () => {});

      target.removeAllListeners("foo");

      assertEquals(target.listenerCount(), 2);
      assertEquals(Array.from(target.eventNames()), ["bar", "baz"]);
    });

    it("should remove all listeners for all types when no type provided", () => {
      const target = new EventTarget<TestEvent>();

      target.addEventListener("foo", () => {});
      target.addEventListener("bar", () => {});
      target.addEventListener("baz", () => {});

      assertEquals(target.listenerCount(), 3);

      target.removeAllListeners();

      assertEquals(target.listenerCount(), 0);
      assertEquals(Array.from(target.eventNames()), []);
    });

    it("should handle removing listeners for non-existent type gracefully", () => {
      const target = new EventTarget<TestEvent>();

      target.removeAllListeners("foo");

      assertEquals(target.listenerCount(), 0);
    });
  });

  describe("dispatchEvent", () => {
    it("should call listener when event is dispatched", () => {
      const target = new EventTarget<TestEvent>();
      let called = false;
      let receivedEvent: FooEvent | null = null;

      target.addEventListener("foo", (event) => {
        called = true;
        receivedEvent = event;
      });

      const event: FooEvent = {
        type: "foo",
        payload: 42,
        timeStamp: Date.now(),
      };
      target.dispatchEvent(event);

      assertEquals(called, true);
      assertEquals(receivedEvent, event);
    });

    it("should call multiple listeners in order", () => {
      const target = new EventTarget<TestEvent>();
      const callOrder: number[] = [];

      target.addEventListener("foo", () => callOrder.push(1));
      target.addEventListener("foo", () => callOrder.push(2));
      target.addEventListener("foo", () => callOrder.push(3));

      target.dispatchEvent({ type: "foo", payload: 42, timeStamp: Date.now() });

      assertEquals(callOrder, [1, 2, 3]);
    });

    it("should not call listeners for different event types", () => {
      const target = new EventTarget<TestEvent>();
      let fooCalled = false;
      let barCalled = false;

      target.addEventListener("foo", () => {
        fooCalled = true;
      });
      target.addEventListener("bar", () => {
        barCalled = true;
      });

      target.dispatchEvent({ type: "foo", payload: 42, timeStamp: Date.now() });

      assertEquals(fooCalled, true);
      assertEquals(barCalled, false);
    });

    it("should handle errors thrown in listeners", () => {
      const target = new EventTarget<TestEvent>();
      let errorEvent: ErrorEvent | null = null;

      target.addEventListener("error", (event) => {
        errorEvent = event;
        assertEquals(errorEvent.type, "error");
        assertEquals((errorEvent.error as Error).message, "Test error");
      });

      target.addEventListener("foo", () => {
        throw new Error("Test error");
      });

      target.dispatchEvent({ type: "foo", payload: 42, timeStamp: Date.now() });

      assert(errorEvent);
    });

    it("should do nothing when no listeners registered", () => {
      const target = new EventTarget<TestEvent>();

      target.dispatchEvent({ type: "foo", payload: 42, timeStamp: Date.now() });

      assertEquals(target.listenerCount(), 0);
    });
  });

  describe("dispatchError", () => {
    it("should dispatch error to error listeners", () => {
      const target = new EventTarget<TestEvent>();
      const testError = new Error("Test error");

      let errorEvent: ErrorEvent | null = null;
      target.addEventListener("error", (event) => {
        errorEvent = event;
        assertEquals("Test error", (event?.error as Error).message);
        assertEquals(errorEvent.type, "error");
        assertEquals(errorEvent.error, testError);
      });

      target.dispatchError(testError);
      assert(errorEvent);
    });

    it("should throw on next tick when no error listeners", async () => {
      const target = new EventTarget<TestEvent>();

      // Listen for unhandled rejections (since nextTick throws asynchronously)
      let uncaughtErrorMessage: string | null = null;
      globalThis.addEventListener("error", (event) => {
        event.preventDefault(); // prevent test from crashing
        uncaughtErrorMessage = event.message;
      });

      target.dispatchError(new Error("Hello World"));

      // Allow next tick to execute
      await new Promise((resolve) => setTimeout(resolve, 10));

      assert(uncaughtErrorMessage);
      assertMatch(uncaughtErrorMessage, /Hello World/);
    });

    it("should not throw when error listener throws", async () => {
      const target = new EventTarget<TestEvent>();
      target.addEventListener("error", () => {
        throw new Error("Goodnight moon");
      });

      // Listen for unhandled rejections (since nextTick throws asynchronously)
      let uncaughtErrorMessage: string | null = null;
      globalThis.addEventListener("error", (event) => {
        event.preventDefault(); // prevent test from crashing
        uncaughtErrorMessage = event.message;
      });

      target.dispatchError(new Error("Hello World"));

      // Allow next tick to execute
      await new Promise((resolve) => setTimeout(resolve, 10));

      assert(uncaughtErrorMessage);
      assertMatch(uncaughtErrorMessage, /Goodnight moon/);
    });
  });

  describe("eventNames", () => {
    it("should return empty array when no listeners", () => {
      const target = new EventTarget<TestEvent>();

      assertEquals(Array.from(target.eventNames()), []);
    });

    it("should return array of event type names", () => {
      const target = new EventTarget<TestEvent>();

      target.addEventListener("foo", () => {});
      target.addEventListener("bar", () => {});

      assertEquals(Array.from(target.eventNames()), ["foo", "bar"]);
    });

    it("should not include duplicates", () => {
      const target = new EventTarget<TestEvent>();

      target.addEventListener("foo", () => {});
      target.addEventListener("foo", () => {});

      assertEquals(Array.from(target.eventNames()), ["foo"]);
    });
  });

  describe("listenerCount", () => {
    it("should return 0 when no listeners", () => {
      const target = new EventTarget<TestEvent>();

      assertEquals(target.listenerCount(), 0);
    });

    it("should return total count of all listeners", () => {
      const target = new EventTarget<TestEvent>();

      target.addEventListener("foo", () => {});
      target.addEventListener("foo", () => {});
      target.addEventListener("bar", () => {});

      assertEquals(target.listenerCount(), 3);
    });

    it("should decrease when listeners are removed", () => {
      const target = new EventTarget<TestEvent>();
      const listener = () => {};

      target.addEventListener("foo", listener);
      assertEquals(target.listenerCount(), 1);

      target.removeEventListener("foo", listener);
      assertEquals(target.listenerCount(), 0);
    });
  });

  describe("once listener behavior", () => {
    it("should handle multiple once listeners for same event", () => {
      const target = new EventTarget<TestEvent>();
      let count1 = 0;
      let count2 = 0;

      target.addEventListener("foo", () => count1++, true);
      target.addEventListener("foo", () => count2++, true);

      target.dispatchEvent({ type: "foo", payload: 42, timeStamp: Date.now() });
      target.dispatchEvent({ type: "foo", payload: 99, timeStamp: Date.now() });

      assertEquals(count1, 1);
      assertEquals(count2, 1);
      assertEquals(target.listenerCount(), 0);
    });

    it("should allow manual removal of once listener before it fires", () => {
      const target = new EventTarget<TestEvent>();
      let callCount = 0;
      const listener = () => callCount++;

      target.addEventListener("foo", listener, true);
      target.removeEventListener("foo", listener);

      target.dispatchEvent({ type: "foo", payload: 42, timeStamp: Date.now() });

      assertEquals(callCount, 0);
    });
  });

  describe("on", () => {
    it("should add a listener and call it when event is dispatched", () => {
      const target = new EventTarget<TestEvent>();
      let called = false;
      let receivedPayload = 0;

      target.on("foo", (event) => {
        called = true;
        receivedPayload = event.payload;
      });

      target.dispatchEvent({ type: "foo", payload: 42, timeStamp: Date.now() });

      assertEquals(called, true);
      assertEquals(receivedPayload, 42);
    });
  });

  describe("once", () => {
    it("should add a one-time listener that removes itself after firing", () => {
      const target = new EventTarget<TestEvent>();
      let callCount = 0;

      target.once("foo", () => {
        callCount++;
      });

      target.dispatchEvent({ type: "foo", payload: 42, timeStamp: Date.now() });
      target.dispatchEvent({ type: "foo", payload: 99, timeStamp: Date.now() });

      assertEquals(callCount, 1);
      assertEquals(target.listenerCount(), 0);
    });
  });

  describe("off", () => {
    it("should remove a listener", () => {
      const target = new EventTarget<TestEvent>();
      let callCount = 0;
      const listener = () => {
        callCount++;
      };

      target.on("foo", listener);
      target.off("foo", listener);

      target.dispatchEvent({ type: "foo", payload: 42, timeStamp: Date.now() });

      assertEquals(callCount, 0);
      assertEquals(target.listenerCount(), 0);
    });
  });
});
