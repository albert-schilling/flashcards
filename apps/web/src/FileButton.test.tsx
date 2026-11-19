import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { FileButton } from "./FileButton";

it("is a file input named by its label text", () => {
  render(<FileButton label="Upload Deck" accept=".json,application/json" onChange={vi.fn()} />);

  const input = screen.getByLabelText<HTMLInputElement>("Upload Deck");

  expect(input.type).toBe("file");
  expect(input.accept).toBe(".json,application/json");
});

it("calls onChange with the input's change event when a file is picked", () => {
  const onChange = vi.fn();
  render(<FileButton label="Upload Deck" accept=".json" onChange={onChange} />);
  const input = screen.getByLabelText("Upload Deck");

  fireEvent.change(input);

  expect(onChange).toHaveBeenCalledOnce();
  expect(onChange.mock.calls[0][0].target).toBe(input);
});

it("shows an upload icon hidden from assistive technology", () => {
  const { container } = render(
    <FileButton label="Upload Review log" accept=".json" onChange={vi.fn()} />,
  );

  const icons = container.querySelectorAll("svg");

  expect(icons).toHaveLength(1);
  expect(icons[0].getAttribute("aria-hidden")).toBe("true");
  expect(screen.getByText("Upload Review log")).toBeTruthy();
});
