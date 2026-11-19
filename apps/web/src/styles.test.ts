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
    found.push(value);
  }
  return found;
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
