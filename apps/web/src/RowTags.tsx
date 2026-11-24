import type { TCard } from "@flashcards/cards";

/** A Card's tags as pills, for the Cards list and the Card preview: domain tags in the accent tint, then topic tags in neutral. A tag in both groups shows twice. Renders a span, because the list puts it inside a button. */
export function RowTags(props: { tags: TCard["tags"] }) {
  const tags = [
    ...props.tags.domain.map((name) => ({ name, kind: "domain" })),
    ...props.tags.topic.map((name) => ({ name, kind: "topic" })),
  ];
  return (
    <span className="row-tags">
      {tags.map((tag, i) => (
        // Keyed by position: tags may repeat, and never reorder.
        <span key={i} className={`tag-${tag.kind}`}>
          {tag.name}
        </span>
      ))}
    </span>
  );
}
