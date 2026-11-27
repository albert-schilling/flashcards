import { Layers3, Menu, X } from "lucide-react";
import { useState } from "react";
import { useText } from "./language.context";

export type TPage = "home" | "cards" | "session" | "statistics" | "settings";

/** On phones the nav opens from the menu button and closes after any choice. */
export function Header(props: {
  page: TPage;
  onNavigate: (page: TPage) => void;
  sessionDisabled: boolean;
}) {
  const text = useText();
  const [open, setOpen] = useState(false);
  const links: [TPage, string][] = [
    ["home", text.home],
    ["cards", text.cards],
    ["session", text.session],
    ["statistics", text.statistics],
    ["settings", text.settings],
  ];

  function go(page: TPage) {
    props.onNavigate(page);
    setOpen(false);
  }

  return (
    <header className="app-header">
      <div className="header-inner">
        <button className="brand" aria-label={text.brandHome} onClick={() => go("home")}>
          <span className="brand-mark">
            <Layers3 size={22} strokeWidth={2.2} aria-hidden="true" />
          </span>
          <span>Flashcards</span>
        </button>
        <button
          className="menu-button"
          aria-expanded={open}
          aria-label={text.openNavigation}
          onClick={() => setOpen(!open)}
        >
          {open ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
        </button>
        <nav className={open ? "main-nav is-open" : "main-nav"} aria-label={text.pages}>
          {links.map(([page, label]) => (
            <button
              key={page}
              className={props.page === page ? "nav-link active" : "nav-link"}
              aria-current={props.page === page ? "page" : undefined}
              disabled={page === "session" && props.sessionDisabled}
              onClick={() => go(page)}
            >
              {label}
            </button>
          ))}
        </nav>
      </div>
    </header>
  );
}
