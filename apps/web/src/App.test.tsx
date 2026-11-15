import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { App } from "./App";

it("renders the start page with the app name", () => {
  render(<App />);

  const heading = screen.getByRole("heading", { name: "Flashcards" });

  expect(heading.textContent).toBe("Flashcards");
});
