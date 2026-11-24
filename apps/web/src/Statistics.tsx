import type { TCard } from "@flashcards/cards";
import { ArrowLeft } from "lucide-react";
import { PageHeading } from "./PageHeading";
import { useText } from "./language.context";
import { statistics, type TTagStatistics } from "./review.statistics";
import type { TReview } from "./storage";

function share(reviews: number, right: number): string {
  return reviews === 0 ? "–" : `${Math.round((100 * right) / reviews)}%`;
}

function TagTable({ name, rows }: { name: string; rows: TTagStatistics[] }) {
  const text = useText();
  return (
    <table>
      <caption>{name}</caption>
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
            <td>{row.tag}</td>
            <td>{row.cards}</td>
            <td>{row.reviews}</td>
            <td>{share(row.reviews, row.right)}</td>
          </tr>
        ))}
      </tbody>
    </table>
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
      <table>
        <caption>{text.cards}</caption>
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
              <td>{row.card.id}</td>
              <td>{row.reviews}</td>
              <td>{share(row.reviews, row.right)}</td>
              <td>{row.lastReviewedAt ? text.date(new Date(row.lastReviewedAt)) : text.never}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <TagTable name={text.domainTags} rows={domain} />
      <TagTable name={text.topicTags} rows={topic} />
    </>
  );
}
