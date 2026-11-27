// Sets the browser language and picks the language on Settings.
import { fireEvent, screen } from "@testing-library/react";
import { goHome, goTo } from "./app.helpers";

/** Runs the test with this browser language; jsdom's own is "en-US". */
export async function withBrowserLanguage(language: string, test: () => Promise<void>) {
  Object.defineProperty(navigator, "language", { value: language, configurable: true });
  try {
    await test();
  } finally {
    Reflect.deleteProperty(navigator, "language");
  }
}

export function languageSelect() {
  return screen.getByLabelText<HTMLSelectElement>(/^(Language|Sprache)$/);
}

export function openSettings() {
  goTo(/^(Settings|Einstellungen)$/);
}

/** Picks the language on Settings, then goes Home. */
export function pickLanguage(language: string) {
  openSettings();
  fireEvent.change(languageSelect(), { target: { value: language } });
  goHome();
}
