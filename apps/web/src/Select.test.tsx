import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { ChangeEvent } from "react";
import { Select } from "./Select";

function renderLanguage(onChange: (event: ChangeEvent<HTMLSelectElement>) => void = vi.fn()) {
  return render(
    <label>
      Language
      <Select value="en" onChange={onChange}>
        <option value="en">English</option>
        <option value="de">Deutsch</option>
      </Select>
    </label>,
  );
}

it("is a native select named by its label", () => {
  renderLanguage();

  const select = screen.getByLabelText<HTMLSelectElement>("Language");

  expect(select.tagName).toBe("SELECT");
  expect(select.value).toBe("en");
  expect(screen.getByRole("combobox", { name: "Language" })).toBe(select);
});

it("calls onChange with the picked option", () => {
  const picked: string[] = [];
  renderLanguage((event) => picked.push(event.target.value));

  fireEvent.change(screen.getByLabelText("Language"), { target: { value: "de" } });

  expect(picked).toEqual(["de"]);
});

it("shows a chevron hidden from assistive technology", () => {
  const { container } = renderLanguage();

  const icons = container.querySelectorAll("svg");

  expect(icons).toHaveLength(1);
  expect(icons[0].getAttribute("aria-hidden")).toBe("true");
});

it("passes other select props through", () => {
  render(
    <label>
      Tag
      <Select disabled defaultValue="">
        <option value="">Any tag</option>
      </Select>
    </label>,
  );

  expect(screen.getByLabelText<HTMLSelectElement>("Tag").disabled).toBe(true);
});
