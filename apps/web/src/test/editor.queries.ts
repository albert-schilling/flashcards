/** The first non-blank text in this element: a Card editor field's label, before its hint and error. */
export function firstText(element: Element): string | undefined {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const text = walker.currentNode.textContent!.trim();
    if (text) return text;
  }
  return undefined;
}

/** The control of the Card editor field in `editor` whose label is `name`. A field's label holds its hint and error too, so it is matched by its first text. */
export function editorControl(
  editor: Element,
  name: string,
): HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement {
  const label = [...editor.querySelectorAll("label")].find((each) => firstText(each) === name);
  if (!label?.control) throw new Error(`No field labelled ${name}`);
  return label.control as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
}
