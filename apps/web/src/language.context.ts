import { createContext, useContext } from "react";
import { uiText, type TUiText } from "./ui.text";

/** The language of the app: Card text and UI text. */
export type TLanguage = "en" | "de";

/** German if the browser language starts with "de", else English. */
export function browserLanguage(language = navigator.language): TLanguage {
  return language.toLowerCase().startsWith("de") ? "de" : "en";
}

/** The Learner's language: App provides it, components read it. */
export const LanguageContext = createContext<TLanguage>("en");

/** The UI text in the language App provides. */
export function useText(): TUiText {
  return uiText[useContext(LanguageContext)];
}
