import { createContext } from "react";

/** The language of the app: Card text now, UI text once issue #41 translates it. */
export type TLanguage = "en" | "de";

/** German if the browser language starts with "de", else English. */
export function browserLanguage(language = navigator.language): TLanguage {
  return language.toLowerCase().startsWith("de") ? "de" : "en";
}

/** The Learner's language: App provides it, components read it. */
export const LanguageContext = createContext<TLanguage>("en");
