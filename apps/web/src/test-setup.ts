import "fake-indexeddb/auto";
import { cleanup } from "@testing-library/react";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach } from "vitest";
import tokensCss from "./tokens.css?raw";

// The Card list reads its row height from the tokens, as in the browser: 6.5rem, 104 px.
const tokens = document.createElement("style");
tokens.textContent = tokensCss;
document.head.append(tokens);

// jsdom lays nothing out, so every clientHeight is 0 and the windowed Card list would show no row.
// Its scroll box gets the height of --virtual-list-height (29.25rem, 468 px), so it shows 4.5 rows as in the browser.
Object.defineProperty(HTMLElement.prototype, "clientHeight", {
  configurable: true,
  get(this: HTMLElement) {
    return this.classList.contains("virtual-list") ? 468 : 0;
  },
});

// Each test starts with an empty IndexedDB.
beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
});

// Testing Library cleans up by itself only when Vitest globals are on; they are off here.
afterEach(cleanup);
