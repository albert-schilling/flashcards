import type { TCard } from "@flashcards/cards";
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
  const { cards, domain, topic } = statistics(props.cards, props.reviews);
  return (
    <>
      <button onClick={props.onBack}>{text.back}</button>
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
