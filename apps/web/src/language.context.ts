import { createContext } from "react";

/** The language of the app: UI text (from #41) and Card text. */
export type TLanguage = "en" | "de";

/** German if the browser language starts with "de", else English. */
export function browserLanguage(language = navigator.language): TLanguage {
  return language.toLowerCase().startsWith("de") ? "de" : "en";
}

/** The Learner's language: App provides it, components read it. */
export const LanguageContext = createContext<TLanguage>("en");
