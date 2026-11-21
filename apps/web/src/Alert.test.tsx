import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { Alert, type TAlertTone } from "./Alert";
import { LanguageContext } from "./language.context";

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

it("is a status when given role status, so a notice is read out without interrupting", () => {
  render(
    <Alert tone="success" role="status">
      Card deleted.
    </Alert>,
  );

  expect(screen.getByRole("status").textContent).toBe("Card deleted.");
  expect(screen.queryByRole("alert")).toBeNull();
});

it("with onDismiss, shows a Dismiss button whose icon is hidden from assistive technology, and it calls onDismiss", () => {
  const onDismiss = vi.fn();
  render(
    <Alert tone="success" onDismiss={onDismiss}>
      Card deleted.
    </Alert>,
  );
  const dismiss = screen.getByRole("button", { name: "Dismiss" });

  fireEvent.click(dismiss);

  expect(onDismiss).toHaveBeenCalledTimes(1);
  expect(dismiss.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
});

it("names the Dismiss button in German", () => {
  render(
    <LanguageContext.Provider value="de">
      <Alert tone="success" onDismiss={vi.fn()}>
        Karte gelöscht.
      </Alert>
    </LanguageContext.Provider>,
  );

  expect(screen.getByRole("button", { name: "Ausblenden" })).toBeTruthy();
});

it("without onDismiss, shows no button", () => {
  render(<Alert tone="success">Deck uploaded.</Alert>);

  expect(screen.queryByRole("button")).toBeNull();
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
