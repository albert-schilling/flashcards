import "fake-indexeddb/auto";
import { cleanup } from "@testing-library/react";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach } from "vitest";

// Each test starts with an empty IndexedDB.
beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
});

// Testing Library cleans up by itself only when Vitest globals are on; they are off here.
afterEach(cleanup);
