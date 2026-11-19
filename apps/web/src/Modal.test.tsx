import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { LanguageContext } from "./language.context";
import { Modal } from "./Modal";

/** Renders an open Modal with a body and returns its onClose mock. */
function renderModal() {
  const onClose = vi.fn();
  render(
    <Modal title="Delete all Cards?" onClose={onClose}>
      <p>This cannot be undone.</p>
    </Modal>,
  );
  return onClose;
}

function dialog() {
  return screen.getByRole("dialog", { name: "Delete all Cards?" });
}

it("is a modal dialog named by its title, showing its children", () => {
  renderModal();

  expect(dialog().getAttribute("aria-modal")).toBe("true");
  expect(screen.getByRole("heading", { name: "Delete all Cards?" })).toBeTruthy();
  expect(screen.getByText("This cannot be undone.")).toBeTruthy();
});

it("moves focus into the dialog when it opens", () => {
  renderModal();

  expect(dialog().contains(document.activeElement)).toBe(true);
});

it("Close calls onClose, and its icon is hidden from assistive technology", () => {
  const onClose = renderModal();
  const close = screen.getByRole("button", { name: "Close" });

  fireEvent.click(close);

  expect(onClose).toHaveBeenCalledTimes(1);
  expect(close.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
});

it("Escape calls onClose, other keys don't", () => {
  const onClose = renderModal();

  fireEvent.keyDown(dialog(), { key: "Enter" });
  expect(onClose).not.toHaveBeenCalled();

  fireEvent.keyDown(dialog(), { key: "Escape" });
  expect(onClose).toHaveBeenCalledTimes(1);
});

it("a mouse-down on the backdrop calls onClose", () => {
  const onClose = renderModal();

  // The backdrop is the dialog's parent; it has no role to query by.
  fireEvent.mouseDown(dialog().parentElement!);

  expect(onClose).toHaveBeenCalledTimes(1);
});

it("a mouse-down inside the dialog doesn't call onClose, so a drag that ends outside keeps it open", () => {
  const onClose = renderModal();

  fireEvent.mouseDown(screen.getByText("This cannot be undone."));
  fireEvent.mouseDown(dialog());

  expect(onClose).not.toHaveBeenCalled();
});

it("names the Close button in German", () => {
  render(
    <LanguageContext.Provider value="de">
      <Modal title="Alle Karten löschen?" onClose={vi.fn()}>
        <p>Das kann nicht rückgängig gemacht werden.</p>
      </Modal>
    </LanguageContext.Provider>,
  );

  expect(screen.getByRole("button", { name: "Schließen" })).toBeTruthy();
});
