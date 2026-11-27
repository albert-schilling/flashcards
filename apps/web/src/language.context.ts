import { createContext, useContext } from "react";
import { uiText, type TUiText } from "./ui.text";

export type TLanguage = "en" | "de";

/** German only if the browser language starts with "de". */
export function browserLanguage(language = navigator.language): TLanguage {
  return language.toLowerCase().startsWith("de") ? "de" : "en";
}

export const LanguageContext = createContext<TLanguage>("en");

export function useText(): TUiText {
  return uiText[useContext(LanguageContext)];
}
