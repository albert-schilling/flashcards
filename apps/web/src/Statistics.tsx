import type { TCard } from "@flashcards/cards";
import { statistics, type TTagStatistics } from "./review.statistics";
import type { TReview } from "./storage";

function share(reviews: number, right: number): string {
  return reviews === 0 ? "–" : `${Math.round((100 * right) / reviews)}%`;
}

function TagTable({ name, rows }: { name: string; rows: TTagStatistics[] }) {
  return (
    <table>
      <caption>{name}</caption>
      <thead>
        <tr>
          <th>Tag</th>
          <th>Cards</th>
          <th>Reviews</th>
          <th>Share right</th>
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
  const { cards, domain, topic } = statistics(props.cards, props.reviews);
  return (
    <>
      <button onClick={props.onBack}>Back</button>
      <table>
        <caption>Cards</caption>
        <thead>
          <tr>
            <th>Card</th>
            <th>Reviews</th>
            <th>Share right</th>
            <th>Last reviewed</th>
          </tr>
        </thead>
        <tbody>
          {cards.map((row) => (
            <tr key={row.card.id}>
              <td>{row.card.id}</td>
              <td>{row.reviews}</td>
              <td>{share(row.reviews, row.right)}</td>
              <td>
                {row.lastReviewedAt ? new Date(row.lastReviewedAt).toLocaleDateString() : "never"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <TagTable name="Domain tags" rows={domain} />
      <TagTable name="Topic tags" rows={topic} />
    </>
  );
}
