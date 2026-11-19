import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(path: string): string {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

// Comments become spaces, so positions and line breaks stay where they were.
function withoutComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, " "));
}

// var(--name) becomes spaces of the same length; a fallback inside var() is kept and so is checked.
function withoutVars(css: string): string {
  return css.replace(/var\(\s*--[\w-]+\s*\)/g, (use) => " ".repeat(use.length));
}

function definedTokens(css: string): Map<string, string> {
  return new Map(
    [...withoutComments(css).matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((match) => [
      match[1],
      match[2].trim(),
    ]),
  );
}

function usedTokens(css: string): string[] {
  return [...withoutComments(css).matchAll(/var\(\s*(--[\w-]+)/g)].map((match) => match[1]);
}

const designTokens = read("../../../docs/design/tokens.css");
const breakpoint = definedTokens(designTokens).get("--breakpoint-desktop");
const styleSheets = ["base.css", "components.css"];

// A number not inside a name (h1, --space-4), with its unit.
const numberPattern = /(?<![\w-])-?(?:\d+\.?\d*|\.\d+)(?:[a-z]+|%)?/gi;

// The raw values left in a style sheet once tokens are taken out.
function rawValues(css: string): string[] {
  const raw = withoutComments(css);
  const code = withoutVars(raw);
  const lines = css.split("\n");
  const found: string[] = [];
  for (const match of code.matchAll(/#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?)\(/gi)) {
    found.push(match[0]);
  }
  for (const match of code.matchAll(numberPattern)) {
    const value = match[0];
    const before = code.slice(0, match.index);
    if (value === "0" || value === "100%" || value === "100vh") continue;
    if (value === "-1" && /calc\(\s*$/.test(before)) continue;
    if (value === breakpoint && isCommentedBreakpoint(before, lines)) continue;
    // No token exists for a stacking order or a mixing share, so these may be plain numbers.
    if (/^\d+$/.test(value) && /z-index\s*:\s*$/.test(before)) continue;
    if (value.endsWith("%") && isInsideColorMix(before)) continue;
    // A fraction of the free grid space and a repeat count are neither colour nor size.
    if (value.endsWith("fr")) continue;
    if (/^\d+$/.test(value) && /repeat\(\s*$/.test(before)) continue;
    found.push(value);
  }
  return found;
}

// True when the text ends inside a color-mix( that isn't closed yet.
function isInsideColorMix(before: string): boolean {
  const start = before.lastIndexOf("color-mix(");
  if (start === -1) return false;
  let depth = 0;
  for (const char of before.slice(start)) {
    if (char === "(") depth++;
    if (char === ")") depth--;
  }
  return depth > 0;
}

// A media query can't use a variable, so the breakpoint may appear there with a comment naming its token.
function isCommentedBreakpoint(before: string, lines: string[]): boolean {
  const ruleStart = before.lastIndexOf("@media");
  if (ruleStart === -1 || /[{};]/.test(before.slice(ruleStart))) return false;
  const line = before.split("\n").length - 1;
  return [lines[line - 1], lines[line]].some(
    (text) => text !== undefined && /\/\*.*--breakpoint-desktop.*\*\//.test(text),
  );
}

describe("rawValues", () => {
  it("accepts an integer z-index, which has no token", () => {
    expect(rawValues(".a { z-index: 20; }")).toEqual([]);
  });

  it("accepts a percentage inside color-mix, which has no token", () => {
    expect(rawValues(".a { background: color-mix(in srgb, var(--a) 94%, var(--b)); }")).toEqual([]);
  });

  it("still finds a percentage outside color-mix", () => {
    expect(rawValues(".a { width: 94%; }")).toEqual(["94%"]);
    expect(
      rawValues(".a { background: color-mix(in srgb, var(--a) 94%, var(--b)); width: 50%; }"),
    ).toEqual(["50%"]);
  });

  it("still finds a z-index that isn't an integer, and an integer elsewhere", () => {
    expect(rawValues(".a { z-index: 1.5; }")).toEqual(["1.5"]);
    expect(rawValues(".a { order: 20; }")).toEqual(["20"]);
  });

  it("accepts fr fractions and a repeat count, which have no token", () => {
    expect(rawValues(".a { grid-template-columns: repeat(2, 1fr); }")).toEqual([]);
    expect(rawValues(".a { grid-template-columns: 2fr 1fr; }")).toEqual([]);
  });

  it("still finds other raw numbers in and around a grid", () => {
    expect(rawValues(".a { grid-template-columns: repeat(2, 10rem); }")).toEqual(["10rem"]);
    expect(rawValues(".a { width: 2; }")).toEqual(["2"]);
    expect(rawValues(".a { grid-template-columns: 1fr 2; }")).toEqual(["2"]);
  });
});

describe("design tokens", () => {
  it("are the tokens of docs/design/tokens.css, copied unchanged", () => {
    expect(read("./tokens.css")).toBe(designTokens);
  });
});

describe.each(styleSheets)("%s", (name) => {
  it("uses no colour or size except through tokens", () => {
    expect(rawValues(read(`./${name}`))).toEqual([]);
  });

  it("uses only tokens that tokens.css defines", () => {
    const defined = definedTokens(read("./tokens.css"));
    const undefinedTokens = usedTokens(read(`./${name}`)).filter((token) => !defined.has(token));

    expect(undefinedTokens).toEqual([]);
  });
});
