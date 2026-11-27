import type { TCard } from "@flashcards/cards";
import { defaultRangeExtractor, useVirtualizer } from "@tanstack/react-virtual";
import { Trash2 } from "lucide-react";
import { useContext, useRef, useState } from "react";
import { cardTitle } from "./CardView";
import { LanguageContext, useText } from "./language.context";
import { RowTags } from "./RowTags";

/** The pixel height of one row: the --virtual-row-height token (in rem) times the root font size. */
function rowHeightOf(): number {
  const root = getComputedStyle(document.documentElement);
  return parseFloat(root.getPropertyValue("--virtual-row-height")) * parseFloat(root.fontSize);
}

/** Windowed with TanStack Virtual: only the rows in view, three on each side and the row holding focus are mounted. Rows are keyed by Card ID and kept in list order, so focus stays put while scrolling; give the list a new key to scroll back to the top. */
export function CardList(props: {
  cards: TCard[];
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const text = useText();
  const language = useContext(LanguageContext);
  const listRef = useRef<HTMLDivElement>(null);
  const [rowHeight] = useState(rowHeightOf);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const focusedIndex = props.cards.findIndex((card) => card.id === focusedId);
  const virtualizer = useVirtualizer({
    count: props.cards.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => rowHeight,
    overscan: 3,
    getItemKey: (index) => props.cards[index].id,
    // The row holding focus stays mounted, so scrolling far away doesn't drop the focused button.
    rangeExtractor: (range) => {
      const indexes = defaultRangeExtractor(range);
      if (focusedIndex < 0 || indexes.includes(focusedIndex)) return indexes;
      return [...indexes, focusedIndex].sort((a, b) => a - b);
    },
  });

  return (
    <div className="virtual-list" ref={listRef}>
      <ul
        className="library-list virtual-spacer"
        style={{ height: virtualizer.getTotalSize() }}
        onFocus={(event) => {
          const id = (event.target as HTMLElement).closest("li")?.dataset.cardId;
          if (id !== undefined) setFocusedId(id);
        }}
        onBlur={() => setFocusedId(null)}
      >
        {virtualizer.getVirtualItems().map((item) => {
          const card = props.cards[item.index];
          return (
            <li
              className="library-card-row"
              key={item.key}
              data-card-id={card.id}
              aria-posinset={item.index + 1}
              aria-setsize={props.cards.length}
              style={{ transform: `translateY(${item.start}px)` }}
            >
              {/* Not in the prototype: its ArrowRight icon is left out, because it would crowd the row next to Delete at 375 px. */}
              <button className="library-card-open" onClick={() => props.onOpen(card.id)}>
                <span className="library-card-copy">
                  <span className="type-label">{text.cardTypes[card.type]}</span>
                  <strong>{cardTitle(card, language)}</strong>
                  <span className="card-id">{card.id}</span>
                  <RowTags tags={card.tags} />
                </span>
              </button>
              <button
                className="icon-button"
                aria-label={text.deleteCard(card.id)}
                title={text.deleteCard(card.id)}
                onClick={() => props.onDelete(card.id)}
              >
                <Trash2 size={17} aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
