import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { Alert, type TAlertTone } from "./Alert";

it("shows its message with one icon hidden from assistive technology", () => {
  const { container } = render(<Alert tone="success">Deck uploaded.</Alert>);

  const icons = container.querySelectorAll("svg");

  expect(screen.getByText("Deck uploaded.")).toBeTruthy();
  expect(icons).toHaveLength(1);
  expect(icons[0].getAttribute("aria-hidden")).toBe("true");
});

it("is an alert when given role alert", () => {
  render(
    <Alert tone="danger" role="alert">
      Storage is blocked.
    </Alert>,
  );

  expect(screen.getByRole("alert").textContent).toBe("Storage is blocked.");
});

it("is no alert without a role, so only errors interrupt", () => {
  render(<Alert tone="danger">2 Cards rejected.</Alert>);

  expect(screen.queryByRole("alert")).toBeNull();
  expect(screen.getByText("2 Cards rejected.")).toBeTruthy();
});

it("shows a different icon for each tone", () => {
  const tones: TAlertTone[] = ["success", "danger", "info"];

  const icons = tones.map((tone) => {
    const { container, unmount } = render(<Alert tone={tone}>Message</Alert>);
    const icon = container.querySelector("svg")?.innerHTML;
    unmount();
    return icon;
  });

  expect(new Set(icons).size).toBe(3);
});
