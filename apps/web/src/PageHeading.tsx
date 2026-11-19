/** A page's heading: an optional eyebrow above the h1 title and an optional intro below it. */
export function PageHeading(props: { eyebrow?: string; title: string; intro?: string }) {
  return (
    <div className="page-heading">
      {props.eyebrow && <p className="eyebrow">{props.eyebrow}</p>}
      <h1>{props.title}</h1>
      {props.intro && <p className="page-intro">{props.intro}</p>}
    </div>
  );
}
