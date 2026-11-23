import type { TCard } from "@flashcards/cards";
import { useEffect, useRef, useState } from "react";
import { useText } from "./language.context";

// How many tags show before the "+N more" button.
const collapsedCount = 2;

/** A Card's tags, domain first, then topic. Shows the first 2 and, when there are more, a "+N more" button; its click shows all tags and moves focus to the list. Starts collapsed on mount; the caller remounts it for each new Card. */
export function StudyCardTags(props: { tags: TCard["tags"] }) {
  const text = useText();
  const [expanded, setExpanded] = useState(false);
  const list = useRef<HTMLUListElement>(null);
  const tags = [
    ...props.tags.domain.map((name) => ({ name, kind: "domain" })),
    ...props.tags.topic.map((name) => ({ name, kind: "topic" })),
  ];
  const hidden = expanded ? 0 : Math.max(0, tags.length - collapsedCount);

  // The button is gone after the click, so focus goes to the list; never on mount.
  useEffect(() => {
    if (expanded) list.current?.focus();
  }, [expanded]);

  return (
    <div className="study-card-tags">
      <ul ref={list} tabIndex={-1} aria-label={text.tags}>
        {tags.slice(0, expanded ? undefined : collapsedCount).map((tag, i) => (
          // Keyed by position: tags may repeat, and never reorder.
          <li key={i} className={`card-tag tag-${tag.kind}`}>
            {tag.name}
          </li>
        ))}
      </ul>
      {hidden > 0 && (
        <button
          type="button"
          className="more-tags"
          aria-label={text.moreTagsName(hidden)}
          onClick={() => setExpanded(true)}
        >
          {text.moreTags(hidden)}
        </button>
      )}
    </div>
  );
}
