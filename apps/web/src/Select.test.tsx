import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { Select } from "./Select";

function renderLanguage(onChange = vi.fn()) {
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

it("calls onChange when another option is picked", () => {
  const onChange = vi.fn();
  renderLanguage(onChange);

  fireEvent.change(screen.getByLabelText("Language"), { target: { value: "de" } });

  expect(onChange).toHaveBeenCalledOnce();
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
