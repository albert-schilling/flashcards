// Reads the Statistics page: its main region, tables and overview.
import { screen, within } from "@testing-library/react";

// The navigation has a Statistics button too, so a click on Home's looks inside main only.
export function home() {
  return within(screen.getByRole("main"));
}

/** The text of each cell of the table with this name, row by row, header row first. */
export function rows(name: string) {
  return within(screen.getByRole("table", { name }))
    .getAllByRole("row")
    .map((row) => Array.from(row.querySelectorAll("th, td"), (cell) => cell.textContent));
}

/** Each figure of the Statistics overview with this name as [value, label]. */
export function overview(name = "Statistics overview") {
  return Array.from(screen.getByRole("region", { name }).children, (figure) =>
    Array.from(figure.children, (part) => part.textContent),
  );
}
