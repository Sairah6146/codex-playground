export default function Tags({ items = [], variant }) {
  if (!items.length) return null;
  return (
    <div className="tags">
      {items.map((item) => (
        <span key={item} className={`tag ${variant ? `tag-${variant}` : ''}`}>{item}</span>
      ))}
    </div>
  );
}
