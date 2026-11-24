import type { TCard } from "@flashcards/cards";
import { ArrowLeft } from "lucide-react";
import { useId, type ReactNode } from "react";
import { PageHeading } from "./PageHeading";
import { useText } from "./language.context";
import { statistics, type TTagStatistics } from "./review.statistics";
import type { TReview } from "./storage";

/** The share right in whole percent; undefined with no Reviews. */
function percentRight(reviews: number, right: number): number | undefined {
  return reviews === 0 ? undefined : Math.round((100 * right) / reviews);
}

/** The share right as text: "67%", or "–" with no Reviews. */
function share(reviews: number, right: number): string {
  const percent = percentRight(reviews, right);
  return percent === undefined ? "–" : `${percent}%`;
}

/** A cell with the share right and a bar as wide as it; the bar is empty with no Reviews. */
function ShareCell(props: { reviews: number; right: number }) {
  const percent = percentRight(props.reviews, props.right);
  return (
    <td>
      <div className="share-cell">
        <span>{share(props.reviews, props.right)}</span>
        {/* The width is inline, because a component-local custom property fails the token check. */}
        <span className="mini-bar" aria-hidden="true">
          <span style={{ width: `${percent ?? 0}%` }} />
        </span>
      </div>
    </td>
  );
}

/** A panel whose h2 names the table inside it; the table scrolls sideways when the panel is narrower. */
function TablePanel(props: { title: string; children: ReactNode }) {
  const id = useId();
  return (
    <section className="panel table-panel">
      <h2 id={id}>{props.title}</h2>
      <div className="table-scroll">
        <table aria-labelledby={id}>{props.children}</table>
      </div>
    </section>
  );
}

function TagTable({ name, rows }: { name: string; rows: TTagStatistics[] }) {
  const text = useText();
  return (
    <TablePanel title={name}>
      <thead>
        <tr>
          <th>{text.tag}</th>
          <th>{text.cards}</th>
          <th>{text.reviews}</th>
          <th>{text.shareRight}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.tag}>
            <th scope="row">{row.tag}</th>
            <td>{row.cards}</td>
            <td>{row.reviews}</td>
            <ShareCell reviews={row.reviews} right={row.right} />
          </tr>
        ))}
      </tbody>
    </TablePanel>
  );
}

/** Shows the Statistics of the stored Cards; `onBack` leaves it. */
export function Statistics(props: { cards: TCard[]; reviews: TReview[]; onBack: () => void }) {
  const text = useText();
  const { overall, cards, domain, topic } = statistics(props.cards, props.reviews);
  return (
    <>
      <button className="button ghost back-button" onClick={props.onBack}>
        <ArrowLeft size={18} aria-hidden="true" />
        {text.back}
      </button>
      <PageHeading
        eyebrow={text.learningHistory}
        title={text.statistics}
        intro={text.statisticsIntro}
      />
      <section className="stat-overview" aria-label={text.statisticsOverview}>
        <div>
          <strong>{overall.cards}</strong>
          <span>{text.cards}</span>
        </div>
        <div>
          <strong>{overall.reviews}</strong>
          <span>{text.reviews}</span>
        </div>
        <div>
          <strong>{share(overall.reviews, overall.right)}</strong>
          <span>{text.shareRight}</span>
        </div>
      </section>
      <div className="table-sections">
        <TablePanel title={text.cards}>
          <thead>
            <tr>
              <th>{text.card}</th>
              <th>{text.reviews}</th>
              <th>{text.shareRight}</th>
              <th>{text.lastReviewed}</th>
            </tr>
          </thead>
          <tbody>
            {cards.map((row) => (
              <tr key={row.card.id}>
                <th scope="row">{row.card.id}</th>
                <td>{row.reviews}</td>
                <ShareCell reviews={row.reviews} right={row.right} />
                <td>{row.lastReviewedAt ? text.date(new Date(row.lastReviewedAt)) : text.never}</td>
              </tr>
            ))}
          </tbody>
        </TablePanel>
        <TagTable name={text.domainTags} rows={domain} />
        <TagTable name={text.topicTags} rows={topic} />
      </div>
    </>
  );
}
