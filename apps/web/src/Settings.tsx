import { Settings as SettingsIcon } from "lucide-react";
import { useContext } from "react";
import { LanguageContext, useText, type TLanguage } from "./language.context";
import { PageHeading } from "./PageHeading";
import { Select } from "./Select";

/** The Settings page: the Language settings heading, then the Interface panel with the Language select and a note that the interface and Card texts update immediately. The select shows the language from LanguageContext; App owns the language, changes it at once and stores it. */
export function Settings(props: { onLanguage: (language: TLanguage) => void }) {
  const text = useText();
  const language = useContext(LanguageContext);

  return (
    <>
      <PageHeading
        eyebrow={text.languageSettings}
        title={text.settings}
        intro={text.settingsIntro}
      />
      <section className="panel settings-panel">
        <div className="section-heading compact">
          <span className="section-icon">
            <SettingsIcon size={20} aria-hidden="true" />
          </span>
          <div>
            <p className="eyebrow">{text.interface}</p>
            <h2>{text.language}</h2>
          </div>
        </div>
        <label className="field">
          {text.language}
          <Select
            value={language}
            onChange={(event) => props.onLanguage(event.target.value as TLanguage)}
          >
            <option value="en">English</option>
            <option value="de">Deutsch</option>
          </Select>
        </label>
        <p className="settings-help">{text.settingsHelp}</p>
      </section>
    </>
  );
}
